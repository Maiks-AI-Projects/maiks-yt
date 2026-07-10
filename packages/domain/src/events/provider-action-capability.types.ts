import type { EventActionKey } from "./event-action-catalog.types.js";
import type { ProviderEventPlatform } from "./provider-event-catalog.types.js";

export const providerActionCapabilityStatuses = [
  "implemented-fail-closed",
  "gated",
  "unsupported"
] as const;

export type ProviderActionCapabilityStatus = typeof providerActionCapabilityStatuses[number];

export type ProviderActionCapabilityEntry = {
  readonly actionKey: EventActionKey;
  readonly platform: ProviderEventPlatform;
  readonly status: ProviderActionCapabilityStatus;
  readonly requiresLiveContext: boolean;
  readonly reason: string;
};
