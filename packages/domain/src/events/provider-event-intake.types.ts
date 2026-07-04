import type {
  ProviderEventCategory,
  ProviderEventMechanism,
  ProviderEventPlatform,
  ProviderEventSafety
} from "./provider-event-catalog.types.js";

export type ProviderEventIntakeInput = {
  provider: ProviderEventPlatform;
  mechanism: ProviderEventMechanism;
  providerEventName: string;
  sourceEventId?: string | null;
  providerChannelIdentityId?: string | null;
  providerChannelId?: string | null;
  providerMessageId?: string | null;
  actorExternalId?: string | null;
  actorDisplayName?: string | null;
  redactedPayload?: Record<string, unknown> | null;
  occurredAt?: Date | string | null;
  receivedAt?: Date | string | null;
};

export type NormalizedProviderEventIntake = {
  provider: ProviderEventPlatform;
  mechanism: ProviderEventMechanism;
  providerEventName: string;
  internalTrigger: string;
  category: ProviderEventCategory;
  sourceEventId: string | null;
  providerChannelIdentityId: string | null;
  providerChannelId: string | null;
  providerMessageId: string | null;
  actorExternalId: string | null;
  actorDisplayName: string | null;
  catalogKnown: boolean;
  safety: ProviderEventSafety;
  redactedPayload: Record<string, unknown>;
  payloadSchemaVersion: 1;
  occurredAt: Date | null;
  receivedAt: Date;
};

export type ProviderEventIntakeValidationResult =
  | { ok: true; value: NormalizedProviderEventIntake }
  | { ok: false; reason: "provider_event_name_required" | "redacted_payload_required" | "invalid_date" };
