import { createHash, randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import {
  youtubeAudioLibraryProviderKey,
  type YouTubeAudioLibraryValidatedTrack
} from "@maiks-yt/domain/music";

import { bool, mapRows, parseStringArray, type QueryExecutor } from "./music-store-shared.service.js";
import type {
  MusicYouTubeAudioLibraryImportApplyInput,
  MusicYouTubeAudioLibraryImportRepository,
  MusicYouTubeAudioLibraryImportState,
  MusicYouTubeAudioLibraryImportSummary
} from "./music-youtube-audio-library-import.types.js";

type ImportStateRow = {
  sourceId: string;
  trackId: string;
  externalId: string;
  title: string;
  artist: string;
  durationSeconds?: number | null;
  reviewState: string;
  rightsState: string;
  liveSafe: boolean | number;
  vodSafe: boolean | number;
  explicitContent: boolean | number;
  instrumental: boolean | number;
  safetyTags: unknown;
  sourceType: string;
  sourceUrl?: string | null;
  storageRef?: string | null;
  sha256?: string | null;
  mimeType?: string | null;
  availabilityStatus: string;
  attributionText?: string | null;
  licenseName?: string | null;
  proofUrl?: string | null;
  proofStorageRef?: string | null;
  licensePayload?: unknown;
};

const providerDisplayName = "YouTube Audio Library CC BY";
const providerPolicyUrl = "https://creativecommons.org/licenses/by/4.0/";
const providerTermsUrl = "https://www.youtube.com/audiolibrary";

const emptySummary = (received = 0, accepted = 0, rejected = 0): MusicYouTubeAudioLibraryImportSummary => ({
  received,
  accepted,
  rejected,
  created: 0,
  updated: 0,
  unchanged: 0,
  markedUnavailable: 0,
  licenseSnapshotsAppended: 0
});

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120)
  || "track";

const buildTrackSlug = (track: YouTubeAudioLibraryValidatedTrack): string => {
  const hash = createHash("sha256").update(track.externalId).digest("hex").slice(0, 12);
  return `youtube-audio-library-${slugify(track.externalId)}-${hash}`.slice(0, 191);
};

const comparableForTrack = (track: YouTubeAudioLibraryValidatedTrack): string =>
  JSON.stringify({
    title: track.title,
    artist: track.artist,
    durationSeconds: track.durationSeconds,
    sourceType: track.audio.sourceType,
    sourceUrl: null,
    storageRef: track.audio.storageRef,
    sha256: track.audio.sha256,
    mimeType: track.audio.mimeType,
    attributionText: track.attributionText,
    safetyTags: track.safetyTags,
    explicitContent: track.explicitContent,
    instrumental: track.instrumental,
    licenseName: track.licenseName,
    licenseUrl: track.licenseUrl,
    proofUrl: track.proofUrl,
    proofStorageRef: track.proofStorageRef,
    licensePayload: track.licensePayload
  });

const comparableForStateRow = (row: ImportStateRow): string | null => {
  if (!row.licenseName) {
    return null;
  }
  const licensePayload = typeof row.licensePayload === "string"
    ? (() => {
      try {
        return JSON.parse(row.licensePayload) as Record<string, unknown>;
      } catch {
        return {};
      }
    })()
    : row.licensePayload && typeof row.licensePayload === "object"
      ? row.licensePayload as Record<string, unknown>
      : {};

  return JSON.stringify({
    title: row.title,
    artist: row.artist,
    durationSeconds: row.durationSeconds ?? null,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl ?? null,
    storageRef: row.storageRef ?? null,
    sha256: row.sha256 ?? null,
    mimeType: row.mimeType ?? null,
    attributionText: row.attributionText ?? null,
    safetyTags: parseStringArray(row.safetyTags),
    explicitContent: bool(row.explicitContent),
    instrumental: bool(row.instrumental),
    licenseName: row.licenseName,
    licenseUrl: typeof licensePayload.licenseUrl === "string" ? licensePayload.licenseUrl : null,
    proofUrl: row.proofUrl ?? null,
    proofStorageRef: row.proofStorageRef ?? null,
    licensePayload
  });
};

