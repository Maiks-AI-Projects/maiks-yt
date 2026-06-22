import type { EventKind, EventSourcePlatform } from "./event-registry.types.js";

export const eventRoutingRuleSourcePlatforms = [
  "any",
  "twitch",
  "youtube",
  "discord",
  "website",
  "test/system"
] as const;

export type EventRoutingRuleSourcePlatform = typeof eventRoutingRuleSourcePlatforms[number];

export const eventRoutingDestinations = [
  "ignore",
  "internal_audit",
  "control_panel",
  "top_notification",
  "center_notification",
  "streamer_feed",
  "streamer_chat",
  "approval_queue"
] as const;

export type EventRoutingDestination = typeof eventRoutingDestinations[number];

export const eventRoutingNotificationPriorities = ["low", "normal", "high", "urgent"] as const;

export type EventRoutingNotificationPriority = typeof eventRoutingNotificationPriorities[number];

export type EventRoutingRuleInput = {
  eventKind: EventKind;
  sourcePlatform: EventRoutingRuleSourcePlatform;
  destination: EventRoutingDestination;
  enabled: boolean;
  liveOnly: boolean;
  offlineOnly: boolean;
  approvalRequired: boolean;
  perUserCooldownSeconds: number | null;
  globalCooldownSeconds: number | null;
  oncePerStream: boolean;
  templateKey: string | null;
  themeKey: string | null;
  soundKey: string | null;
  notificationPriority: EventRoutingNotificationPriority;
};

export type EventRoutingRuleValidationIssue =
  | "event_routing_invalid_source"
  | "event_routing_invalid_destination"
  | "event_routing_invalid_priority"
  | "event_routing_source_cannot_emit_event"
  | "event_routing_live_offline_conflict"
  | "event_routing_negative_per_user_cooldown"
  | "event_routing_negative_global_cooldown"
  | "event_routing_internal_only_public_destination"
  | "event_routing_overlay_ineligible_public_destination"
  | "event_routing_internal_only_enabled_public_destination";

export type EventRoutingRuleValidationResult = {
  ok: boolean;
  issues: readonly EventRoutingRuleValidationIssue[];
  requiresUserOptOutCheck: boolean;
  requiresCooldownCheck: boolean;
  requiresApprovalByDefault: boolean;
};

export type EventRoutingRuleDefault = EventRoutingRuleInput & {
  label: string;
  description: string;
};

export type EventRoutingRuleActualSourcePlatform = Exclude<EventRoutingRuleSourcePlatform, "any">;

export const isEventRoutingRuleActualSourcePlatform = (
  sourcePlatform: EventRoutingRuleSourcePlatform
): sourcePlatform is EventSourcePlatform => sourcePlatform !== "any";
