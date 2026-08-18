import type {
  MusicLicenseSnapshotRecord,
  MusicTrackAdminRecord,
  MusicTrackSourceRecord
} from "./music.types.js";
import { bool, mapRows, parseStringArray, toIso, toIsoOrNull, type QueryExecutor } from "./music-store-shared.service.js";

export type TrackRow = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  album?: string | null;
  durationSeconds?: number | null;
  isrc?: string | null;
  rightsState: MusicTrackAdminRecord["rightsState"];
  reviewState: MusicTrackAdminRecord["reviewState"];
  liveSafe: boolean | number;
  vodSafe: boolean | number;
  explicitContent: boolean | number;
  instrumental: boolean | number;
  safetyTags: unknown;
  notesPrivate?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SourceRow = {
  id: string;
  trackId: string;
  providerPolicyId?: string | null;
  providerKey: string;
  sourceType: string;
  sourceLabel: string;
  sourceExternalId?: string | null;
  sourceUrl?: string | null;
  previewUrl?: string | null;
  previewMimeType?: string | null;
  storageRef?: string | null;
  sha256?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  rightsState: MusicTrackSourceRecord["rightsState"];
  availabilityStatus: string;
  attributionText?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type LicenseRow = {
  id: string;
  trackId: string;
  sourceId: string;
  providerPolicyId?: string | null;
  licenseName: string;
  licenseKind: string;
  rightsState: MusicLicenseSnapshotRecord["rightsState"];
  liveSafe: boolean | number;
  vodSafe: boolean | number;
  attributionRequired: boolean | number;
  attributionText?: string | null;
  proofUrl?: string | null;
  proofStorageRef?: string | null;
  licensePayload?: unknown;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  capturedAt: Date | string;
};


export const mapTrack = (
  row: TrackRow,
  sources: readonly MusicTrackSourceRecord[] = [],
  licenses: readonly MusicLicenseSnapshotRecord[] = []
): MusicTrackAdminRecord => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  artist: row.artist,
  album: row.album ?? null,
  durationSeconds: row.durationSeconds ?? null,
  isrc: row.isrc ?? null,
  rightsState: row.rightsState,
  reviewState: row.reviewState,
  liveSafe: bool(row.liveSafe),
  vodSafe: bool(row.vodSafe),
  explicitContent: bool(row.explicitContent),
  instrumental: bool(row.instrumental),
  safetyTags: parseStringArray(row.safetyTags),
  notesPrivate: row.notesPrivate ?? null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  sources,
  licenseSnapshots: licenses
});