const readProviderPolicyId = async (executor: QueryExecutor): Promise<string | null> => {
  const [rows] = await executor.execute(
    `
      SELECT id
      FROM music_provider_policies
      WHERE provider_key = ?
      LIMIT 1
    `,
    [youtubeAudioLibraryProviderKey]
  );
  const row = Array.isArray(rows) ? rows[0] as { id?: string } | undefined : undefined;

  return row?.id ?? null;
};

const ensureProviderPolicy = async (executor: QueryExecutor, actorUserId: string): Promise<string> => {
  const existingId = await readProviderPolicyId(executor);

  if (existingId) {
    await executor.execute(
      `
        UPDATE music_provider_policies
        SET display_name = ?, provider_type = 'catalog', attribution_required = TRUE,
          policy_url = ?, terms_url = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [providerDisplayName, providerPolicyUrl, providerTermsUrl, existingId]
    );

    return existingId;
  }

  const id = randomUUID();
  await executor.execute(
    `
      INSERT INTO music_provider_policies
        (id, provider_key, display_name, provider_type, provider_status, rights_state,
          public_requests_enabled, public_playback_enabled, default_live_safe, default_vod_safe,
          attribution_required, local_cache_allowed, policy_url, terms_url, notes_private,
          created_by_user_id)
      VALUES (?, ?, ?, 'catalog', 'allowed', 'eligible', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, ?, ?, ?, ?)
    `,
    [
      id,
      youtubeAudioLibraryProviderKey,
      providerDisplayName,
      providerPolicyUrl,
      providerTermsUrl,
      "Bulk managed from current owner-exported YouTube Studio Audio Library CC BY manifest.",
      actorUserId
    ]
  );

  return id;
};

const readImportState = async (executor: QueryExecutor): Promise<MusicYouTubeAudioLibraryImportState> => {
  const [rows] = await executor.execute(
    `
      SELECT
        sources.id AS sourceId,
        sources.track_id AS trackId,
        sources.source_external_id AS externalId,
        tracks.title,
        tracks.artist,
        tracks.duration_seconds AS durationSeconds,
        tracks.review_state AS reviewState,
        tracks.rights_state AS rightsState,
        tracks.live_safe AS liveSafe,
        tracks.vod_safe AS vodSafe,
        tracks.explicit_content AS explicitContent,
        tracks.instrumental,
        tracks.safety_tags AS safetyTags,
        sources.source_type AS sourceType,
        sources.source_url AS sourceUrl,
        sources.storage_ref AS storageRef,
        sources.sha256,
        sources.mime_type AS mimeType,
        sources.availability_status AS availabilityStatus,
        sources.attribution_text AS attributionText,
        latest_licenses.license_name AS licenseName,
        latest_licenses.proof_url AS proofUrl,
        latest_licenses.proof_storage_ref AS proofStorageRef,
        latest_licenses.license_payload AS licensePayload
      FROM music_track_sources sources
      INNER JOIN music_tracks tracks
        ON tracks.id = sources.track_id
      LEFT JOIN music_license_snapshots latest_licenses
        ON latest_licenses.id = (
          SELECT licenses.id
          FROM music_license_snapshots licenses
          WHERE licenses.source_id = sources.id
          ORDER BY licenses.captured_at DESC
          LIMIT 1
        )
      WHERE sources.provider_key = ?
        AND sources.source_external_id IS NOT NULL
      ORDER BY sources.created_at
    `,
    [youtubeAudioLibraryProviderKey]
  );

  return {
    providerPolicyId: await readProviderPolicyId(executor),
    sources: mapRows<ImportStateRow, MusicYouTubeAudioLibraryImportState["sources"][number]>(rows, (row) => ({
      sourceId: row.sourceId,
      trackId: row.trackId,
      externalId: row.externalId,
      title: row.title,
      artist: row.artist,
      durationSeconds: row.durationSeconds ?? null,
      reviewState: row.reviewState,
      rightsState: row.rightsState,
      liveSafe: bool(row.liveSafe),
      vodSafe: bool(row.vodSafe),
      explicitContent: bool(row.explicitContent),
      instrumental: bool(row.instrumental),
      safetyTags: parseStringArray(row.safetyTags),
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl ?? null,
      storageRef: row.storageRef ?? null,
      sha256: row.sha256 ?? null,
      mimeType: row.mimeType ?? null,
      availabilityStatus: row.availabilityStatus,
      attributionText: row.attributionText ?? null,
      latestLicenseComparable: comparableForStateRow(row)
    }))
  };
};

const insertTrack = async (
  executor: QueryExecutor,
  input: {
    track: YouTubeAudioLibraryValidatedTrack;
    actorUserId: string;
  }
): Promise<string> => {
  const id = randomUUID();
  await executor.execute(
    `
      INSERT INTO music_tracks
        (id, slug, title, artist, album, duration_seconds, isrc, normalized_title_artist_key,
          rights_state, review_state, live_safe, vod_safe, explicit_content, instrumental,
          safety_tags, notes_private, created_by_user_id, updated_by_user_id)
      VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, 'eligible', 'unreviewed', TRUE, TRUE, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      buildTrackSlug(input.track),
      input.track.title,
      input.track.artist,
      input.track.durationSeconds,
      `${input.track.title.toLowerCase()}::${input.track.artist.toLowerCase()}`.slice(0, 191),
      input.track.explicitContent,
      input.track.instrumental,
      JSON.stringify(input.track.safetyTags),
      "Managed by YouTube Audio Library bulk import.",
      input.actorUserId,
      input.actorUserId
    ]
  );

  return id;
};

