import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type { MusicPlayHistoryAppendResult, MusicPlayHistoryRecord, MusicRepository } from "./music.types.js";
import { bool, mapRows, parseSafetySnapshot, toIso, toIsoOrNull } from "./music-store-shared.service.js";
import { readAdminPreviewTrack, readHistorySnapshotTrack, readSelectableTrack } from "./music-selectable-store.service.js";

export const mapPlayHistory = (row: {
  id: string;
  trackId?: string | null;
  sourceId?: string | null;
  requestId?: string | null;
  playlistId?: string | null;
  streamSessionId?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  outcome: string;
  outcomeReason?: string | null;
  publicVisible: boolean | number;
  titleSnapshot: string;
  artistSnapshot: string;
  durationSecondsSnapshot?: number | null;
  durationPlayedSeconds?: number | null;
  providerKeySnapshot: string;
  sourceTypeSnapshot: string;
  sourceLabelSnapshot: string;
  sourceExternalIdSnapshot?: string | null;
  sourceUrlSnapshot?: string | null;
  previewUrlSnapshot?: string | null;
  previewMimeTypeSnapshot?: string | null;
  licenseNameSnapshot: string;
  licenseKindSnapshot: string;
  licenseUrlSnapshot?: string | null;
  providerPolicyUrlSnapshot?: string | null;
  attributionTextSnapshot?: string | null;
  rightsStateSnapshot: MusicPlayHistoryRecord["rightsStateSnapshot"];
  reviewStateSnapshot: MusicPlayHistoryRecord["reviewStateSnapshot"];
  liveSafeSnapshot: boolean | number;
  vodSafeSnapshot: boolean | number;
  safetyTagsSnapshot: unknown;
  createdAt: Date | string;
}): MusicPlayHistoryRecord => ({
  id: row.id,
  trackId: row.trackId ?? null,
  sourceId: row.sourceId ?? null,
  requestId: row.requestId ?? null,
  playlistId: row.playlistId ?? null,
  streamSessionId: row.streamSessionId ?? null,
  startedAt: toIso(row.startedAt),
  endedAt: toIsoOrNull(row.endedAt),
  outcome: row.outcome,
  outcomeReason: row.outcomeReason ?? null,
  publicVisible: bool(row.publicVisible),
  titleSnapshot: row.titleSnapshot,
  artistSnapshot: row.artistSnapshot,
  durationSecondsSnapshot: row.durationSecondsSnapshot ?? null,
  durationPlayedSeconds: row.durationPlayedSeconds ?? null,
  providerKeySnapshot: row.providerKeySnapshot,
  sourceTypeSnapshot: row.sourceTypeSnapshot,
  sourceLabelSnapshot: row.sourceLabelSnapshot,
  sourceExternalIdSnapshot: row.sourceExternalIdSnapshot ?? null,
  sourceUrlSnapshot: row.sourceUrlSnapshot ?? null,
  previewUrlSnapshot: row.previewUrlSnapshot ?? null,
  previewMimeTypeSnapshot: row.previewMimeTypeSnapshot ?? null,
  licenseNameSnapshot: row.licenseNameSnapshot,
  licenseKindSnapshot: row.licenseKindSnapshot,
  licenseUrlSnapshot: row.licenseUrlSnapshot ?? null,
  providerPolicyUrlSnapshot: row.providerPolicyUrlSnapshot ?? null,
  attributionTextSnapshot: row.attributionTextSnapshot ?? null,
  rightsStateSnapshot: row.rightsStateSnapshot,
  reviewStateSnapshot: row.reviewStateSnapshot,
  liveSafeSnapshot: bool(row.liveSafeSnapshot),
  vodSafeSnapshot: bool(row.vodSafeSnapshot),
  safetyTagsSnapshot: parseSafetySnapshot(row.safetyTagsSnapshot),
  createdAt: toIso(row.createdAt)
});


export const dbOutcome = (outcome: string): string =>
  outcome === "played-full"
    ? "played"
    : outcome === "queued-skipped"
      ? "skipped"
      : outcome === "admin-preview"
        ? "admin_preview"
        : outcome;



