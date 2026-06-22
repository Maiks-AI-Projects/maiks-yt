import {
  canSourceEmitEventKind,
  getEventRegistryEntry,
  isEventKind,
  isEventSourcePlatform
} from "./event-registry.rules.js";
import type { EventKind } from "./event-registry.types.js";
import {
  eventRoutingDestinations,
  eventRoutingNotificationPriorities,
  eventRoutingRuleSourcePlatforms,
  type EventRoutingDestination,
  type EventRoutingRuleDefault,
  type EventRoutingRuleInput,
  type EventRoutingRuleSourcePlatform,
  type EventRoutingRuleValidationIssue,
  type EventRoutingRuleValidationResult,
  isEventRoutingRuleActualSourcePlatform
} from "./event-routing-rules.types.js";

const eventRoutingRuleSourcePlatformSet = new Set<string>(eventRoutingRuleSourcePlatforms);
const eventRoutingDestinationSet = new Set<string>(eventRoutingDestinations);
const eventRoutingNotificationPrioritySet = new Set<string>(eventRoutingNotificationPriorities);

const streamVisibleDestinations = new Set<EventRoutingDestination>([
  "top_notification",
  "center_notification",
  "streamer_feed",
  "streamer_chat",
  "approval_queue"
]);

export const canManageEventRouting = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is string =>
    capability === "*" || capability === "event-routing:manage"
  );

export const isEventRoutingRuleSourcePlatform = (
  value: unknown
): value is EventRoutingRuleSourcePlatform =>
  typeof value === "string" && eventRoutingRuleSourcePlatformSet.has(value);

export const isEventRoutingDestination = (
  value: unknown
): value is EventRoutingDestination =>
  typeof value === "string" && eventRoutingDestinationSet.has(value);

export const isEventRoutingNotificationPriority = (
  value: unknown
): value is EventRoutingRuleInput["notificationPriority"] =>
  typeof value === "string" && eventRoutingNotificationPrioritySet.has(value);

export const isStreamVisibleEventRoutingDestination = (
  destination: EventRoutingDestination
): boolean => streamVisibleDestinations.has(destination);

export const buildDefaultEventRoutingRule = (
  eventKind: EventKind
): EventRoutingRuleDefault => {
  const entry = getEventRegistryEntry(eventKind);

  return {
    eventKind,
    sourcePlatform: "any",
    destination: entry.safety.internalOnly ? "internal_audit" : "ignore",
    enabled: false,
    liveOnly: false,
    offlineOnly: false,
    approvalRequired: entry.safety.approvalRecommended,
    perUserCooldownSeconds: null,
    globalCooldownSeconds: entry.safety.cooldownRecommended ? 60 : null,
    oncePerStream: false,
    templateKey: null,
    themeKey: null,
    soundKey: null,
    notificationPriority: "normal",
    label: entry.label,
    description: entry.description
  };
};

export const validateEventRoutingRule = (
  input: EventRoutingRuleInput
): EventRoutingRuleValidationResult => {
  const issues: EventRoutingRuleValidationIssue[] = [];
  const sourcePlatform = input.sourcePlatform;
  const destination = input.destination;
  const entry = isEventKind(input.eventKind) ? getEventRegistryEntry(input.eventKind) : null;

  if (!isEventRoutingRuleSourcePlatform(sourcePlatform)) {
    issues.push("event_routing_invalid_source");
  }

  if (!isEventRoutingDestination(destination)) {
    issues.push("event_routing_invalid_destination");
  }

  if (!isEventRoutingNotificationPriority(input.notificationPriority)) {
    issues.push("event_routing_invalid_priority");
  }

  if (isEventRoutingRuleSourcePlatform(sourcePlatform)
    && isEventRoutingRuleActualSourcePlatform(sourcePlatform)
    && (!isEventSourcePlatform(sourcePlatform)
      || !canSourceEmitEventKind(sourcePlatform, input.eventKind))) {
    issues.push("event_routing_source_cannot_emit_event");
  }

  if (input.liveOnly && input.offlineOnly) {
    issues.push("event_routing_live_offline_conflict");
  }

  if (input.perUserCooldownSeconds !== null && input.perUserCooldownSeconds < 0) {
    issues.push("event_routing_negative_per_user_cooldown");
  }

  if (input.globalCooldownSeconds !== null && input.globalCooldownSeconds < 0) {
    issues.push("event_routing_negative_global_cooldown");
  }

  if (entry && isEventRoutingDestination(destination) && isStreamVisibleEventRoutingDestination(destination)) {
    if (entry.safety.internalOnly) {
      issues.push("event_routing_internal_only_public_destination");
    }

    if (!entry.safety.overlayEligible) {
      issues.push("event_routing_overlay_ineligible_public_destination");
    }

    if (input.enabled && entry.safety.internalOnly) {
      issues.push("event_routing_internal_only_enabled_public_destination");
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    requiresUserOptOutCheck: Boolean(
      entry?.safety.optOutSupported
        && isEventRoutingDestination(destination)
        && isStreamVisibleEventRoutingDestination(destination)
    ),
    requiresCooldownCheck: Boolean(
      entry?.safety.cooldownRecommended
        && isEventRoutingDestination(destination)
        && isStreamVisibleEventRoutingDestination(destination)
    ),
    requiresApprovalByDefault: Boolean(entry?.safety.approvalRecommended)
  };
};
