import type {
  EventKind,
  EventRegistryEntry,
  EventRoutingDestination,
  EventRoutingNotificationPriority,
  EventRoutingRuleInput,
  EventRoutingRuleValidationIssue,
  EventRoutingRuleValidationResult,
  EventSourcePlatform
} from "@maiks-yt/domain/events";

import type {
  EventRoutingPlaybackHistory,
  EventRoutingPlaybackProjectionResult
} from "./event-routing-playback.service.js";
import type {
  EventRoutingPlaybackPublishResult,
  EventRoutingPlaybackPublisher
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

export type EventRoutingAdminApprovalRecord = {
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
  label: string;
  description: string;
  safety: EventRegistryEntry["safety"];
  playback: EventRoutingApprovalReviewPlayback | null;
};

export type EventRoutingAdminListResult =
  | {
    ok: true;
    rules: readonly EventRoutingAdminRuleListItem[];
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
      | "event_routing_admin_approval_playback_blocked";
    playback?: EventRoutingApprovalReviewPlayback;
  };

export interface EventRoutingAdminRepository {
  resolveActor(authUserId: string): Promise<EventRoutingAdminActor | null>;
  listRules(): Promise<readonly EventRoutingAdminRuleRecord[]>;
  listPendingApprovals(limit: number): Promise<readonly EventRoutingAdminApprovalRecord[]>;
  getPendingApproval(id: string): Promise<EventRoutingAdminApprovalRecord | null>;
  upsertRule(input: EventRoutingAdminUpsertInput): Promise<EventRoutingAdminRuleRecord>;
  reviewApproval(input: {
    id: string;
    status: Extract<EventRoutingApprovalQueueStatus, "approved" | "rejected">;
    reviewerUserId: string;
    reviewNote: string | null;
    playback: EventRoutingApprovalReviewPlayback | null;
  }): Promise<EventRoutingAdminApprovalRecord | null>;
  getRule(eventKind: EventKind, sourcePlatform: EventRoutingRuleInput["sourcePlatform"]): Promise<EventRoutingAdminRuleRecord | null>;
}

export type EventRoutingAdminPlaybackPublisher = EventRoutingPlaybackPublisher;