export const createMusicHistoryRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "listPlayHistory"
  | "appendPlayHistory"
> => ({
  async listPlayHistory(limit) {
    const [rows] = await pool.execute(
      `
        SELECT
          id, track_id AS trackId, source_id AS sourceId, request_id AS requestId,
          playlist_id AS playlistId, stream_session_id AS streamSessionId,
          started_at AS startedAt, ended_at AS endedAt, outcome, outcome_reason AS outcomeReason,
          public_visible AS publicVisible, title_snapshot AS titleSnapshot,
          artist_snapshot AS artistSnapshot, duration_seconds_snapshot AS durationSecondsSnapshot,
          duration_played_seconds AS durationPlayedSeconds, provider_key_snapshot AS providerKeySnapshot,
          source_type_snapshot AS sourceTypeSnapshot, source_label_snapshot AS sourceLabelSnapshot,
          source_external_id_snapshot AS sourceExternalIdSnapshot, source_url_snapshot AS sourceUrlSnapshot,
          preview_url_snapshot AS previewUrlSnapshot, preview_mime_type_snapshot AS previewMimeTypeSnapshot,
          license_name_snapshot AS licenseNameSnapshot, license_kind_snapshot AS licenseKindSnapshot,
          license_url_snapshot AS licenseUrlSnapshot, provider_policy_url_snapshot AS providerPolicyUrlSnapshot,
          attribution_text_snapshot AS attributionTextSnapshot, rights_state_snapshot AS rightsStateSnapshot,
          review_state_snapshot AS reviewStateSnapshot, live_safe_snapshot AS liveSafeSnapshot,
          vod_safe_snapshot AS vodSafeSnapshot, safety_tags_snapshot AS safetyTagsSnapshot,
          created_at AS createdAt
        FROM music_play_history
        ORDER BY started_at DESC
        LIMIT ?
      `,
      [limit]
    );

    return mapRows<Parameters<typeof mapPlayHistory>[0], MusicPlayHistoryRecord>(rows, mapPlayHistory);
  },

  async appendPlayHistory(input): Promise<MusicPlayHistoryAppendResult> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const requiresSelectableTrack = input.outcome === "played-full";
      const selectable = input.outcome === "admin-preview"
        ? await readAdminPreviewTrack(connection, {
          trackId: input.trackId,
          sourceId: input.sourceId
        })
        : requiresSelectableTrack
        ? await readSelectableTrack(connection, {
          trackId: input.trackId,
          sourceId: input.sourceId,
          context: "live",
          requirePublicRequest: false
        })
        : await readHistorySnapshotTrack(connection, {
          trackId: input.trackId,
          sourceId: input.sourceId
        });

      if (!selectable) {
        await connection.rollback();
        return { ok: false, reason: "music_track_not_found" };
      }

      if (requiresSelectableTrack
        && (selectable.hasActiveBlacklist || selectable.eligibilityState !== "eligible")) {
        await connection.rollback();
        return { ok: false, reason: "music_track_not_selectable" };
      }

      const historyId = randomUUID();
      const storedOutcome = dbOutcome(input.outcome);
      const publicVisible = input.outcome === "admin-preview" ? false : input.publicVisible;

      await connection.execute(
        `
          INSERT INTO music_play_history
            (id, track_id, source_id, request_id, playlist_id, stream_session_id,
              started_at, ended_at, outcome, outcome_reason, public_visible,
              title_snapshot, artist_snapshot, duration_seconds_snapshot, duration_played_seconds,
              provider_key_snapshot, source_type_snapshot, source_label_snapshot,
              source_external_id_snapshot, source_url_snapshot, preview_url_snapshot,
              preview_mime_type_snapshot, source_storage_ref_snapshot,
              source_sha256_snapshot, license_name_snapshot,
              license_kind_snapshot, license_url_snapshot, provider_policy_url_snapshot,
              attribution_text_snapshot, rights_state_snapshot, review_state_snapshot,
              live_safe_snapshot, vod_safe_snapshot, safety_tags_snapshot)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          historyId,
          input.trackId,
          selectable.sourceId,
          input.requestId,
          input.playlistId,
          input.streamSessionId,
          input.startedAt,
          input.endedAt,
          storedOutcome,
          input.outcomeReason,
          publicVisible,
          selectable.title,
          selectable.artist,
          selectable.durationSeconds,
          input.durationPlayedSeconds,
          selectable.providerKey,
          selectable.sourceType,
          selectable.sourceLabel,
          selectable.sourceExternalId,
          selectable.sourceUrl,
          selectable.previewUrl,
          selectable.previewMimeType,
          selectable.sourceStorageRef,
          selectable.sourceSha256,
          selectable.licenseName,
          selectable.licenseKind,
          selectable.licenseUrl,
          selectable.providerPolicyUrl,
          selectable.attributionText,
          selectable.eligibilityState,
          selectable.reviewState,
          selectable.liveSafe,
          selectable.vodSafe,
          JSON.stringify({
            safetyTags: selectable.safetyTags,
            explicitContent: selectable.explicitContent,
            instrumental: selectable.instrumental
          })
        ]
      );

      const reviewQueued = input.outcome === "skipped" || input.outcome === "queued-skipped";

      if (reviewQueued) {
        const queueId = randomUUID();
        await connection.execute(
          `
            INSERT INTO music_review_queue
              (id, track_id, source_id, request_id, play_history_id, queue_kind,
                status, priority, reason_code, summary, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, 'skip_review', 'open', 'normal', 'skip', ?, ?)
          `,
          [
            queueId,
            input.trackId,
            selectable.sourceId,
            input.requestId,
            historyId,
            `Skipped track: ${selectable.title} by ${selectable.artist}`.slice(0, 500),
            input.actorUserId
          ]
        );
        await connection.execute(
          `
            INSERT INTO music_review_events
              (id, queue_id, track_id, source_id, actor_user_id, event_kind, note)
            VALUES (?, ?, ?, ?, ?, 'skip_logged', ?)
          `,
          [randomUUID(), queueId, input.trackId, selectable.sourceId, input.actorUserId, input.outcomeReason]
        );
      }

      const [rows] = await connection.execute(
        `
          SELECT
            id, track_id AS trackId, source_id AS sourceId, request_id AS requestId,
            playlist_id AS playlistId, stream_session_id AS streamSessionId,
            started_at AS startedAt, ended_at AS endedAt, outcome, outcome_reason AS outcomeReason,
            public_visible AS publicVisible, title_snapshot AS titleSnapshot,
            artist_snapshot AS artistSnapshot, duration_seconds_snapshot AS durationSecondsSnapshot,
            duration_played_seconds AS durationPlayedSeconds, provider_key_snapshot AS providerKeySnapshot,
            source_type_snapshot AS sourceTypeSnapshot, source_label_snapshot AS sourceLabelSnapshot,
            source_external_id_snapshot AS sourceExternalIdSnapshot, source_url_snapshot AS sourceUrlSnapshot,
            preview_url_snapshot AS previewUrlSnapshot, preview_mime_type_snapshot AS previewMimeTypeSnapshot,
            license_name_snapshot AS licenseNameSnapshot, license_kind_snapshot AS licenseKindSnapshot,
            license_url_snapshot AS licenseUrlSnapshot, provider_policy_url_snapshot AS providerPolicyUrlSnapshot,
            attribution_text_snapshot AS attributionTextSnapshot, rights_state_snapshot AS rightsStateSnapshot,
            review_state_snapshot AS reviewStateSnapshot, live_safe_snapshot AS liveSafeSnapshot,
            vod_safe_snapshot AS vodSafeSnapshot, safety_tags_snapshot AS safetyTagsSnapshot,
            created_at AS createdAt
          FROM music_play_history
          WHERE id = ?
          LIMIT 1
        `,
        [historyId]
      );
      const row = Array.isArray(rows) ? rows[0] as Parameters<typeof mapPlayHistory>[0] | undefined : undefined;

      if (!row) {
        throw new Error("music_play_history_reread_failed");
      }

      await connection.commit();

      return {
        ok: true,
        history: mapPlayHistory(row),
        reviewQueued
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
});