export const mapSource = (row: SourceRow): MusicTrackSourceRecord => ({
  id: row.id,
  trackId: row.trackId,
  providerPolicyId: row.providerPolicyId ?? null,
  providerKey: row.providerKey,
  sourceType: row.sourceType,
  sourceLabel: row.sourceLabel,
  sourceExternalId: row.sourceExternalId ?? null,
  sourceUrl: row.sourceUrl ?? null,
  previewUrl: row.previewUrl ?? null,
  previewMimeType: row.previewMimeType ?? null,
  storageRef: row.storageRef ?? null,
  sha256: row.sha256 ?? null,
  mimeType: row.mimeType ?? null,
  durationSeconds: row.durationSeconds ?? null,
  rightsState: row.rightsState,
  availabilityStatus: row.availabilityStatus,
  attributionText: row.attributionText ?? null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

export const mapLicense = (row: LicenseRow): MusicLicenseSnapshotRecord => ({
  id: row.id,
  trackId: row.trackId,
  sourceId: row.sourceId,
  providerPolicyId: row.providerPolicyId ?? null,
  licenseName: row.licenseName,
  licenseKind: row.licenseKind,
  rightsState: row.rightsState,
  liveSafe: bool(row.liveSafe),
  vodSafe: bool(row.vodSafe),
  attributionRequired: bool(row.attributionRequired),
  attributionText: row.attributionText ?? null,
  proofUrl: row.proofUrl ?? null,
  validFrom: toIsoOrNull(row.validFrom),
  validUntil: toIsoOrNull(row.validUntil),
  capturedAt: toIso(row.capturedAt)
});


export const readTrack = async (executor: QueryExecutor, id: string): Promise<MusicTrackAdminRecord | null> => {
  const [trackRows] = await executor.execute(
    `
      SELECT
        id, slug, title, artist, album, duration_seconds AS durationSeconds, isrc,
        rights_state AS rightsState, review_state AS reviewState, live_safe AS liveSafe,
        vod_safe AS vodSafe, explicit_content AS explicitContent, instrumental,
        safety_tags AS safetyTags, notes_private AS notesPrivate,
        created_at AS createdAt, updated_at AS updatedAt
      FROM music_tracks
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  const trackRow = Array.isArray(trackRows) ? trackRows[0] as TrackRow | undefined : undefined;

  if (!trackRow) {
    return null;
  }

  const [sourceRows] = await executor.execute(
    `
      SELECT
        id, track_id AS trackId, provider_policy_id AS providerPolicyId, provider_key AS providerKey,
        source_type AS sourceType, source_label AS sourceLabel, source_external_id AS sourceExternalId,
        source_url AS sourceUrl, preview_url AS previewUrl, preview_mime_type AS previewMimeType,
        storage_ref AS storageRef, sha256, mime_type AS mimeType,
        duration_seconds AS durationSeconds, rights_state AS rightsState,
        availability_status AS availabilityStatus, attribution_text AS attributionText,
        created_at AS createdAt, updated_at AS updatedAt
      FROM music_track_sources
      WHERE track_id = ?
      ORDER BY created_at DESC
    `,
    [id]
  );
  const [licenseRows] = await executor.execute(
    `
      SELECT
        id, track_id AS trackId, source_id AS sourceId, provider_policy_id AS providerPolicyId,
        license_name AS licenseName, license_kind AS licenseKind, rights_state AS rightsState,
        live_safe AS liveSafe, vod_safe AS vodSafe, attribution_required AS attributionRequired,
        attribution_text AS attributionText, proof_url AS proofUrl,
        valid_from AS validFrom, valid_until AS validUntil, captured_at AS capturedAt
      FROM music_license_snapshots
      WHERE track_id = ?
      ORDER BY captured_at DESC
    `,
    [id]
  );

  return mapTrack(
    trackRow,
    mapRows<SourceRow, MusicTrackSourceRecord>(sourceRows, mapSource),
    mapRows<LicenseRow, MusicLicenseSnapshotRecord>(licenseRows, mapLicense)
  );
};

export const readSource = async (executor: QueryExecutor, id: string): Promise<MusicTrackSourceRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id, track_id AS trackId, provider_policy_id AS providerPolicyId, provider_key AS providerKey,
        source_type AS sourceType, source_label AS sourceLabel, source_external_id AS sourceExternalId,
        source_url AS sourceUrl, preview_url AS previewUrl, preview_mime_type AS previewMimeType,
        storage_ref AS storageRef, sha256, mime_type AS mimeType,
        duration_seconds AS durationSeconds, rights_state AS rightsState,
        availability_status AS availabilityStatus, attribution_text AS attributionText,
        created_at AS createdAt, updated_at AS updatedAt
      FROM music_track_sources
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  const row = Array.isArray(rows) ? rows[0] as SourceRow | undefined : undefined;

  return row ? mapSource(row) : null;
};

export const readLicenseSnapshot = async (
  executor: QueryExecutor,
  id: string
): Promise<MusicLicenseSnapshotRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id, track_id AS trackId, source_id AS sourceId, provider_policy_id AS providerPolicyId,
        license_name AS licenseName, license_kind AS licenseKind, rights_state AS rightsState,
        live_safe AS liveSafe, vod_safe AS vodSafe, attribution_required AS attributionRequired,
        attribution_text AS attributionText, proof_url AS proofUrl, proof_storage_ref AS proofStorageRef,
        license_payload AS licensePayload, valid_from AS validFrom,
        valid_until AS validUntil, captured_at AS capturedAt
      FROM music_license_snapshots
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  const row = Array.isArray(rows) ? rows[0] as LicenseRow | undefined : undefined;

  return row ? mapLicense(row) : null;
};
