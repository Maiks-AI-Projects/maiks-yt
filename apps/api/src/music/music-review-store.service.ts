import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  MusicBlacklistEntryRecord,
  MusicBlacklistInput,
  MusicRepository,
  MusicReviewQueueRecord,
  MusicTrackAdminRecord
} from "./music.types.js";
import { mapRows, optionalText, toIso, toIsoOrNull, type QueryExecutor } from "./music-store-shared.service.js";

export const mapBlacklist = (row: {
  id: string;
  scope: string;
  trackId?: string | null;
  sourceId?: string | null;
  providerKey?: string | null;
  normalizedValue: string;
  reason: string;
  severity: string;
  createdByUserId: string;
  revokedByUserId?: string | null;
  revokedAt?: Date | string | null;
  revocationReason?: string | null;
  createdAt: Date | string;
}): MusicBlacklistEntryRecord => ({
  id: row.id,
  scope: row.scope,
  trackId: row.trackId ?? null,
  sourceId: row.sourceId ?? null,
  providerKey: row.providerKey ?? null,
  normalizedValue: row.normalizedValue,
  reason: row.reason,
  severity: row.severity,
  createdByUserId: row.createdByUserId,
  revokedByUserId: row.revokedByUserId ?? null,
  revokedAt: toIsoOrNull(row.revokedAt),
  revocationReason: row.revocationReason ?? null,
  createdAt: toIso(row.createdAt)
});

