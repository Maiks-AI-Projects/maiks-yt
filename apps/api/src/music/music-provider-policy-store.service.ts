import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type { MusicProviderPolicyRecord, MusicRepository } from "./music.types.js";
import { bool, mapRows, optionalText, toIso, toIsoOrNull, type QueryExecutor } from "./music-store-shared.service.js";

type ProviderPolicyRow = {
  id: string;
  providerKey: string;
  displayName: string;
  providerType: string;
  providerStatus: string;
  rightsState: MusicProviderPolicyRecord["rightsState"];
  publicRequestsEnabled: boolean | number;
  publicPlaybackEnabled: boolean | number;
  defaultLiveSafe: boolean | number;
  defaultVodSafe: boolean | number;
  attributionRequired: boolean | number;
  localCacheAllowed: boolean | number;
  policyUrl?: string | null;
  termsUrl?: string | null;
  notesPrivate?: string | null;
  effectiveFrom: Date | string;
  effectiveUntil?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};


export const mapPolicy = (row: ProviderPolicyRow): MusicProviderPolicyRecord => ({
  id: row.id,
  providerKey: row.providerKey,
  displayName: row.displayName,
  providerType: row.providerType,
  providerStatus: row.providerStatus,
  rightsState: row.rightsState,
  publicRequestsEnabled: bool(row.publicRequestsEnabled),
  publicPlaybackEnabled: bool(row.publicPlaybackEnabled),
  defaultLiveSafe: bool(row.defaultLiveSafe),
  defaultVodSafe: bool(row.defaultVodSafe),
  attributionRequired: bool(row.attributionRequired),
  localCacheAllowed: bool(row.localCacheAllowed),
  policyUrl: row.policyUrl ?? null,
  termsUrl: row.termsUrl ?? null,
  notesPrivate: row.notesPrivate ?? null,
  effectiveFrom: toIso(row.effectiveFrom),
  effectiveUntil: toIsoOrNull(row.effectiveUntil),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});


export const readPolicy = async (executor: QueryExecutor, id: string): Promise<MusicProviderPolicyRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id, provider_key AS providerKey, display_name AS displayName,
        provider_type AS providerType, provider_status AS providerStatus, rights_state AS rightsState,
        public_requests_enabled AS publicRequestsEnabled, public_playback_enabled AS publicPlaybackEnabled,
        default_live_safe AS defaultLiveSafe, default_vod_safe AS defaultVodSafe,
        attribution_required AS attributionRequired, local_cache_allowed AS localCacheAllowed,
        policy_url AS policyUrl, terms_url AS termsUrl, notes_private AS notesPrivate,
        effective_from AS effectiveFrom, effective_until AS effectiveUntil,
        created_at AS createdAt, updated_at AS updatedAt
      FROM music_provider_policies
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  const row = Array.isArray(rows) ? rows[0] as ProviderPolicyRow | undefined : undefined;

  return row ? mapPolicy(row) : null;
};


export const createMusicProviderPolicyRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "listProviderPolicies"
  | "providerPolicyMatchesKey"
  | "createProviderPolicy"
  | "updateProviderPolicy"
> => ({
  async providerPolicyMatchesKey(input) {
    const [rows] = await pool.execute(
      `
        SELECT id
        FROM music_provider_policies
        WHERE id = ? AND LOWER(provider_key) = LOWER(?)
        LIMIT 1
      `,
      [input.id, input.providerKey.trim()]
    );

    return Array.isArray(rows) && rows.length === 1;
  },

  async listProviderPolicies() {
    const [rows] = await pool.execute(
      `
        SELECT
          id, provider_key AS providerKey, display_name AS displayName,
          provider_type AS providerType, provider_status AS providerStatus, rights_state AS rightsState,
          public_requests_enabled AS publicRequestsEnabled, public_playback_enabled AS publicPlaybackEnabled,
          default_live_safe AS defaultLiveSafe, default_vod_safe AS defaultVodSafe,
          attribution_required AS attributionRequired, local_cache_allowed AS localCacheAllowed,
          policy_url AS policyUrl, terms_url AS termsUrl, notes_private AS notesPrivate,
          effective_from AS effectiveFrom, effective_until AS effectiveUntil,
          created_at AS createdAt, updated_at AS updatedAt
        FROM music_provider_policies
        ORDER BY display_name, provider_key
      `
    );

    return mapRows<ProviderPolicyRow, MusicProviderPolicyRecord>(rows, mapPolicy);
  },

  async createProviderPolicy(input) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO music_provider_policies
          (id, provider_key, display_name, provider_type, provider_status, rights_state,
            public_requests_enabled, public_playback_enabled, default_live_safe, default_vod_safe,
            attribution_required, local_cache_allowed, policy_url, terms_url, notes_private,
            effective_until, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.providerKey.trim(),
        input.displayName.trim(),
        input.providerType ?? "catalog",
        input.providerStatus ?? "limited",
        input.rightsState ?? "uncertain",
        input.publicRequestsEnabled ?? false,
        input.publicPlaybackEnabled ?? false,
        input.defaultLiveSafe ?? false,
        input.defaultVodSafe ?? false,
        input.attributionRequired ?? true,
        input.localCacheAllowed ?? false,
        optionalText(input.policyUrl),
        optionalText(input.termsUrl),
        optionalText(input.notesPrivate),
        input.effectiveUntil ? new Date(input.effectiveUntil) : null,
        input.actorUserId
      ]
    );
    const policy = await readPolicy(pool, id);

    if (!policy) {
      throw new Error("music_provider_policy_reread_failed");
    }

    return policy;
  },

  async updateProviderPolicy(input) {
    const existing = await readPolicy(pool, input.id);

    if (!existing) {
      return null;
    }

    await pool.execute(
      `
        UPDATE music_provider_policies
        SET provider_key = ?, display_name = ?, provider_type = ?, provider_status = ?,
          rights_state = ?, public_requests_enabled = ?, public_playback_enabled = ?,
          default_live_safe = ?, default_vod_safe = ?, attribution_required = ?,
          local_cache_allowed = ?, policy_url = ?, terms_url = ?, notes_private = ?,
          effective_until = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        input.providerKey.trim(),
        input.displayName.trim(),
        input.providerType ?? existing.providerType,
        input.providerStatus ?? existing.providerStatus,
        input.rightsState ?? existing.rightsState,
        input.publicRequestsEnabled ?? existing.publicRequestsEnabled,
        input.publicPlaybackEnabled ?? existing.publicPlaybackEnabled,
        input.defaultLiveSafe ?? existing.defaultLiveSafe,
        input.defaultVodSafe ?? existing.defaultVodSafe,
        input.attributionRequired ?? existing.attributionRequired,
        input.localCacheAllowed ?? existing.localCacheAllowed,
        optionalText(input.policyUrl) ?? existing.policyUrl,
        optionalText(input.termsUrl) ?? existing.termsUrl,
        optionalText(input.notesPrivate) ?? existing.notesPrivate,
        input.effectiveUntil ? new Date(input.effectiveUntil) : existing.effectiveUntil,
        input.id
      ]
    );

    return await readPolicy(pool, input.id);
  },

});
