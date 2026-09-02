import type { DatabasePool } from "@maiks-yt/database";
import type { StreamCountdownStartedPayload } from "@maiks-yt/events";

type InsertResult = {
  affectedRows?: number;
};

type ExistingRow = {
  payload: StreamCountdownStartedPayload | string;
  streamSessionId: string | null;
  type: string;
};

export type CountdownStartedRecordResult = "accepted" | "duplicate";

export const createCountdownStartedRecorder = (pool: Pick<DatabasePool, "execute">) =>
  async (payload: StreamCountdownStartedPayload): Promise<CountdownStartedRecordResult> => {
    const [result] = await pool.execute(
      `
        INSERT IGNORE INTO overlay_events
          (id, stream_session_id, type, priority, zone, payload, created_at)
        VALUES (?, ?, 'stream.countdown.started', 'normal', NULL, ?, ?)
      `,
      [
        payload.occurrenceId,
        payload.plannedStreamId ?? null,
        JSON.stringify(payload),
        new Date(payload.startedAt)
      ]
    );

    if (Number((result as InsertResult).affectedRows ?? 0) > 0) {
      return "accepted";
    }

    const [rows] = await pool.execute(
      `
        SELECT
          stream_session_id AS streamSessionId,
          type,
          payload
        FROM overlay_events
        WHERE id = ?
        LIMIT 1
      `,
      [payload.occurrenceId]
    );
    const existing = Array.isArray(rows) ? rows[0] as ExistingRow | undefined : undefined;
    const existingPayload = typeof existing?.payload === "string"
      ? JSON.parse(existing.payload) as StreamCountdownStartedPayload
      : existing?.payload;

    if (
      existing?.type !== "stream.countdown.started"
      || existing.streamSessionId !== (payload.plannedStreamId ?? null)
      || !existingPayload
      || existingPayload.occurrenceId !== payload.occurrenceId
      || existingPayload.countdownRuntimeId !== payload.countdownRuntimeId
      || existingPayload.durationSeconds !== payload.durationSeconds
      || existingPayload.triggerSource !== payload.triggerSource
    ) {
      throw new Error("Countdown occurrence identity conflicts with an existing durable event.");
    }

    return "duplicate";
  };
