import type { DatabasePool } from "@maiks-yt/database";

import type {
  YouTubePubSubSelectedChannel,
  YouTubePubSubSubscriptionActor,
  YouTubePubSubSubscriptionRepository
} from "./youtube-pubsub-subscriptions.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<YouTubePubSubSubscriptionActor | null> => {
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

const getSelectedYouTubeChannel = async (
  executor: QueryExecutor,
  domainUserId: string
): Promise<YouTubePubSubSelectedChannel | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        provider_channel_id AS id,
        display_name AS title
      FROM provider_channel_identities
      WHERE owner_user_id = ?
        AND provider = 'youtube'
        AND selected_for_live_chat = true
      LIMIT 1
    `,
    [domainUserId]
  );
  const row = Array.isArray(rows)
    ? rows[0] as { id?: unknown; title?: unknown } | undefined
    : undefined;

  return typeof row?.id === "string" && typeof row.title === "string"
    ? {
      id: row.id,
      title: row.title
    }
    : null;
};

export const createYouTubePubSubSubscriptionRepository = (
  pool: DatabasePool
): YouTubePubSubSubscriptionRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId),
  getSelectedYouTubeChannel: (domainUserId) => getSelectedYouTubeChannel(pool, domainUserId)
});
