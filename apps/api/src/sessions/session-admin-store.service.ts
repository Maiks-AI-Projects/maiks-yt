import type { DatabasePool } from "@maiks-yt/database";

import type {
  SessionAdminActor,
  SessionAdminListPage,
  SessionAdminRecord,
  SessionAdminRepository
} from "./session-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type SessionRow = {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
};

const SESSION_ADMIN_LIST_LIMIT = 100;

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<SessionAdminActor | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      LEFT JOIN user_roles ON user_roles.user_id = users.id
        AND user_roles.revoked_at IS NULL
        AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
      LEFT JOIN roles ON roles.id = user_roles.role_id
      WHERE auth_user_links.auth_user_id = ?
        AND users.deleted_at IS NULL
      ORDER BY roles.key
    `,
    [authUserId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const actorRows = rows as Array<{
    domainUserId: string;
    rolePermissions: unknown;
  }>;
  const domainUserId = actorRows[0]?.domainUserId;

  if (!domainUserId) {
    return null;
  }

  return {
    domainUserId,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

const mapSessionRow = (
  row: SessionRow,
  currentSessionId: string | null,
  now = Date.now()
): SessionAdminRecord => {
  const expiresAt = toIsoString(row.expiresAt);

  return {
    id: row.id,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    expiresAt,
    isCurrent: currentSessionId === row.id,
    isExpired: Date.parse(expiresAt) <= now
  };
};

export const createSessionAdminRepository = (
  pool: DatabasePool
): SessionAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listSessions(authUserId, currentSessionId): Promise<SessionAdminListPage> {
    const [rows] = await pool.execute(
      `
        SELECT
          auth_sessions.id,
          auth_sessions.ip_address AS ipAddress,
          auth_sessions.user_agent AS userAgent,
          auth_sessions.created_at AS createdAt,
          auth_sessions.updated_at AS updatedAt,
          auth_sessions.expires_at AS expiresAt
        FROM auth_sessions
        WHERE auth_sessions.user_id = ?
        ORDER BY auth_sessions.updated_at DESC, auth_sessions.created_at DESC
        LIMIT ?
      `,
      [authUserId, SESSION_ADMIN_LIST_LIMIT + 1]
    );

    if (!Array.isArray(rows)) {
      return {
        sessions: [],
        shownCount: 0,
        hasMore: false
      };
    }

    const sessionRows = (rows as SessionRow[]).slice(0, SESSION_ADMIN_LIST_LIMIT);
    const sessions = sessionRows.map((row) => mapSessionRow(row, currentSessionId));

    return {
      sessions,
      shownCount: sessions.length,
      hasMore: rows.length > SESSION_ADMIN_LIST_LIMIT
    };
  },

  async revokeSession(authUserId, id) {
    const [result] = await pool.execute(
      "DELETE FROM auth_sessions WHERE user_id = ? AND id = ?",
      [authUserId, id]
    );

    return typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && typeof result.affectedRows === "number"
      && result.affectedRows > 0;
  },

  async revokeOtherSessions(authUserId, currentSessionId) {
    const [result] = await pool.execute(
      `
        DELETE session_to_revoke
        FROM auth_sessions AS session_to_revoke
        INNER JOIN auth_sessions AS current_session
          ON current_session.user_id = ?
          AND current_session.id = ?
        WHERE session_to_revoke.user_id = ?
          AND session_to_revoke.id <> ?
      `,
      [authUserId, currentSessionId, authUserId, currentSessionId]
    );

    return typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && typeof result.affectedRows === "number"
      ? result.affectedRows
      : 0;
  }
});