const updateTrack = async (
  executor: QueryExecutor,
  input: {
    trackId: string;
    track: YouTubeAudioLibraryValidatedTrack;
    actorUserId: string;
  }
): Promise<void> => {
  await executor.execute(
    `
      UPDATE music_tracks
      SET slug = ?, title = ?, artist = ?, duration_seconds = ?,
        normalized_title_artist_key = ?, rights_state = 'eligible', live_safe = TRUE,
        vod_safe = TRUE, explicit_content = ?, instrumental = ?, safety_tags = ?,
        updated_by_user_id = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      buildTrackSlug(input.track),
      input.track.title,
      input.track.artist,
      input.track.durationSeconds,
      `${input.track.title.toLowerCase()}::${input.track.artist.toLowerCase()}`.slice(0, 191),
      input.track.explicitContent,
      input.track.instrumental,
      JSON.stringify(input.track.safetyTags),
      input.actorUserId,
      input.trackId
    ]
  );
};

const sourceValues = (
  track: YouTubeAudioLibraryValidatedTrack,
  providerPolicyId: string
) => ({
  providerPolicyId,
  providerKey: youtubeAudioLibraryProviderKey,
  sourceType: track.audio.sourceType,
  sourceLabel: "YouTube Audio Library",
  sourceExternalId: track.externalId,
  sourceUrl: null,
  storageRef: track.audio.storageRef,
  sha256: track.audio.sha256,
  mimeType: track.audio.mimeType,
  durationSeconds: track.durationSeconds,
  attributionText: track.attributionText
});

const insertSource = async (
  executor: QueryExecutor,
  input: {
    trackId: string;
    providerPolicyId: string;
    track: YouTubeAudioLibraryValidatedTrack;
  }
): Promise<string> => {
  const id = randomUUID();
  const values = sourceValues(input.track, input.providerPolicyId);

  await executor.execute(
    `
      INSERT INTO music_track_sources
        (id, track_id, provider_policy_id, provider_key, source_type, source_label,
          source_external_id, source_url, preview_url, preview_mime_type, storage_ref,
          sha256, mime_type, duration_seconds, rights_state, availability_status,
          attribution_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 'eligible', 'available', ?)
    `,
    [
      id,
      input.trackId,
      values.providerPolicyId,
      values.providerKey,
      values.sourceType,
      values.sourceLabel,
      values.sourceExternalId,
      values.sourceUrl,
      values.storageRef,
      values.sha256,
      values.mimeType,
      values.durationSeconds,
      values.attributionText
    ]
  );

  return id;
};

const updateSource = async (
  executor: QueryExecutor,
  input: {
    sourceId: string;
    providerPolicyId: string;
    track: YouTubeAudioLibraryValidatedTrack;
  }
): Promise<void> => {
  const values = sourceValues(input.track, input.providerPolicyId);

  await executor.execute(
    `
      UPDATE music_track_sources
      SET provider_policy_id = ?, provider_key = ?, source_type = ?, source_label = ?,
        source_external_id = ?, source_url = ?, preview_url = NULL, preview_mime_type = NULL,
        storage_ref = ?, sha256 = ?, mime_type = ?, duration_seconds = ?,
        rights_state = 'eligible', availability_status = 'available', attribution_text = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
    [
      values.providerPolicyId,
      values.providerKey,
      values.sourceType,
      values.sourceLabel,
      values.sourceExternalId,
      values.sourceUrl,
      values.storageRef,
      values.sha256,
      values.mimeType,
      values.durationSeconds,
      values.attributionText,
      input.sourceId
    ]
  );
};

