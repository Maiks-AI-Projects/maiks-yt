import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type { MusicRepository, MusicTopTrackPick, MusicTrackRequestCreateResult } from "./music.types.js";
import { isDuplicateKeyError } from "./music-store-shared.service.js";
import { selectSelectableFields, selectableFromClause } from "./music-selectable-store.service.js";

export const createMusicRequestsRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "createAnonymousTrackRequest"
  | "listTopTracks"
  | "replaceTopTracks"
> => ({
  async createAnonymousTrackRequest(input): Promise<MusicTrackRequestCreateResult> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const bucketId = randomUUID();

      try {
        await connection.execute(
          `
            INSERT INTO music_anonymous_request_buckets
              (id, anonymous_daily_hmac, amsterdam_date, request_count, last_request_at)
            VALUES (?, ?, ?, 1, NOW())
          `,
          [bucketId, input.anonymousDailyHmac, input.amsterdamDate]
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          await connection.rollback();
          return { ok: false, reason: "music_request_daily_limit" };
        }

        throw error;
      }

      const requestId = randomUUID();
      await connection.execute(
        `
          INSERT INTO music_track_requests
            (id, track_id, source_id, anonymous_request_bucket_id, anonymous_daily_hmac,
              amsterdam_date, request_source, status, request_text, provider_key)
          VALUES (?, ?, ?, ?, ?, ?, 'anonymous', 'pending', ?, ?)
        `,
        [
          requestId,
          input.trackId,
          input.sourceId,
          bucketId,
          input.anonymousDailyHmac,
          input.amsterdamDate,
          input.requestText,
          input.providerKey
        ]
      );

      await connection.commit();

      return {
        ok: true,
        request: {
          id: requestId,
          trackId: input.trackId,
          sourceId: input.sourceId,
          status: "pending",
          amsterdamDate: input.amsterdamDate,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },


  async listTopTracks(userId, limit): Promise<readonly MusicTopTrackPick[]> {
    const [rows] = await pool.execute(
      `
        SELECT
          picks.track_id AS trackId,
          picks.rank,
          selectable.title,
          selectable.artist,
          selectable.durationSeconds,
          selectable.providerKey,
          selectable.attributionText,
          selectable.licenseName,
          selectable.licenseUrl
        FROM music_user_ranked_picks picks
        INNER JOIN (
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
            AND tracks.live_safe = TRUE
            AND licenses.live_safe = TRUE
          HAVING hasActiveBlacklist = 0
        ) selectable ON selectable.trackId = picks.track_id
        WHERE picks.user_id = ?
          AND picks.status = 'active'
        ORDER BY picks.rank
        LIMIT ?
      `,
      [userId, limit]
    );

    return Array.isArray(rows)
      ? (rows as Array<MusicTopTrackPick>).map((row) => ({ ...row }))
      : [];
  },


  async replaceTopTracks(input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM music_user_ranked_picks WHERE user_id = ?", [input.userId]);

      for (const pick of input.picks) {
        await connection.execute(
          `
            INSERT INTO music_user_ranked_picks
              (id, user_id, track_id, rank, status)
            VALUES (?, ?, ?, ?, 'active')
          `,
          [randomUUID(), input.userId, pick.trackId, pick.rank]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
});
