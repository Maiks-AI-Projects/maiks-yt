import type { DatabasePool } from "@maiks-yt/database";
import type { NormalizedProviderEventIntake } from "@maiks-yt/domain/events";
import { randomUUID } from "node:crypto";

import type { ProviderEventIntakeLogRepository } from "./provider-event-intake-log.types.js";

type InsertResult = {
  affectedRows?: number;
};

const toSqlDate = (value: Date | null): Date | null => value;

export const createProviderEventIntakeLogRepository = (
  pool: DatabasePool
): ProviderEventIntakeLogRepository => ({
  async write(input: NormalizedProviderEventIntake): Promise<{ inserted: boolean }> {
    const [result] = await pool.execute(
      `
        INSERT IGNORE INTO provider_event_intake_logs
          (
            id,
            provider,
            mechanism,
            provider_event_name,
            internal_trigger,
            category,
            source_event_id,
            provider_channel_identity_id,
            provider_channel_id,
            provider_message_id,
            actor_external_id,
            actor_display_name,
            catalog_known,
            money_shaped,
            moderation_shaped,
            auth_or_token_shaped,
            high_volume,
            overlay_eligible_by_default,
            processing_status,
            redacted_payload,
            payload_schema_version,
            occurred_at,
            received_at,
            created_at
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 'stored', ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        input.provider,
        input.mechanism,
        input.providerEventName,
        input.internalTrigger,
        input.category,
        input.sourceEventId,
        input.providerChannelIdentityId,
        input.providerChannelId,
        input.providerMessageId,
        input.actorExternalId,
        input.actorDisplayName,
        input.catalogKnown,
        input.safety.moneyShaped,
        input.safety.moderationShaped,
        input.safety.authOrTokenShaped,
        input.safety.highVolume,
        JSON.stringify(input.redactedPayload),
        input.payloadSchemaVersion,
        toSqlDate(input.occurredAt),
        input.receivedAt,
        input.receivedAt
      ]
    );

    return {
      inserted: Number((result as InsertResult).affectedRows ?? 0) > 0
    };
  }
});
