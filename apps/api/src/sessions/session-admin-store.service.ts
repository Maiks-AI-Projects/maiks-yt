import type { DatabasePool } from "@maiks-yt/database";

import type {
  SessionAdminActor,
  SessionAdminRecord,
  SessionAdminRepository
} from "./session-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type SessionRow = {
  id: string;
  authUserId: string;
  userName: string;
  userEmail: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
};

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
    authUserId: row.authUserId,
    userName: row.userName,
    userEmail: row.userEmail,
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

  async listSessions(authUserId, currentSessionId) {
    const [rows] = await pool.execute(
      `
        SELECT
          auth_sessions.id,
          auth_sessions.user_id AS authUserId,
          auth_users.name AS userName,
          auth_users.email AS userEmail,
          auth_sessions.ip_address AS ipAddress,
          auth_sessions.user_agent AS userAgent,
          auth_sessions.created_at AS createdAt,
          auth_sessions.updated_at AS updatedAt,
          auth_sessions.expires_at AS expiresAt
        FROM auth_sessions
        INNER JOIN auth_users ON auth_users.id = auth_sessions.user_id
        WHERE auth_sessions.user_id = ?
        ORDER BY auth_sessions.updated_at DESC, auth_sessions.created_at DESC
        LIMIT 100
      `,
      [authUserId]
    );

    return Array.isArray(rows)
      ? (rows as SessionRow[]).map((row) => mapSessionRow(row, currentSessionId))
      : [];
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
