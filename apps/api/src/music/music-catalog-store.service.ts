import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  MusicLicenseSnapshotInput,
  MusicRepository,
  MusicTrackAdminRecord,
  MusicTrackSourceInput
} from "./music.types.js";
import { mapRows, optionalText } from "./music-store-shared.service.js";
import { mapTrack, readLicenseSnapshot, readSource, readTrack, type TrackRow } from "./music-catalog-records-store.service.js";

export const createMusicCatalogRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "listAdminCatalog"
  | "createTrack"
  | "updateTrack"
  | "createTrackSource"
  | "updateTrackSource"
  | "createLicenseSnapshot"
  | "updateLicenseSnapshot"
> => ({
  async listAdminCatalog() {
    const [rows] = await pool.execute(
      `
        SELECT
          id, slug, title, artist, album, duration_seconds AS durationSeconds, isrc,
          rights_state AS rightsState, review_state AS reviewState, live_safe AS liveSafe,
          vod_safe AS vodSafe, explicit_content AS explicitContent, instrumental,
          safety_tags AS safetyTags, notes_private AS notesPrivate,
          created_at AS createdAt, updated_at AS updatedAt
        FROM music_tracks
        ORDER BY updated_at DESC, title
        LIMIT 200
      `
    );
    const tracks = mapRows<TrackRow, MusicTrackAdminRecord>(rows, (row) => mapTrack(row));

    return await Promise.all(tracks.map((track) => readTrack(pool, track.id))).then((items) =>
      items.filter((item): item is MusicTrackAdminRecord => item !== null)
    );
  },

  async createTrack(input) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO music_tracks
          (id, slug, title, artist, album, duration_seconds, isrc, normalized_title_artist_key,
            rights_state, review_state, live_safe, vod_safe, explicit_content, instrumental,
            safety_tags, notes_private, created_by_user_id, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.slug.trim(),
        input.title.trim(),
        input.artist.trim(),
        optionalText(input.album),
        input.durationSeconds ?? null,
        optionalText(input.isrc),
        `${input.title.trim().toLowerCase()}::${input.artist.trim().toLowerCase()}`.slice(0, 191),
        input.rightsState ?? "uncertain",
        input.reviewState ?? "unreviewed",
        input.liveSafe ?? false,
        input.vodSafe ?? false,
        input.explicitContent ?? false,
        input.instrumental ?? false,
        JSON.stringify(input.safetyTags ?? []),
        optionalText(input.notesPrivate),
        input.actorUserId,
        input.actorUserId
      ]
    );
    const track = await readTrack(pool, id);

    if (!track) {
      throw new Error("music_track_reread_failed");
    }

    return track;
  },

  async updateTrack(input) {
    const existing = await readTrack(pool, input.id);

    if (!existing) {
      return null;
    }

    await pool.execute(
      `
        UPDATE music_tracks
        SET slug = ?, title = ?, artist = ?, album = ?, duration_seconds = ?, isrc = ?,
          normalized_title_artist_key = ?, rights_state = ?, review_state = ?, live_safe = ?,
          vod_safe = ?, explicit_content = ?, instrumental = ?, safety_tags = ?,
          notes_private = ?, updated_by_user_id = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        input.slug.trim(),
        input.title.trim(),
        input.artist.trim(),
        optionalText(input.album),
        input.durationSeconds ?? null,
        optionalText(input.isrc),
        `${input.title.trim().toLowerCase()}::${input.artist.trim().toLowerCase()}`.slice(0, 191),
        input.rightsState ?? existing.rightsState,
        input.reviewState ?? existing.reviewState,
        input.liveSafe ?? existing.liveSafe,
        input.vodSafe ?? existing.vodSafe,
        input.explicitContent ?? existing.explicitContent,
        input.instrumental ?? existing.instrumental,
        JSON.stringify(input.safetyTags ?? existing.safetyTags),
        optionalText(input.notesPrivate),
        input.actorUserId,
        input.id
      ]
    );

    return await readTrack(pool, input.id);
  },

  async createTrackSource(input: MusicTrackSourceInput & {
    trackId: string;
    actorUserId: string;
  }) {
    if (!await readTrack(pool, input.trackId)) {
      return null;
    }

    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO music_track_sources
          (id, track_id, provider_policy_id, provider_key, source_type, source_label,
            source_external_id, source_url, preview_url, preview_mime_type, storage_ref,
            sha256, mime_type, duration_seconds, rights_state, availability_status,
            attribution_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.trackId,
        optionalText(input.providerPolicyId),
        input.providerKey.trim(),
        input.sourceType,
        input.sourceLabel.trim(),
        optionalText(input.sourceExternalId),
        optionalText(input.sourceUrl),
        optionalText(input.previewUrl),
        optionalText(input.previewMimeType),
        optionalText(input.storageRef),
        optionalText(input.sha256),
        optionalText(input.mimeType),
        input.durationSeconds ?? null,
        input.rightsState ?? "uncertain",
        input.availabilityStatus ?? "available",
        optionalText(input.attributionText)
      ]
    );

    return await readSource(pool, id);
  },

  async updateTrackSource(input: MusicTrackSourceInput & {
    id: string;
    actorUserId: string;
  }) {
    const existing = await readSource(pool, input.id);

    if (!existing) {
      return null;
    }

    await pool.execute(
      `
        UPDATE music_track_sources
        SET provider_policy_id = ?, provider_key = ?, source_type = ?, source_label = ?,
          source_external_id = ?, source_url = ?, preview_url = ?, preview_mime_type = ?,
          storage_ref = ?, sha256 = ?, mime_type = ?, duration_seconds = ?,
          rights_state = ?, availability_status = ?, attribution_text = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        optionalText(input.providerPolicyId) ?? existing.providerPolicyId,
        input.providerKey.trim(),
        input.sourceType,
        input.sourceLabel.trim(),
        optionalText(input.sourceExternalId),
        optionalText(input.sourceUrl),
        optionalText(input.previewUrl),
        optionalText(input.previewMimeType),
        optionalText(input.storageRef),
        optionalText(input.sha256),
        optionalText(input.mimeType),
        input.durationSeconds ?? null,
        input.rightsState ?? existing.rightsState,
        input.availabilityStatus ?? existing.availabilityStatus,
        optionalText(input.attributionText),
        input.id
      ]
    );

    return await readSource(pool, input.id);
  },

  async createLicenseSnapshot(input: MusicLicenseSnapshotInput & {
    sourceId: string;
    actorUserId: string;
  }) {
    const source = await readSource(pool, input.sourceId);

    if (!source) {
      return null;
    }

    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO music_license_snapshots
          (id, track_id, source_id, provider_policy_id, license_name, license_kind,
            rights_state, live_safe, vod_safe, attribution_required, attribution_text,
            proof_url, proof_storage_ref, license_payload, valid_from, valid_until,
            captured_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.trackId ?? source.trackId,
        input.sourceId,
        optionalText(input.providerPolicyId) ?? source.providerPolicyId,
        input.licenseName.trim(),
        input.licenseKind ?? "unknown",
        input.rightsState ?? "uncertain",
        input.liveSafe ?? false,
        input.vodSafe ?? false,
        input.attributionRequired ?? true,
        optionalText(input.attributionText),
        optionalText(input.proofUrl),
        optionalText(input.proofStorageRef),
        input.licensePayload === undefined ? null : JSON.stringify(input.licensePayload),
        input.validFrom ? new Date(input.validFrom) : null,
        input.validUntil ? new Date(input.validUntil) : null,
        input.actorUserId
      ]
    );

    return await readLicenseSnapshot(pool, id);
  },

  async updateLicenseSnapshot(input: MusicLicenseSnapshotInput & {
    id: string;
    actorUserId: string;
  }) {
    const existing = await readLicenseSnapshot(pool, input.id);

    if (!existing) {
      return null;
    }

    await pool.execute(
      `
        UPDATE music_license_snapshots
        SET track_id = ?, source_id = ?, provider_policy_id = ?, license_name = ?,
          license_kind = ?, rights_state = ?, live_safe = ?, vod_safe = ?,
          attribution_required = ?, attribution_text = ?, proof_url = ?,
          proof_storage_ref = ?, license_payload = ?, valid_from = ?, valid_until = ?
        WHERE id = ?
      `,
      [
        input.trackId ?? existing.trackId,
        input.sourceId ?? existing.sourceId,
        optionalText(input.providerPolicyId) ?? existing.providerPolicyId,
        input.licenseName.trim(),
        input.licenseKind ?? existing.licenseKind,
        input.rightsState ?? existing.rightsState,
        input.liveSafe ?? existing.liveSafe,
        input.vodSafe ?? existing.vodSafe,
        input.attributionRequired ?? existing.attributionRequired,
        optionalText(input.attributionText),
        optionalText(input.proofUrl),
        optionalText(input.proofStorageRef),
        input.licensePayload === undefined ? null : JSON.stringify(input.licensePayload),
        input.validFrom ? new Date(input.validFrom) : null,
        input.validUntil ? new Date(input.validUntil) : null,
        input.id
      ]
    );

    return await readLicenseSnapshot(pool, input.id);
  },
});
