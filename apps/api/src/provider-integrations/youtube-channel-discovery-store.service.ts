import type { DatabasePool } from "@maiks-yt/database";

import type {
  YouTubeChannelDiscoveryActor,
  YouTubeChannelDiscoveryRepository,
  YouTubeChannelDiscoveryStoredCredential
} from "./youtube-channel-discovery.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

const parseScopes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((scope): scope is string => typeof scope === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : [];
  } catch {
    return [];
  }
};

const toDateOrNull = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<YouTubeChannelDiscoveryActor | null> => {
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

const getActiveYouTubeCredential = async (
  executor: QueryExecutor,
  domainUserId: string
): Promise<YouTubeChannelDiscoveryStoredCredential | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        status,
        scopes,
        access_token AS accessToken,
        refresh_token AS refreshToken,
        access_token_expires_at AS accessTokenExpiresAt,
        last_error AS lastError
      FROM provider_runtime_credentials
      WHERE owner_user_id = ?
        AND provider = 'youtube'
        AND purpose = 'youtube_live_chat'
        AND status = 'active'
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [domainUserId]
  );
  const row = Array.isArray(rows)
    ? rows[0] as {
      status: "active" | "revoked" | "error";
      scopes: unknown;
      accessToken: string | null;
      refreshToken: string | null;
      accessTokenExpiresAt: unknown;
      lastError: string | null;
    } | undefined
    : undefined;

  if (!row?.refreshToken) {
    return null;
  }

  return {
    accessToken: row.accessToken ?? null,
    refreshToken: row.refreshToken,
    accessTokenExpiresAt: toDateOrNull(row.accessTokenExpiresAt),
    scopes: parseScopes(row.scopes),
    status: row.status,
    lastError: row.lastError ?? null
  };
};

export const createYouTubeChannelDiscoveryRepository = (
  pool: QueryExecutor
): YouTubeChannelDiscoveryRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId),
  getActiveYouTubeCredential: (domainUserId) => getActiveYouTubeCredential(pool, domainUserId)
});
