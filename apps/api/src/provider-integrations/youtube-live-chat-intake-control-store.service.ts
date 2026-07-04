import type { DatabasePool } from "@maiks-yt/database";
import {
  resolveYouTubeOwnerOAuthConfig,
  youtubeLiveChatReadOnlyScope,
  type YouTubeLiveChatContext
} from "@maiks-yt/integrations";

import type {
  YouTubeLiveChatContextRepository,
  YouTubeLiveChatIntakeControlActor,
  YouTubeLiveChatIntakeControlRepository
} from "./youtube-live-chat-intake-control.types.js";

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
  pool: QueryExecutor,
  authUserId: string
): Promise<YouTubeLiveChatIntakeControlActor | null> => {
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

const resolveSelectedLiveChatContext = async (
  pool: QueryExecutor,
  env: Record<string, string | undefined>,
  fallbackRedirectUri: string
): Promise<YouTubeLiveChatContext | null> => {
  const config = resolveYouTubeOwnerOAuthConfig(env, fallbackRedirectUri);

  if (!config.ok) {
    return null;
  }

  const [rows] = await pool.execute(
    `
      SELECT
        credentials.access_token AS accessToken,
        credentials.refresh_token AS refreshToken,
        credentials.access_token_expires_at AS accessTokenExpiresAt,
        credentials.scopes,
        channels.provider_channel_id AS channelId,
        channels.display_name AS channelName,
        channels.handle AS channelHandle
      FROM provider_channel_identities channels
      INNER JOIN provider_runtime_credentials credentials
        ON credentials.owner_user_id = channels.owner_user_id
        AND credentials.provider = 'youtube'
        AND credentials.purpose = 'youtube_live_chat'
        AND credentials.status = 'active'
        AND credentials.revoked_at IS NULL
      WHERE channels.provider = 'youtube'
        AND channels.selected_for_live_chat = true
      ORDER BY channels.updated_at DESC
      LIMIT 1
    `
  );
  const row = Array.isArray(rows)
    ? rows[0] as {
      accessToken: string | null;
      refreshToken: string | null;
      accessTokenExpiresAt: unknown;
      scopes: unknown;
      channelId: string;
      channelName: string;
      channelHandle: string | null;
    } | undefined
    : undefined;

  if (!row?.refreshToken || !parseScopes(row.scopes).includes(youtubeLiveChatReadOnlyScope)) {
    return null;
  }

  return {
    config,
    credential: {
      accessToken: row.accessToken ?? null,
      refreshToken: row.refreshToken,
      accessTokenExpiresAt: toDateOrNull(row.accessTokenExpiresAt)
    },
    selectedChannel: {
      id: row.channelId,
      title: row.channelName,
      customUrl: row.channelHandle ?? null
    }
  };
};

export const createYouTubeLiveChatIntakeControlRepository = (
  pool: DatabasePool
): YouTubeLiveChatIntakeControlRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId)
});

export const createYouTubeLiveChatContextRepository = (
  pool: DatabasePool,
  options: {
    apiBaseUrl?: string;
    env?: Record<string, string | undefined>;
  } = {}
): YouTubeLiveChatContextRepository => ({
  resolveSelectedLiveChatContext: () => resolveSelectedLiveChatContext(
    pool,
    options.env ?? process.env,
    new URL(
      "/admin/provider-integrations/youtube/callback",
      options.apiBaseUrl ?? process.env.API_PUBLIC_BASE_URL ?? "https://api-dev.maiks.yt"
    ).toString()
  )
});
