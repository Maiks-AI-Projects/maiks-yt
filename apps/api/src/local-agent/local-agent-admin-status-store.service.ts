import type { DatabasePool } from "@maiks-yt/database";

import type {
  LocalAgentAdminStatusActor,
  LocalAgentAdminStatusRepository
} from "./local-agent-admin-status.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<LocalAgentAdminStatusActor | null> => {
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

export const createLocalAgentAdminStatusRepository = (
  pool: QueryExecutor
): LocalAgentAdminStatusRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId)
});
