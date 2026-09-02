import { randomUUID } from "node:crypto";

import type {
  StreamScheduleChannelTarget,
  StreamScheduleStatus,
  StreamScheduleVisibility,
  StreamProviderDeliveryBinding,
  StreamProviderDeliveryOperation
} from "@maiks-yt/domain/schedule";
import { buildStreamProviderDeliveryIntents } from "@maiks-yt/domain/schedule";

type SqlValue = string | number | boolean | Date | null;

export type StreamProviderDeliveryExecutor = {
  execute: (sql: string, values?: SqlValue[]) => Promise<[unknown, unknown]>;
};

type QueryResult = {
  affectedRows?: number;
};

export type StreamProviderDeliveryProcessorClaim = {
  id: string;
  deliveryBindingId: string;
  scheduleEntryId: string;
  channelRef: string;
  provider: "twitch" | "youtube";
  operation: StreamProviderDeliveryOperation;
  desiredRevision: number;
  idempotencyKey: string;
  attemptCount: number;
  bindingDesiredRevision: number;
  bindingStatus: StreamProviderDeliveryBinding["status"];
  providerChannelIdSnapshot: string;
  displayNameSnapshot: string;
  handleSnapshot: string | null;
  providerResourceId: string | null;
  providerStreamId: string | null;
  providerCategoryId: string | null;
  scheduleTitle: string;
  scheduleDescription: string | null;
  scheduleStartsAt: Date;
  scheduleEndsAt: Date | null;
  scheduleVisibility: StreamScheduleVisibility;
  scheduleStatus: StreamScheduleStatus;
  scheduleChannelKey: string;
};

export type StreamProviderDeliveryProcessorRepository = {
  claimPending(input: {
    limit: number;
    now: Date;
    workerId: string;
  }): Promise<readonly StreamProviderDeliveryProcessorClaim[]>;
  markSuperseded(input: {
    claimedBy: string;
    completedAt: Date;
    intentId: string;
    reason: string;
  }): Promise<boolean>;
  recordOutcome(input: {
    bindingId: string;
    bindingDesiredRevision: number;
    bindingStatus: Exclude<StreamProviderDeliveryBinding["status"], "pending" | "removed">;
    claimedBy: string;
    completedAt?: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    intentId: string;
    intentStatus: "succeeded" | "failed" | "retry-wait";
    lastAttemptAt: Date;
    nextAvailableAt?: Date | null;
    providerCategoryId?: string | null;
    providerResourceId?: string | null;
    providerStreamId?: string | null;
    successAt?: Date | null;
  }): Promise<"applied" | "superseded">;
};

type DeliveryBindingRow = Pick<
  StreamProviderDeliveryBinding,
  "id" | "channelRef" | "provider" | "desiredRevision" | "providerResourceId" | "providerStreamId"
>;

