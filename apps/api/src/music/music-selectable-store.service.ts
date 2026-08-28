import type { DatabasePool } from "@maiks-yt/database";

import type { MusicRepository, MusicSelectableTrack } from "./music.types.js";
import { publicMusicSelectionReferenceSql } from "./music-public-selection-reference.service.js";
import { bool, mapRows, parseStringArray, type QueryExecutor } from "./music-store-shared.service.js";

type SelectableRow = {
  trackId: string;
  sourceId: string;
  title: string;
  artist: string;
  durationSeconds?: number | null;
  providerKey: string;
  providerName: string;
  sourceType: string;
  sourceLabel: string;
  sourceExternalId?: string | null;
  previewUrl?: string | null;
  previewMimeType?: string | null;
  sourceUrl?: string | null;
  sourceStorageRef?: string | null;
  sourceSha256?: string | null;
  attributionText?: string | null;
  licenseName?: string | null;
  licenseKind?: string | null;
  licenseUrl?: string | null;
  providerPolicyUrl?: string | null;
  providerTermsUrl?: string | null;
  providerPolicyState: "allowed" | "review-only" | "disabled";
  eligibilityState: MusicSelectableTrack["eligibilityState"];
  reviewState: MusicSelectableTrack["reviewState"];
  liveSafe: boolean | number;
  vodSafe: boolean | number;
  safetyTags: unknown;
  explicitContent: boolean | number;
  instrumental: boolean | number;
  hasActiveBlacklist: boolean | number;
};


export const mapSelectable = (row: SelectableRow): MusicSelectableTrack => ({
  id: row.trackId,
  trackId: row.trackId,
  sourceId: row.sourceId,
  title: row.title,
  artist: row.artist,
  durationSeconds: row.durationSeconds ?? null,
  providerKey: row.providerKey,
  providerName: row.providerName,
  sourceType: row.sourceType,
  sourceLabel: row.sourceLabel,
  sourceExternalId: row.sourceExternalId ?? null,
  previewUrl: row.previewUrl ?? null,
  previewMimeType: row.previewMimeType ?? null,
  sourceUrl: row.sourceUrl ?? null,
  sourceStorageRef: row.sourceStorageRef ?? null,
  sourceSha256: row.sourceSha256 ?? null,
  safetyTags: parseStringArray(row.safetyTags),
  explicitContent: bool(row.explicitContent),
  instrumental: bool(row.instrumental),
  attributionText: row.attributionText ?? null,
  licenseName: row.licenseName ?? "Unknown license",
  licenseKind: row.licenseKind ?? "unknown",
  licenseUrl: row.licenseUrl ?? null,
  providerPolicyUrl: row.providerPolicyUrl ?? null,
  providerTermsUrl: row.providerTermsUrl ?? null,
  providerPolicyState: row.providerPolicyState,
  eligibilityState: row.eligibilityState,
  reviewState: row.reviewState,
  liveSafe: bool(row.liveSafe),
  vodSafe: bool(row.vodSafe),
  hasActiveBlacklist: bool(row.hasActiveBlacklist)
});


export const selectSelectableFields = `
  tracks.id AS trackId,
  sources.id AS sourceId,
  tracks.title,
  tracks.artist,
  COALESCE(sources.duration_seconds, tracks.duration_seconds) AS durationSeconds,
  sources.provider_key AS providerKey,
  policies.display_name AS providerName,
  sources.source_type AS sourceType,
  sources.source_label AS sourceLabel,
  sources.source_external_id AS sourceExternalId,
  sources.preview_url AS previewUrl,
  sources.preview_mime_type AS previewMimeType,
  sources.source_url AS sourceUrl,
  sources.storage_ref AS sourceStorageRef,
  sources.sha256 AS sourceSha256,
  COALESCE(licenses.attribution_text, sources.attribution_text) AS attributionText,
  licenses.license_name AS licenseName,
  licenses.license_kind AS licenseKind,
  licenses.proof_url AS licenseUrl,
  policies.policy_url AS providerPolicyUrl,
  policies.terms_url AS providerTermsUrl,
  CASE
    WHEN policies.provider_status = 'allowed' THEN 'allowed'
    WHEN policies.provider_status = 'limited' THEN 'review-only'
    ELSE 'disabled'
  END AS providerPolicyState,
  CASE
    WHEN tracks.rights_state = 'eligible'
      AND sources.rights_state = 'eligible'
      AND policies.rights_state = 'eligible'
      AND licenses.rights_state = 'eligible'
    THEN 'eligible'
    WHEN tracks.rights_state = 'ineligible'
      OR sources.rights_state = 'ineligible'
      OR policies.rights_state = 'ineligible'
      OR licenses.rights_state = 'ineligible'
    THEN 'ineligible'
    ELSE 'uncertain'
  END AS eligibilityState,
  tracks.review_state AS reviewState,
  tracks.live_safe AS liveSafe,
  tracks.vod_safe AS vodSafe,
  tracks.safety_tags AS safetyTags,
  tracks.explicit_content AS explicitContent,
  tracks.instrumental AS instrumental,
  EXISTS (
    SELECT 1
    FROM music_blacklist_entries blacklist
    WHERE blacklist.revoked_at IS NULL
      AND (
        (blacklist.scope = 'track' AND blacklist.track_id = tracks.id)
        OR (blacklist.scope = 'source' AND blacklist.source_id = sources.id)
        OR (blacklist.scope = 'provider' AND blacklist.provider_key = sources.provider_key)
        OR (blacklist.scope = 'artist' AND blacklist.normalized_value = LOWER(TRIM(tracks.artist)))
        OR (blacklist.scope = 'external_id' AND sources.source_external_id IS NOT NULL AND blacklist.normalized_value = LOWER(TRIM(sources.source_external_id)))
        OR (blacklist.scope = 'keyword' AND LOCATE(blacklist.normalized_value, LOWER(CONCAT(tracks.title, ' ', tracks.artist))) > 0)
      )
  ) AS hasActiveBlacklist
`;