const insertLicenseSnapshot = async (
  executor: QueryExecutor,
  input: {
    trackId: string;
    sourceId: string;
    providerPolicyId: string;
    track: YouTubeAudioLibraryValidatedTrack;
    actorUserId: string;
  }
): Promise<void> => {
  await executor.execute(
    `
      INSERT INTO music_license_snapshots
        (id, track_id, source_id, provider_policy_id, license_name, license_kind,
          rights_state, live_safe, vod_safe, attribution_required, attribution_text,
          proof_url, proof_storage_ref, license_payload, valid_from, valid_until,
          captured_by_user_id)
      VALUES (?, ?, ?, ?, ?, 'creative-commons', 'eligible', TRUE, TRUE, TRUE, ?, ?, ?, ?, NULL, NULL, ?)
    `,
    [
      randomUUID(),
      input.trackId,
      input.sourceId,
      input.providerPolicyId,
      input.track.licenseName,
      input.track.attributionText,
      input.track.proofUrl,
      input.track.proofStorageRef,
      JSON.stringify(input.track.licensePayload),
      input.actorUserId
    ]
  );
};

export const createMusicYouTubeAudioLibraryImportRepository = (
  pool: DatabasePool
): MusicYouTubeAudioLibraryImportRepository => ({
  async getImportState() {
    return await readImportState(pool);
  },

  async applyImport(input: MusicYouTubeAudioLibraryImportApplyInput) {
    const connection = await pool.getConnection();
    const summary = emptySummary(input.manifest.tracks.length, input.tracks.length, 0);

    try {
      await connection.beginTransaction();
      const providerPolicyId = await ensureProviderPolicy(connection, input.actorUserId);
      const state = await readImportState(connection);
      const existingByExternalId = new Map(state.sources.map((source) => [source.externalId.toLowerCase(), source]));
      const acceptedExternalIds = new Set(input.tracks.map((track) => track.externalId.toLowerCase()));

      for (const track of input.tracks) {
        const existing = existingByExternalId.get(track.externalId.toLowerCase());
        const nextComparable = comparableForTrack(track);

        if (!existing) {
          const trackId = await insertTrack(connection, {
            track,
            actorUserId: input.actorUserId
          });
          const sourceId = await insertSource(connection, {
            trackId,
            providerPolicyId,
            track
          });
          await insertLicenseSnapshot(connection, {
            trackId,
            sourceId,
            providerPolicyId,
            track,
            actorUserId: input.actorUserId
          });
          summary.created += 1;
          summary.licenseSnapshotsAppended += 1;
          continue;
        }

        await updateTrack(connection, {
          trackId: existing.trackId,
          track,
          actorUserId: input.actorUserId
        });
        await updateSource(connection, {
          sourceId: existing.sourceId,
          providerPolicyId,
          track
        });

        if (existing.latestLicenseComparable === nextComparable
          && existing.availabilityStatus === "available"
          && existing.rightsState === "eligible") {
          summary.unchanged += 1;
        } else {
          summary.updated += 1;
        }

        if (existing.latestLicenseComparable !== nextComparable) {
          await insertLicenseSnapshot(connection, {
            trackId: existing.trackId,
            sourceId: existing.sourceId,
            providerPolicyId,
            track,
            actorUserId: input.actorUserId
          });
          summary.licenseSnapshotsAppended += 1;
        }
      }

      if (input.manifest.refreshMode === "full") {
        for (const source of state.sources) {
          if (source.availabilityStatus === "available" && !acceptedExternalIds.has(source.externalId.toLowerCase())) {
            await connection.execute(
              `
                UPDATE music_track_sources
                SET availability_status = 'unavailable', rights_state = 'uncertain', updated_at = NOW()
                WHERE id = ?
              `,
              [source.sourceId]
            );
            summary.markedUnavailable += 1;
          }
        }
      }

      await connection.commit();
      return summary;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
});