const readBindingsForUpdate = async (
  executor: StreamProviderDeliveryExecutor,
  scheduleEntryId: string
): Promise<DeliveryBindingRow[]> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        channel_ref AS channelRef,
        provider,
        desired_revision AS desiredRevision,
        provider_resource_id AS providerResourceId,
        provider_stream_id AS providerStreamId
      FROM stream_provider_delivery_bindings
      WHERE schedule_entry_id = ?
      FOR UPDATE
    `,
    [scheduleEntryId]
  );

  return Array.isArray(rows) ? rows as DeliveryBindingRow[] : [];
};

export const enqueueStreamProviderDeliveries = async (input: {
  executor: StreamProviderDeliveryExecutor;
  scheduleEntryId: string;
  channelTargets: readonly StreamScheduleChannelTarget[];
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
}): Promise<{ bindingCount: number; intentCount: number }> => {
  const currentRefs = new Set(input.channelTargets.map((target) => target.channelRef));
  const existingBindings = await readBindingsForUpdate(input.executor, input.scheduleEntryId);
  const existingByRef = new Map(existingBindings.map((binding) => [binding.channelRef, binding]));

  for (const existing of existingBindings) {
    if (currentRefs.has(existing.channelRef)) continue;
    await input.executor.execute(
      `
        UPDATE stream_provider_delivery_bindings
        SET status = 'removed',
            desired_revision = desired_revision + 1,
            last_error_code = ?,
            last_error_message = ?,
            updated_at = NOW()
        WHERE id = ?
      `,
      [
        existing.providerResourceId ? "provider-removal-confirmation-required" : null,
        existing.providerResourceId
          ? "The local channel target was removed, but the provider event still needs explicit deletion confirmation."
          : null,
        existing.id
      ]
    );
  }

  let intentCount = 0;
  for (const target of input.channelTargets) {
    const existing = existingByRef.get(target.channelRef);
    const bindingId = existing?.id ?? randomUUID();
    const desiredRevision = existing ? existing.desiredRevision + 1 : 1;

    if (existing) {
      await input.executor.execute(
        `
          UPDATE stream_provider_delivery_bindings
          SET provider = ?,
              provider_channel_id_snapshot = ?,
              display_name_snapshot = ?,
              handle_snapshot = ?,
              desired_revision = ?,
              status = 'pending',
              last_error_code = NULL,
              last_error_message = NULL,
              updated_at = NOW()
          WHERE id = ?
        `,
        [
          target.provider,
          target.providerChannelId,
          target.displayName,
          target.handle,
          desiredRevision,
          bindingId
        ]
      );
    } else {
      await input.executor.execute(
        `
          INSERT INTO stream_provider_delivery_bindings
            (id, schedule_entry_id, channel_ref, provider, provider_channel_id_snapshot,
             display_name_snapshot, handle_snapshot, desired_revision, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `,
        [
          bindingId,
          input.scheduleEntryId,
          target.channelRef,
          target.provider,
          target.providerChannelId,
          target.displayName,
          target.handle,
          desiredRevision
        ]
      );
    }

    const intents = buildStreamProviderDeliveryIntents({
      scheduleEntryId: input.scheduleEntryId,
      channelRef: target.channelRef,
      provider: target.provider,
      desiredRevision,
      phase: "schedule",
      visibility: input.visibility,
      status: input.status
    });

    if (intents.length === 0 && existing?.providerResourceId) {
      await input.executor.execute(
        `
          UPDATE stream_provider_delivery_bindings
          SET status = 'degraded',
              last_error_code = 'provider-removal-confirmation-required',
              last_error_message = 'The provider event exists, but the current local state cannot remove or hide it without explicit confirmation.',
              updated_at = NOW()
          WHERE id = ?
        `,
        [bindingId]
      );
    }

    for (const intent of intents) {
      await input.executor.execute(
        `
          INSERT INTO stream_provider_delivery_intents
            (id, delivery_binding_id, schedule_entry_id, channel_ref, operation,
             desired_revision, idempotency_key, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `,
        [
          randomUUID(),
          bindingId,
          intent.scheduleEntryId,
          intent.channelRef,
          intent.operation,
          intent.desiredRevision,
          intent.idempotencyKey
        ]
      );
      intentCount += 1;
    }
  }

  return { bindingCount: input.channelTargets.length, intentCount };
};

const affectedRows = (result: unknown): number => {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return 0;
  }

  const value = (result as QueryResult).affectedRows;

  return typeof value === "number" ? value : 0;
};

export const createStreamProviderDeliveryProcessorRepository = (
  executor: StreamProviderDeliveryExecutor
): StreamProviderDeliveryProcessorRepository => ({
  async claimPending(input) {
    const boundedLimit = Number.isSafeInteger(input.limit) && input.limit > 0
      ? Math.min(input.limit, 25)
      : 10;
    const [rows] = await executor.execute(
      `
        SELECT
          stream_provider_delivery_intents.id,
          stream_provider_delivery_intents.delivery_binding_id AS deliveryBindingId,
          stream_provider_delivery_intents.schedule_entry_id AS scheduleEntryId,
          stream_provider_delivery_intents.channel_ref AS channelRef,
          stream_provider_delivery_intents.operation,
          stream_provider_delivery_intents.desired_revision AS desiredRevision,
          stream_provider_delivery_intents.idempotency_key AS idempotencyKey,
          stream_provider_delivery_intents.attempt_count AS attemptCount,
          stream_provider_delivery_bindings.provider,
          stream_provider_delivery_bindings.desired_revision AS bindingDesiredRevision,
          stream_provider_delivery_bindings.status AS bindingStatus,
          stream_provider_delivery_bindings.provider_channel_id_snapshot AS providerChannelIdSnapshot,
          stream_provider_delivery_bindings.display_name_snapshot AS displayNameSnapshot,
          stream_provider_delivery_bindings.handle_snapshot AS handleSnapshot,
          stream_provider_delivery_bindings.provider_resource_id AS providerResourceId,
          stream_provider_delivery_bindings.provider_stream_id AS providerStreamId,
          stream_provider_delivery_bindings.provider_category_id AS providerCategoryId,
          stream_schedule_entries.title AS scheduleTitle,
          stream_schedule_entries.description AS scheduleDescription,
          stream_schedule_entries.starts_at AS scheduleStartsAt,
          stream_schedule_entries.ends_at AS scheduleEndsAt,
          stream_schedule_entries.visibility AS scheduleVisibility,
          stream_schedule_entries.status AS scheduleStatus,
          stream_schedule_entries.channel_key AS scheduleChannelKey
        FROM stream_provider_delivery_intents
        INNER JOIN stream_provider_delivery_bindings
          ON stream_provider_delivery_bindings.id = stream_provider_delivery_intents.delivery_binding_id
        INNER JOIN stream_schedule_entries
          ON stream_schedule_entries.id = stream_provider_delivery_intents.schedule_entry_id
        WHERE stream_provider_delivery_intents.status IN ('pending', 'retry-wait')
          AND stream_provider_delivery_intents.available_at <= ?
        ORDER BY stream_provider_delivery_intents.created_at, stream_provider_delivery_intents.id
        LIMIT ${boundedLimit}
      `,
      [input.now]
    );
    const pendingRows = Array.isArray(rows)
      ? rows as StreamProviderDeliveryProcessorClaim[]
      : [];
    const claimed: StreamProviderDeliveryProcessorClaim[] = [];

    for (const row of pendingRows) {
      const [result] = await executor.execute(
        `
          UPDATE stream_provider_delivery_intents
          SET status = 'processing',
              attempt_count = attempt_count + 1,
              claimed_at = ?,
              claimed_by = ?,
              updated_at = NOW()
          WHERE id = ?
            AND status IN ('pending', 'retry-wait')
            AND available_at <= ?
        `,
        [input.now, input.workerId, row.id, input.now]
      );

      if (affectedRows(result) > 0) {
        claimed.push(row);
      }
    }

    return claimed;
  },

  async markSuperseded(input) {
    const [result] = await executor.execute(
      `
        UPDATE stream_provider_delivery_intents
        SET status = 'superseded',
            completed_at = ?,
            last_error_code = ?,
            last_error_message = ?,
            updated_at = NOW()
        WHERE id = ?
          AND status = 'processing'
          AND claimed_by = ?
      `,
      [
        input.completedAt,
        "provider-intent-superseded",
        input.reason,
        input.intentId,
        input.claimedBy
      ]
    );

    return affectedRows(result) > 0;
  },

  async recordOutcome(input) {
    const [result] = await executor.execute(
      `
        UPDATE stream_provider_delivery_intents
        INNER JOIN stream_provider_delivery_bindings
          ON stream_provider_delivery_bindings.id = stream_provider_delivery_intents.delivery_binding_id
        SET stream_provider_delivery_bindings.status = ?,
            stream_provider_delivery_bindings.last_attempt_at = ?,
            stream_provider_delivery_bindings.last_success_at = COALESCE(?, stream_provider_delivery_bindings.last_success_at),
            stream_provider_delivery_bindings.last_error_code = ?,
            stream_provider_delivery_bindings.last_error_message = ?,
            stream_provider_delivery_bindings.provider_resource_id = COALESCE(?, stream_provider_delivery_bindings.provider_resource_id),
            stream_provider_delivery_bindings.provider_stream_id = COALESCE(?, stream_provider_delivery_bindings.provider_stream_id),
            stream_provider_delivery_bindings.provider_category_id = COALESCE(?, stream_provider_delivery_bindings.provider_category_id),
            stream_provider_delivery_bindings.updated_at = NOW(),
            stream_provider_delivery_intents.status = ?,
            stream_provider_delivery_intents.completed_at = ?,
            stream_provider_delivery_intents.available_at = COALESCE(?, stream_provider_delivery_intents.available_at),
            stream_provider_delivery_intents.last_error_code = ?,
            stream_provider_delivery_intents.last_error_message = ?,
            stream_provider_delivery_intents.updated_at = NOW()
        WHERE stream_provider_delivery_intents.id = ?
          AND stream_provider_delivery_intents.delivery_binding_id = ?
          AND stream_provider_delivery_intents.desired_revision = ?
          AND stream_provider_delivery_intents.status = 'processing'
          AND stream_provider_delivery_intents.claimed_by = ?
          AND stream_provider_delivery_bindings.id = ?
          AND stream_provider_delivery_bindings.desired_revision = ?
      `,
      [
        input.bindingStatus,
        input.lastAttemptAt,
        input.successAt ?? null,
        input.errorCode,
        input.errorMessage,
        input.providerResourceId ?? null,
        input.providerStreamId ?? null,
        input.providerCategoryId ?? null,
        input.intentStatus,
        input.completedAt ?? null,
        input.nextAvailableAt ?? null,
        input.errorCode,
        input.errorMessage,
        input.intentId,
        input.bindingId,
        input.bindingDesiredRevision,
        input.claimedBy,
        input.bindingId,
        input.bindingDesiredRevision
      ]
    );

    return affectedRows(result) > 0 ? "applied" : "superseded";
  }
});
