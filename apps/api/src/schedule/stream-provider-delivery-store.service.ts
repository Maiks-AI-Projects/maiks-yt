import { randomUUID } from "node:crypto";

import type {
  StreamScheduleChannelTarget,
  StreamScheduleStatus,
  StreamScheduleVisibility,
  StreamProviderDeliveryBinding
} from "@maiks-yt/domain/schedule";
import { buildStreamProviderDeliveryIntents } from "@maiks-yt/domain/schedule";

type SqlValue = string | number | boolean | Date | null;

export type StreamProviderDeliveryExecutor = {
  execute: (sql: string, values?: SqlValue[]) => Promise<[unknown, unknown]>;
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
