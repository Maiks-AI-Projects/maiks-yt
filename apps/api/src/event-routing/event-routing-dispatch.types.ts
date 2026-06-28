import type {
  EventKind,
  EventRoutingDestination,
  EventRoutingDispatchRoutingOutcome,
  EventRoutingRuleInput,
  EventSourcePlatform,
  SafeSimulatedEventRoutingDispatchIssue
} from "@maiks-yt/domain/events";

import type { EventRoutingPlaybackProjection } from "./event-routing-playback.service.js";

export type EventRoutingDispatchRuleRecord = EventRoutingRuleInput & {
  id: string;
};

export type EventRoutingDispatchRequest = {
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  explicitSimulation: boolean;
  isRealMoney: boolean;
  sourceEventId: string | null;
  actorUserId: string | null;
  actorExternalId: string | null;
  actorDisplayName: string | null;
  userId: string | null;
  streamSessionId: string | null;
  streamScheduleEntryId: string | null;
  sessionId: string | null;
  redactedPayload: Record<string, unknown>;
  occurredAt: string | null;
};

export type EventRoutingHistoryInsert = {
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  sourceEventId: string | null;
  routingRuleId: string | null;
  routingOutcome: EventRoutingDispatchRoutingOutcome;
  destination: EventRoutingDestination | null;
  actorUserId: string | null;
  actorExternalId: string | null;
  actorDisplayName: string | null;
  userId: string | null;
  streamSessionId: string | null;
  streamScheduleEntryId: string | null;
  sessionId: string | null;
  redactedPayload: Record<string, unknown>;
  occurredAt: Date;
};

export type EventRoutingHistoryRecord = EventRoutingHistoryInsert & {
  id: string;
  isTest: true;
  isSimulated: true;
  isRealMoney: false;
  testResettable: true;
  createdAt: string;
};

export type EventRoutingPlaybackPublishResult = {
  emitted: boolean;
  reason?: "top_notifications_disabled" | "center_notifications_disabled" | "event_routing_playback_inert_destination";
  activeOverlayConnections?: number;
};

export type EventRoutingPlaybackPublisher = (
  projection: EventRoutingPlaybackProjection
) => Promise<EventRoutingPlaybackPublishResult> | EventRoutingPlaybackPublishResult;

export type EventRoutingApprovalQueueRecord = {
  id: string;
  eventHistoryId: string;
  routingRuleId: string | null;
  destination: EventRoutingDestination;
  status: "pending";
  createdAt: string;
};

export type EventRoutingCooldownScope = "global" | "user" | "stream" | "user_stream";

export type EventRoutingCooldownCheck = {
  routingRuleId: string;
  cooldownKey: string;
};

export type EventRoutingCooldownInsert = EventRoutingCooldownCheck & {
  eventKind: EventKind;
  sourcePlatform: EventSourcePlatform;
  scope: EventRoutingCooldownScope;
  actorUserId: string | null;
  actorExternalId: string | null;
  streamSessionId: string | null;
  streamScheduleEntryId: string | null;
  windowStartedAt: Date;
  windowEndsAt: Date;
  lastEventHistoryId: string;
};

export type EventRoutingActiveCooldown = {
  id: string;
  cooldownKey: string;
  windowEndsAt: string;
  hitCount: number;
};

export type EventRoutingDispatchResult =
  | {
    ok: true;
    status: EventRoutingDispatchRoutingOutcome;
    destination: EventRoutingDestination | null;
    history: EventRoutingHistoryRecord;
    approvalQueue: EventRoutingApprovalQueueRecord | null;
    cooldownsRecorded: number;
    publicPlayback: boolean;
    playback: EventRoutingPlaybackPublishResult | null;
  }
  | {
    ok: false;
    reason:
      | "event_routing_dispatch_invalid_input"
      | "event_routing_dispatch_invalid_rule"
      | "event_routing_dispatch_unavailable";
    issues?: readonly SafeSimulatedEventRoutingDispatchIssue[];
    ruleIssues?: readonly string[];
  };

export interface EventRoutingDispatchRepository {
  getRule(eventKind: EventKind, sourcePlatform: EventSourcePlatform | "any"): Promise<EventRoutingDispatchRuleRecord | null>;
  isUserOptedOut(input: { userId: string; eventKind: EventKind }): Promise<boolean>;
  findActiveCooldown(input: EventRoutingCooldownCheck & { now: Date }): Promise<EventRoutingActiveCooldown | null>;
  writeHistory(input: EventRoutingHistoryInsert): Promise<EventRoutingHistoryRecord>;
  queueApproval(input: {
    eventHistoryId: string;
    routingRuleId: string | null;
    destination: EventRoutingDestination;
  }): Promise<EventRoutingApprovalQueueRecord>;
  recordCooldown(input: EventRoutingCooldownInsert): Promise<void>;
}
