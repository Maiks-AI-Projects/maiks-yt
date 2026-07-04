import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  YouTubeChannelDiscoveryActor,
  YouTubeChannelDiscoveryRepository,
  YouTubeChannelDiscoveryStoredCredential,
  YouTubePersistedChannel,
  YouTubePersistedChannelInput
} from "./youtube-channel-discovery.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type TransactionExecutor = Pick<Awaited<ReturnType<DatabasePool["getConnection"]>>, "execute">;

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

const toIso = (value: unknown): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

const mapChannelRow = (row: {
  providerChannelId: string;
  displayName: string;
  handle: string | null;
  thumbnailUrl: string | null;
  selectedForLiveChat: 0 | 1 | boolean;
  discoveredAt: unknown;
  lastSeenAt: unknown;
  selectedAt: unknown;
  updatedAt: unknown;
}): YouTubePersistedChannel => ({
  id: row.providerChannelId,
  title: row.displayName,
  customUrl: row.handle ?? null,
  thumbnailUrl: row.thumbnailUrl ?? null,
  selectedForLiveChat: row.selectedForLiveChat === true || row.selectedForLiveChat === 1,
  discoveredAt: toIso(row.discoveredAt) ?? new Date(0).toISOString(),
  lastSeenAt: toIso(row.lastSeenAt) ?? new Date(0).toISOString(),
  selectedAt: toIso(row.selectedAt),
  updatedAt: toIso(row.updatedAt)
});

const listYouTubeChannels = async (
  executor: QueryExecutor,
  domainUserId: string
): Promise<YouTubePersistedChannel[]> => {
  const [rows] = await executor.execute(
    `
      SELECT
        provider_channel_id AS providerChannelId,
        display_name AS displayName,
        handle,
        thumbnail_url AS thumbnailUrl,
        selected_for_live_chat AS selectedForLiveChat,
        discovered_at AS discoveredAt,
        last_seen_at AS lastSeenAt,
        selected_at AS selectedAt,
        updated_at AS updatedAt
      FROM provider_channel_identities
      WHERE owner_user_id = ?
        AND provider = 'youtube'
      ORDER BY selected_for_live_chat DESC, display_name ASC, provider_channel_id ASC
    `,
    [domainUserId]
  );

  return Array.isArray(rows)
    ? (rows as Parameters<typeof mapChannelRow>[0][]).map(mapChannelRow)
    : [];
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

const upsertYouTubeChannels = async (
  executor: TransactionExecutor,
  input: {
    domainUserId: string;
    channels: readonly YouTubePersistedChannelInput[];
    now: Date;
  }
): Promise<void> => {
  for (const channel of input.channels) {
    await executor.execute(
      `
        INSERT INTO provider_channel_identities (
          id,
          owner_user_id,
          provider,
          provider_channel_id,
          display_name,
          handle,
          thumbnail_url,
          selected_for_live_chat,
          discovered_at,
          last_seen_at,
          selected_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'youtube', ?, ?, ?, ?, false, ?, ?, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE
          display_name = VALUES(display_name),
          handle = VALUES(handle),
          thumbnail_url = VALUES(thumbnail_url),
          last_seen_at = VALUES(last_seen_at),
          updated_at = VALUES(updated_at)
      `,
      [
        randomUUID(),
        input.domainUserId,
        channel.id,
        channel.title,
        channel.customUrl,
        channel.thumbnailUrl,
        input.now,
        input.now,
        input.now,
        input.now
      ]
    );
  }
};

const selectYouTubeLiveChatChannel = async (
  executor: TransactionExecutor,
  input: {
    domainUserId: string;
    providerChannelId: string | null;
    now: Date;
  }
): Promise<"selected" | "cleared" | "not_found"> => {
  await executor.execute(
    `
      UPDATE provider_channel_identities
      SET selected_for_live_chat = false,
        selected_at = NULL,
        updated_at = ?
      WHERE owner_user_id = ?
        AND provider = 'youtube'
        AND selected_for_live_chat = true
    `,
    [input.now, input.domainUserId]
  );

  if (!input.providerChannelId) {
    return "cleared";
  }

  const [result] = await executor.execute(
    `
      UPDATE provider_channel_identities
      SET selected_for_live_chat = true,
        selected_at = ?,
        updated_at = ?
      WHERE owner_user_id = ?
        AND provider = 'youtube'
        AND provider_channel_id = ?
    `,
    [input.now, input.now, input.domainUserId, input.providerChannelId]
  );
  const affectedRows = typeof result === "object"
    && result !== null
    && "affectedRows" in result
    && typeof result.affectedRows === "number"
      ? result.affectedRows
      : 0;

  return affectedRows > 0 ? "selected" : "not_found";
};

export const createYouTubeChannelDiscoveryRepository = (
  pool: DatabasePool
): YouTubeChannelDiscoveryRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId),
  getActiveYouTubeCredential: (domainUserId) => getActiveYouTubeCredential(pool, domainUserId),
  listYouTubeChannels: (domainUserId) => listYouTubeChannels(pool, domainUserId),
  async upsertYouTubeChannels(input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await upsertYouTubeChannels(connection, input);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  async selectYouTubeLiveChatChannel(input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await selectYouTubeLiveChatChannel(connection, input);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
});