export const selectableFromClause = `
  FROM music_tracks tracks
  INNER JOIN music_track_sources sources
    ON sources.track_id = tracks.id
  INNER JOIN music_provider_policies policies
    ON (
      (sources.provider_policy_id IS NOT NULL AND policies.id = sources.provider_policy_id)
      OR (
        sources.provider_policy_id IS NULL
        AND policies.provider_key = sources.provider_key
        AND (
          SELECT COUNT(*)
          FROM music_provider_policies fallback_policies
          WHERE fallback_policies.provider_key = sources.provider_key
            AND fallback_policies.effective_from <= NOW()
            AND (fallback_policies.effective_until IS NULL OR fallback_policies.effective_until > NOW())
        ) = 1
      )
    )
    AND policies.effective_from <= NOW()
    AND (policies.effective_until IS NULL OR policies.effective_until > NOW())
  INNER JOIN music_license_snapshots licenses
    ON licenses.id = (
      SELECT latest_licenses.id
      FROM music_license_snapshots latest_licenses
      WHERE latest_licenses.source_id = sources.id
        AND (latest_licenses.valid_from IS NULL OR latest_licenses.valid_from <= NOW())
        AND (latest_licenses.valid_until IS NULL OR latest_licenses.valid_until > NOW())
      ORDER BY latest_licenses.captured_at DESC
      LIMIT 1
    )
`;


export const readSelectableTrack = async (
  executor: QueryExecutor,
  input: {
    trackId: string;
    sourceId: string | null;
    context: "live" | "vod";
    requirePublicRequest: boolean;
  }
): Promise<MusicSelectableTrack | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectSelectableFields}
      ${selectableFromClause}
      WHERE tracks.id = ?
        AND (? IS NULL OR sources.id = ?)
        AND sources.availability_status = 'available'
        AND policies.provider_status = 'allowed'
        AND (
          (? = TRUE AND policies.public_requests_enabled = TRUE)
          OR (? = FALSE AND policies.public_playback_enabled = TRUE)
        )
        AND ((? = 'live' AND tracks.live_safe = TRUE AND licenses.live_safe = TRUE)
          OR (? = 'vod' AND tracks.vod_safe = TRUE AND licenses.vod_safe = TRUE))
      ORDER BY sources.created_at DESC
      LIMIT 1
    `,
    [
      input.trackId,
      input.sourceId,
      input.sourceId,
      input.requirePublicRequest,
      input.requirePublicRequest,
      input.context,
      input.context
    ]
  );
  const row = Array.isArray(rows) ? rows[0] as SelectableRow | undefined : undefined;

  return row ? mapSelectable(row) : null;
};

export const readPublicCatalogSelection = async (
  executor: QueryExecutor,
  input: {
    selectionReference: string;
    context: "live" | "vod";
    lockForUpdate?: boolean;
  }
): Promise<MusicSelectableTrack | "ambiguous" | null> => {
  const selectionReferenceExpression = publicMusicSelectionReferenceSql("tracks.id", "sources.id");
  const [rows] = await executor.execute(
    `
      SELECT ${selectSelectableFields},
        ${selectionReferenceExpression} AS publicSelectionReference
      ${selectableFromClause}
      WHERE sources.availability_status = 'available'
        AND policies.provider_status = 'allowed'
        AND policies.public_requests_enabled = TRUE
        AND tracks.rights_state = 'eligible'
        AND sources.rights_state = 'eligible'
        AND policies.rights_state = 'eligible'
        AND licenses.rights_state = 'eligible'
        AND tracks.review_state IN ('unreviewed', 'approved')
        AND ((? = 'live' AND tracks.live_safe = TRUE AND licenses.live_safe = TRUE)
          OR (? = 'vod' AND tracks.vod_safe = TRUE AND licenses.vod_safe = TRUE))
      HAVING hasActiveBlacklist = 0
        AND publicSelectionReference = BINARY ?
      ORDER BY tracks.title, tracks.artist, sources.created_at DESC
      LIMIT 2${input.lockForUpdate ? "\n      FOR UPDATE" : ""}
    `,
    [input.context, input.context, input.selectionReference]
  );
  const matches = mapRows<SelectableRow, MusicSelectableTrack>(rows, mapSelectable);

  if (matches.length !== 1) {
    return matches.length > 1 ? "ambiguous" : null;
  }

  return matches[0] ?? null;
};

export const readAdminPreviewTrack = async (
  executor: QueryExecutor,
  input: {
    trackId: string;
    sourceId: string | null;
  }
): Promise<MusicSelectableTrack | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectSelectableFields}
      ${selectableFromClause}
      WHERE tracks.id = ?
        AND (? IS NULL OR sources.id = ?)
        AND sources.availability_status = 'available'
        AND policies.provider_status IN ('allowed', 'limited')
        AND tracks.rights_state <> 'ineligible'
        AND sources.rights_state <> 'ineligible'
        AND policies.rights_state <> 'ineligible'
        AND licenses.rights_state <> 'ineligible'
        AND sources.preview_url IS NOT NULL
        AND TRIM(sources.preview_url) <> ''
        AND sources.preview_mime_type IS NOT NULL
        AND TRIM(sources.preview_mime_type) <> ''
      HAVING hasActiveBlacklist = 0
      ORDER BY sources.created_at DESC
      LIMIT 1
    `,
    [input.trackId, input.sourceId, input.sourceId]
  );
  const row = Array.isArray(rows) ? rows[0] as SelectableRow | undefined : undefined;

  return row ? mapSelectable(row) : null;
};

