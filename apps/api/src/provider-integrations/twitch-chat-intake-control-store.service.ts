import type { DatabasePool } from "@maiks-yt/database";

import type {
  TwitchChatIntakeControlActor,
  TwitchChatIntakeControlRepository
} from "./twitch-chat-intake-control.types.js";

const resolveActor = async (
  pool: DatabasePool,
  authUserId: string
): Promise<TwitchChatIntakeControlActor | null> => {
  const [rows] = await pool.execute(
    `SELECT
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
      ORDER BY roles.key`,
    [authUserId]
  );
  const actorRows = Array.isArray(rows)
    ? rows as Array<{ domainUserId: string; rolePermissions: unknown }>
    : [];
  const domainUserId = actorRows[0]?.domainUserId;

  if (!domainUserId) {
    return null;
  }

  return {
    domainUserId,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

export const createTwitchChatIntakeControlRepository = (
  pool: DatabasePool
): TwitchChatIntakeControlRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId)
});
