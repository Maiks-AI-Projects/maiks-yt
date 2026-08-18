import type {
  EventKind,
  EventRegistryEntry,
  EventRoutingDestinationCapability,
  EventRoutingDestination,
  EventRoutingNotificationPriority,
  EventRoutingRuleInput,
  EventRoutingRuleSourcePlatform,
  EventRoutingRuleValidationIssue,
  EventRoutingRuleValidationResult,
  EventSourcePlatform
} from "@maiks-yt/domain/events";

import type {
  EventRoutingPlaybackHistory,
  EventRoutingPlaybackProjectionResult
} from "./event-routing-playback.service.js";
import type {
  EventRoutingPlaybackPublishResult
} from "./event-routing-dispatch.types.js";

export type EventRoutingAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type EventRoutingAdminRuleRecord = EventRoutingRuleInput & {
  id: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRoutingAdminRuleListItem = EventRoutingRuleInput & {
  id: string | null;
  label: string;
  description: string;
  safety: EventRegistryEntry["safety"];
  validation: EventRoutingRuleValidationResult;
  destinationCapability: EventRoutingDestinationCapability;
  persisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EventRoutingAdminUpsertInput = EventRoutingRuleInput & {
  actorUserId: string;
};

export type EventRoutingApprovalQueueStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export type EventRoutingApprovalReviewAction = "approve" | "reject";

export type EventRoutingApprovalReviewPlayback = {
  projected: EventRoutingPlaybackProjectionResult;
  published: EventRoutingPlaybackPublishResult | null;
};

export type EventRoutingAdminSafeContext = {
  displayText: string | null;
  displayName: string | null;
  title: string | null;
  projectLabel: string | null;
  amount: number | string | null;
  currency: string | null;
};

export type EventRoutingAdminApprovalRepositoryRecord = {
  id: string;
  eventHistoryId: string;
  routingRuleId: string | null;
  destination: EventRoutingDestination;
  status: EventRoutingApprovalQueueStatus;
  reviewerUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  event: EventRoutingPlaybackHistory & {
    sourceEventId: string | null;
    routingOutcome: "queued_for_approval";
    userId: string | null;
    actorUserId: string | null;
    actorExternalId: string | null;
    streamSessionId: string | null;
    streamScheduleEntryId: string | null;
    sessionId: string | null;
    occurredAt: string;
  };
  rule: {
    notificationPriority: EventRoutingNotificationPriority;
    sourcePlatform: EventSourcePlatform | "any" | null;
  };
};

export type EventRoutingAdminApprovalRecord = {
  id: string;
  productionEvent: boolean;
  destination: EventRoutingDestination;
  status: EventRoutingApprovalQueueStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  event: {
    sourcePlatform: EventSourcePlatform;
    eventKind: EventKind;
    occurredAt: string;
    context: EventRoutingAdminSafeContext;
  };
  rule: {
    notificationPriority: EventRoutingNotificationPriority;
    sourcePlatform: EventSourcePlatform | "any" | null;
  };
  label: string;
  description: string;
  safety: EventRegistryEntry["safety"];
  playback: EventRoutingApprovalReviewPlayback | null;
};

export type EventRoutingAdminListResult =
  | {
    ok: true;
    rules: readonly EventRoutingAdminRuleListItem[];
    destinationCapabilities: readonly EventRoutingDestinationCapability[];
  }
  | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  };

export type EventRoutingAdminUpdateResult =
  | {
    ok: true;
    rule: EventRoutingAdminRuleListItem;
  }
  | {
    ok: false;
    reason:
      | "event_routing_admin_user_unlinked"
      | "event_routing_admin_forbidden"
      | "event_routing_admin_invalid_input";
    issues?: readonly EventRoutingRuleValidationIssue[];
  };

export type EventRoutingAdminApprovalListResult =
  | {
    ok: true;
    approvals: readonly EventRoutingAdminApprovalRecord[];
  }
  | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  };

export type EventRoutingAdminApprovalReviewResult =
  | {
    ok: true;
    approval: EventRoutingAdminApprovalRecord;
  }
  | {
    ok: false;
    reason:
      | "event_routing_admin_user_unlinked"
      | "event_routing_admin_forbidden"
      | "event_routing_admin_approval_not_found"
      | "event_routing_admin_production_execution_unavailable";
    playback?: EventRoutingApprovalReviewPlayback;
  };

export type EventRoutingAdminDeleteResult =
  | {
    ok: true;
    removed: boolean;
    fallback: EventRoutingAdminRuleListItem;
  }
  | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  };

export type EventRoutingAdminCooldownSummary = {
  activeCount: number;
  nearestExpiry: string | null;
  rulePersisted: boolean;
};

export type EventRoutingAdminCooldownSummaryResult =
  | {
    ok: true;
    summary: EventRoutingAdminCooldownSummary;
  }
  | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  };

export type EventRoutingOperationalHistoryRepositoryRecord = {
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  routingOutcome:
    | "ignored"
    | "stored_internal"
    | "routed"
    | "queued_for_approval"
    | "blocked_opt_out"
    | "blocked_cooldown"
    | "blocked_safety"
    | "failed";
  destination: EventRoutingDestination | null;
  actorDisplayName: string | null;
  isTest: boolean;
  isSimulated: boolean;
  testResettable: boolean;
  redactedPayload: Record<string, unknown>;
  occurredAt: string;
};

export type EventRoutingAdminOperationalHistoryRecord = {
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  label: string;
  destination: EventRoutingDestination | null;
  routingOutcome: EventRoutingOperationalHistoryRepositoryRecord["routingOutcome"];
  occurredAt: string;
  context: EventRoutingAdminSafeContext;
};

export type EventRoutingAdminHistoryResult =
  | {
    ok: true;
    history: readonly EventRoutingAdminOperationalHistoryRecord[];
  }
  | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  };

export interface EventRoutingAdminRepository {
  resolveActor(authUserId: string): Promise<EventRoutingAdminActor | null>;
  listRules(): Promise<readonly EventRoutingAdminRuleRecord[]>;
  listPendingApprovals(limit: number): Promise<readonly EventRoutingAdminApprovalRepositoryRecord[]>;
  getPendingApproval(id: string): Promise<EventRoutingAdminApprovalRepositoryRecord | null>;
  upsertRule(input: EventRoutingAdminUpsertInput): Promise<EventRoutingAdminRuleRecord>;
  reviewApproval(input: {
    id: string;
    status: Extract<EventRoutingApprovalQueueStatus, "approved" | "rejected">;
    reviewerUserId: string;
    reviewNote: string | null;
    playback: EventRoutingApprovalReviewPlayback | null;
  }): Promise<EventRoutingAdminApprovalRepositoryRecord | null>;
  getRule(eventKind: EventKind, sourcePlatform: EventRoutingRuleInput["sourcePlatform"]): Promise<EventRoutingAdminRuleRecord | null>;
  deleteRule(eventKind: EventKind, sourcePlatform: EventRoutingRuleSourcePlatform): Promise<boolean>;
  getActiveCooldownSummary(input: {
    routingRuleId: string;
    eventKind: EventKind;
    sourcePlatform: EventRoutingRuleSourcePlatform;
  }): Promise<Omit<EventRoutingAdminCooldownSummary, "rulePersisted">>;
  listOperationalHistory(limit: number): Promise<readonly EventRoutingOperationalHistoryRepositoryRecord[]>;
}
