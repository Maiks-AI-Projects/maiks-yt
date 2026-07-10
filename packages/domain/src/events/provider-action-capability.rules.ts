import type { EventActionKey } from "./event-action-catalog.types.js";
import type {
  ProviderActionCapabilityEntry,
  ProviderActionCapabilityStatus
} from "./provider-action-capability.types.js";
import type { ProviderEventPlatform } from "./provider-event-catalog.types.js";

const capability = (
  platform: ProviderEventPlatform,
  actionKey: EventActionKey,
  status: ProviderActionCapabilityStatus,
  reason: string,
  requiresLiveContext = false
): ProviderActionCapabilityEntry => ({
  actionKey,
  platform,
  reason,
  requiresLiveContext,
  status
});

export const providerActionCapabilityMatrix = [
  capability("discord", "provider.warn-in-origin-chat", "implemented-fail-closed", "Uses the Discord bot token and provider channel/user context; skipped safely when context or credentials are missing."),
  capability("twitch", "provider.warn-in-origin-chat", "implemented-fail-closed", "Uses a writable Twitch chat bot token and provider channel/user context; skipped safely when context or credentials are missing."),
  capability("youtube", "provider.warn-in-origin-chat", "implemented-fail-closed", "Uses the selected active live chat and a write-scoped YouTube owner credential; existing read-only credentials must be re-consented.", true),
  capability("discord", "provider.delete-origin-message", "gated", "Discord message deletion needs a reviewed provider-write moderation adapter, permission checks, and audit semantics."),
  capability("twitch", "provider.delete-origin-message", "gated", "Twitch message deletion needs a reviewed provider-write moderation adapter, broadcaster/moderator token scopes, and audit semantics."),
  capability("youtube", "provider.delete-origin-message", "gated", "YouTube message deletion needs a reviewed provider-write moderation adapter, live chat context, write scope, and audit semantics.", true),
  capability("discord", "provider.timeout-origin-user", "gated", "Discord timeout needs a reviewed provider-write moderation adapter, duration limits, permission checks, and audit semantics."),
  capability("twitch", "provider.timeout-origin-user", "gated", "Twitch timeout needs a reviewed provider-write moderation adapter, duration limits, moderator token scopes, and audit semantics."),
  capability("youtube", "provider.timeout-origin-user", "gated", "YouTube does not have a direct timeout shape matching Twitch; any equivalent must be reviewed before implementation.", true),
  capability("discord", "provider.ban-origin-user", "gated", "Discord bans are destructive and need explicit owner-reviewed provider enforcement scope before implementation."),
  capability("twitch", "provider.ban-origin-user", "gated", "Twitch bans are destructive and need explicit owner-reviewed provider enforcement scope before implementation."),
  capability("youtube", "provider.ban-origin-user", "gated", "YouTube live-chat bans are destructive and need explicit owner-reviewed provider enforcement scope before implementation.", true)
] as const satisfies readonly ProviderActionCapabilityEntry[];

export const listProviderActionCapabilities = (): ProviderActionCapabilityEntry[] =>
  providerActionCapabilityMatrix.map((entry) => ({ ...entry }));
