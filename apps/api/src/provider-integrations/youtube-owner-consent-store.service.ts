import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  ProviderRuntimeCredentialActor,
  ProviderRuntimeCredentialSummary,
  YouTubeOwnerConsentRepository
} from "./youtube-owner-consent.types.js";

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

const toIso = (value: unknown): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.length > 0) {
    return new Date(value).toISOString();
  }

  return null;
};

const mapCredentialRow = (row: {
  status: "active" | "revoked" | "error";
  displayName: string | null;
  scopes: unknown;
  lastVerifiedAt: unknown;
  lastError: string | null;
  updatedAt: unknown;
}): ProviderRuntimeCredentialSummary => ({
  provider: "youtube",
  purpose: "youtube_live_chat",
  status: row.status,
  displayName: row.displayName ?? null,
  scopes: parseScopes(row.scopes),
  lastVerifiedAt: toIso(row.lastVerifiedAt),
  lastError: row.lastError ?? null,
  updatedAt: toIso(row.updatedAt)
});

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<ProviderRuntimeCredentialActor | null> => {
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

const getYouTubeCredentialSummary = async (
  executor: QueryExecutor,
  domainUserId: string
): Promise<ProviderRuntimeCredentialSummary | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        status,
        display_name AS displayName,
        scopes,
        last_verified_at AS lastVerifiedAt,
        last_error AS lastError,
        updated_at AS updatedAt
      FROM provider_runtime_credentials
      WHERE owner_user_id = ?
        AND provider = 'youtube'
        AND purpose = 'youtube_live_chat'
      LIMIT 1
    `,
    [domainUserId]
  );
  const row = Array.isArray(rows)
    ? rows[0] as Parameters<typeof mapCredentialRow>[0] | undefined
    : undefined;

  return row ? mapCredentialRow(row) : null;
};

export const createYouTubeOwnerConsentRepository = (
  pool: QueryExecutor
): YouTubeOwnerConsentRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId),
  getYouTubeCredentialSummary: (domainUserId) => getYouTubeCredentialSummary(pool, domainUserId),
  async upsertYouTubeCredential(input) {
    const now = input.verifiedAt;

    await pool.execute(
      `
        INSERT INTO provider_runtime_credentials (
          id,
          owner_user_id,
          provider,
          purpose,
          status,
          scopes,
          access_token,
          refresh_token,
          access_token_expires_at,
          last_verified_at,
          last_error,
          revoked_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'youtube', 'youtube_live_chat', 'active', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = 'active',
          scopes = VALUES(scopes),
          access_token = VALUES(access_token),
          refresh_token = VALUES(refresh_token),
          access_token_expires_at = VALUES(access_token_expires_at),
          last_verified_at = VALUES(last_verified_at),
          last_error = NULL,
          revoked_at = NULL,
          updated_at = VALUES(updated_at)
      `,
      [
        randomUUID(),
        input.domainUserId,
        JSON.stringify([...input.scopes]),
        input.accessToken,
        input.refreshToken,
        input.accessTokenExpiresAt,
        now,
        now,
        now
      ]
    );

    return await getYouTubeCredentialSummary(pool, input.domainUserId) ?? {
      provider: "youtube",
      purpose: "youtube_live_chat",
      status: "active",
      displayName: null,
      scopes: [...input.scopes],
      lastVerifiedAt: now.toISOString(),
      lastError: null,
      updatedAt: now.toISOString()
    };
  }
});