export const mapReviewQueue = (row: {
  id: string;
  trackId?: string | null;
  sourceId?: string | null;
  requestId?: string | null;
  playHistoryId?: string | null;
  queueKind: string;
  status: string;
  priority: string;
  reasonCode: string;
  summary: string;
  details?: string | null;
  createdByUserId?: string | null;
  assignedToUserId?: string | null;
  resolvedByUserId?: string | null;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): MusicReviewQueueRecord => ({
  id: row.id,
  trackId: row.trackId ?? null,
  sourceId: row.sourceId ?? null,
  requestId: row.requestId ?? null,
  playHistoryId: row.playHistoryId ?? null,
  queueKind: row.queueKind,
  status: row.status,
  priority: row.priority,
  reasonCode: row.reasonCode,
  summary: row.summary,
  details: row.details ?? null,
  createdByUserId: row.createdByUserId ?? null,
  assignedToUserId: row.assignedToUserId ?? null,
  resolvedByUserId: row.resolvedByUserId ?? null,
  resolvedAt: toIsoOrNull(row.resolvedAt),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

export const readReviewQueueItem = async (
  executor: QueryExecutor,
  id: string,
  lockForUpdate = false
): Promise<MusicReviewQueueRecord | null> => {
  const query = lockForUpdate
    ? `
      SELECT
        id, track_id AS trackId, source_id AS sourceId, request_id AS requestId,
        play_history_id AS playHistoryId, queue_kind AS queueKind, status, priority,
        reason_code AS reasonCode, summary, details, created_by_user_id AS createdByUserId,
        assigned_to_user_id AS assignedToUserId, resolved_by_user_id AS resolvedByUserId,
        resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt
      FROM music_review_queue
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `
    : `
      SELECT
        id, track_id AS trackId, source_id AS sourceId, request_id AS requestId,
        play_history_id AS playHistoryId, queue_kind AS queueKind, status, priority,
        reason_code AS reasonCode, summary, details, created_by_user_id AS createdByUserId,
        assigned_to_user_id AS assignedToUserId, resolved_by_user_id AS resolvedByUserId,
        resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt
      FROM music_review_queue
      WHERE id = ?
      LIMIT 1
    `;
  const [rows] = await executor.execute(
    query,
    [id]
  );
  const row = Array.isArray(rows) ? rows[0] as Parameters<typeof mapReviewQueue>[0] | undefined : undefined;

  return row ? mapReviewQueue(row) : null;
};

export const readTrackReviewState = async (
  executor: QueryExecutor,
  trackId: string
): Promise<MusicTrackAdminRecord["reviewState"] | null> => {
  const [rows] = await executor.execute(
    "SELECT review_state AS reviewState FROM music_tracks WHERE id = ? LIMIT 1 FOR UPDATE",
    [trackId]
  );
  const row = Array.isArray(rows) ? rows[0] as { reviewState: MusicTrackAdminRecord["reviewState"] } | undefined : undefined;

  return row?.reviewState ?? null;
};

export const mapReviewResolution = (
  action: "keep" | "restrict" | "reject" | "blacklist",
  currentState: MusicTrackAdminRecord["reviewState"]
): {
  queueStatus: "resolved" | "dismissed";
  nextReviewState: MusicTrackAdminRecord["reviewState"];
  eventKind: "queue_resolved" | "review_state_changed" | "restricted" | "rejected" | "blacklisted";
} => {
  if (action === "keep") {
    return {
      queueStatus: "dismissed",
      nextReviewState: currentState === "approved" ? "approved" : "unreviewed",
      eventKind: currentState === "approved" || currentState === "unreviewed"
        ? "queue_resolved"
        : "review_state_changed"
    };
  }

  if (action === "restrict") {
    return {
      queueStatus: "resolved",
      nextReviewState: "restricted",
      eventKind: "restricted"
    };
  }

  if (action === "reject") {
    return {
      queueStatus: "resolved",
      nextReviewState: "rejected",
      eventKind: "rejected"
    };
  }

  return {
    queueStatus: "resolved",
    nextReviewState: "blacklisted",
    eventKind: "blacklisted"
  };
};



export const createMusicReviewRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "listBlacklistEntries"
  | "createBlacklistEntry"
  | "revokeBlacklistEntry"
  | "listReviewQueue"
  | "resolveReviewQueueItem"
> => ({
  async listBlacklistEntries() {
    const [rows] = await pool.execute(
      `
        SELECT
          id, scope, track_id AS trackId, source_id AS sourceId, provider_key AS providerKey,
          normalized_value AS normalizedValue, reason, severity, created_by_user_id AS createdByUserId,
          revoked_by_user_id AS revokedByUserId, revoked_at AS revokedAt,
          revocation_reason AS revocationReason, created_at AS createdAt
        FROM music_blacklist_entries
        ORDER BY created_at DESC
        LIMIT 200
      `
    );

    return mapRows<Parameters<typeof mapBlacklist>[0], MusicBlacklistEntryRecord>(rows, mapBlacklist);
  },

  async createBlacklistEntry(input: MusicBlacklistInput & { actorUserId: string }) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO music_blacklist_entries
          (id, scope, track_id, source_id, provider_key, normalized_value, reason, severity, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.scope,
        input.trackId ?? null,
        input.sourceId ?? null,
        optionalText(input.providerKey),
        input.normalizedValue.trim().toLowerCase(),
        input.reason.trim(),
        input.severity ?? "permanent",
        input.actorUserId
      ]
    );

    return (await this.listBlacklistEntries()).find((entry) => entry.id === id) as MusicBlacklistEntryRecord;
  },

  async revokeBlacklistEntry(input) {
    const [result] = await pool.execute(
      `
        UPDATE music_blacklist_entries
        SET revoked_by_user_id = ?, revoked_at = NOW(), revocation_reason = ?
        WHERE id = ? AND revoked_at IS NULL
      `,
      [input.actorUserId, input.reason.trim(), input.id]
    );

    if (typeof result === "object" && result !== null && "affectedRows" in result && result.affectedRows === 0) {
      return null;
    }

    return (await this.listBlacklistEntries()).find((entry) => entry.id === input.id) ?? null;
  },

  async listReviewQueue() {
    const [rows] = await pool.execute(
      `
        SELECT
          id, track_id AS trackId, source_id AS sourceId, request_id AS requestId,
          play_history_id AS playHistoryId, queue_kind AS queueKind, status, priority,
          reason_code AS reasonCode, summary, details, created_by_user_id AS createdByUserId,
          assigned_to_user_id AS assignedToUserId, resolved_by_user_id AS resolvedByUserId,
          resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt
        FROM music_review_queue
        ORDER BY
          CASE WHEN status = 'open' THEN 0 WHEN status = 'in_review' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 200
      `
    );

    return mapRows<Parameters<typeof mapReviewQueue>[0], MusicReviewQueueRecord>(rows, mapReviewQueue);
  },

  async resolveReviewQueueItem(input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const queueItem = await readReviewQueueItem(connection, input.id, true);

      if (!queueItem?.trackId) {
        await connection.rollback();
        return null;
      }

      if (queueItem.status !== "open" && queueItem.status !== "in_review") {
        await connection.rollback();
        return "conflict";
      }

      const previousReviewState = await readTrackReviewState(connection, queueItem.trackId);

      if (!previousReviewState) {
        await connection.rollback();
        return null;
      }

      const resolution = mapReviewResolution(input.action, previousReviewState);
      await connection.execute(
        `
          UPDATE music_tracks
          SET review_state = ?, updated_by_user_id = ?, updated_at = NOW()
          WHERE id = ?
        `,
        [resolution.nextReviewState, input.actorUserId, queueItem.trackId]
      );

      if (input.action === "blacklist") {
        await connection.execute(
          `
            INSERT INTO music_blacklist_entries
              (id, scope, track_id, normalized_value, reason, severity, created_by_user_id)
            VALUES (?, 'track', ?, ?, ?, 'safety', ?)
          `,
          [
            randomUUID(),
            queueItem.trackId,
            queueItem.trackId.toLowerCase(),
            optionalText(input.note) ?? queueItem.summary,
            input.actorUserId
          ]
        );
      }

      await connection.execute(
        `
          UPDATE music_review_queue
          SET status = ?, resolved_by_user_id = ?, resolved_at = NOW(),
            details = COALESCE(?, details), updated_at = NOW()
          WHERE id = ?
        `,
        [resolution.queueStatus, input.actorUserId, optionalText(input.note), input.id]
      );

      await connection.execute(
        `
          INSERT INTO music_review_events
            (id, queue_id, track_id, source_id, actor_user_id, event_kind,
              previous_review_state, new_review_state, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          randomUUID(),
          input.id,
          queueItem.trackId,
          queueItem.sourceId,
          input.actorUserId,
          resolution.eventKind,
          previousReviewState,
          resolution.nextReviewState,
          optionalText(input.note)
        ]
      );

      const updated = await readReviewQueueItem(connection, input.id);
      await connection.commit();

      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
});