export const readHistorySnapshotTrack = async (
  executor: QueryExecutor,
  input: {
    trackId: string;
    sourceId: string | null;
  }
): Promise<MusicSelectableTrack | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectSelectableFields}
      ${selectableFromClause}
      WHERE tracks.id = ?
        AND (? IS NULL OR sources.id = ?)
      ORDER BY sources.created_at DESC
      LIMIT 1
    `,
    [input.trackId, input.sourceId, input.sourceId]
  );
  const row = Array.isArray(rows) ? rows[0] as SelectableRow | undefined : undefined;

  return row ? mapSelectable(row) : null;
};

export const createMusicSelectableRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "listPublicCatalog"
  | "listPlaybackCatalog"
  | "getSelectableTrack"
  | "getPublicCatalogSelection"
  | "getAdminPreviewTrack"
> => ({
  async listPublicCatalog(input) {
    const query = input.query ? `%${input.query.toLowerCase()}%` : null;
    const [rows] = await pool.execute(
      `
        SELECT ${selectSelectableFields}
        ${selectableFromClause}
        WHERE sources.availability_status = 'available'
          AND policies.provider_status = 'allowed'
          AND policies.public_requests_enabled = TRUE
          AND tracks.rights_state = 'eligible'
          AND sources.rights_state = 'eligible'
          AND policies.rights_state = 'eligible'
          AND licenses.rights_state = 'eligible'
          AND tracks.review_state IN ('unreviewed', 'approved')
          AND ((? = 'live' AND tracks.live_safe = TRUE AND licenses.live_safe = TRUE)
            OR (? = 'vod' AND tracks.vod_safe = TRUE AND licenses.vod_safe = TRUE))
          AND (? IS NULL OR LOWER(CONCAT(tracks.title, ' ', tracks.artist, ' ', sources.provider_key)) LIKE ?)
        HAVING hasActiveBlacklist = 0
        ORDER BY tracks.title, tracks.artist
        LIMIT ?
      `,
      [input.context, input.context, query, query, input.limit]
    );

    return mapRows<SelectableRow, MusicSelectableTrack>(rows, mapSelectable);
  },

  async listPlaybackCatalog(input) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectSelectableFields}
        ${selectableFromClause}
        WHERE sources.availability_status = 'available'
          AND policies.provider_status = 'allowed'
          AND policies.public_playback_enabled = TRUE
          AND tracks.rights_state = 'eligible'
          AND sources.rights_state = 'eligible'
          AND policies.rights_state = 'eligible'
          AND licenses.rights_state = 'eligible'
          AND tracks.review_state IN ('unreviewed', 'approved')
          AND ((? = 'live' AND tracks.live_safe = TRUE AND licenses.live_safe = TRUE)
            OR (? = 'vod' AND tracks.vod_safe = TRUE AND licenses.vod_safe = TRUE))
        HAVING hasActiveBlacklist = 0
        ORDER BY tracks.title, tracks.artist, sources.created_at DESC
        LIMIT ?
      `,
      [input.context, input.context, input.limit]
    );

    return mapRows<SelectableRow, MusicSelectableTrack>(rows, mapSelectable);
  },

  async getSelectableTrack(input) {
    return await readSelectableTrack(pool, input);
  },

  async getPublicCatalogSelection(input) {
    return await readPublicCatalogSelection(pool, input);
  },

  async getAdminPreviewTrack(input) {
    return await readAdminPreviewTrack(pool, input);
  }
});
