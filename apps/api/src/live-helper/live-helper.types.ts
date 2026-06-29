import type {
  EventKind,
  EventRoutingDestination,
  EventRoutingDispatchRoutingOutcome,
  EventSourcePlatform
} from "@maiks-yt/domain/events";
import type { ModeratorGrantAvailability, ModeratorGrantScopeKind, ModeratorTrustLevel } from "@maiks-yt/domain/community";
import type { NotificationSeverity, NotificationSource, NotificationStatus } from "@maiks-yt/domain/notifications";

import type { FakeLocalModerationAuditEntry } from "../fake-local-moderation/index.js";

export type LiveHelperDashboardActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type LiveHelperGrantRecord = {
  id: string;
  userId: string;
  displayName: string;
  roleKey: string;
  roleName: string;
  rolePermissions: readonly string[];
  trustLevel: ModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId: string | null;
  availability: ModeratorGrantAvailability;
  assignedAt: string;
  expiresAt: string | null;
};

export type LiveHelperActiveGrantSummary = Omit<LiveHelperGrantRecord, "rolePermissions">;

export type LiveHelperPendingApprovalSummary = {
  id: string;
  eventHistoryId: string;
  eventKind: EventKind;
  label: string;
  sourcePlatform: EventSourcePlatform;
  destination: EventRoutingDestination;
  notificationPriority: "low" | "normal" | "high" | "urgent";
  actorDisplayName: string | null;
  createdAt: string;
  occurredAt: string;
};

export type LiveHelperNotificationSummary = {
  id: string;
  title: string;
  severity: Exclude<NotificationSeverity, "info">;
  source: NotificationSource;
  status: NotificationStatus;
  actionUrl: string | null;
  createdAt: string;
};

export type LiveHelperEventHistorySummary = {
  id: string;
  eventKind: EventKind;
  label: string;
  sourcePlatform: EventSourcePlatform;
  routingOutcome: EventRoutingDispatchRoutingOutcome | "failed";
  destination: EventRoutingDestination | null;
  actorDisplayName: string | null;
  isTest: boolean;
  isSimulated: boolean;
  occurredAt: string;
};

export type LiveHelperFakeLocalModerationAuditSummary = Pick<
  FakeLocalModerationAuditEntry,
  | "id"
  | "attemptedAt"
  | "source"
  | "actorDisplayName"
  | "action"
  | "outcome"
  | "reason"
  | "targetMessageId"
  | "targetAuthorName"
  | "durationSeconds"
  | "mutedUntil"
  | "note"
  | "providerAction"
>;

export type LiveHelperDashboardSnapshot = {
  ok: true;
  generatedAt: string;
  readOnly: true;
  pendingApprovals: {
    count: number;
    items: readonly LiveHelperPendingApprovalSummary[];
  };
  notifications: {
    openWarningCount: number;
    openCriticalCount: number;
    items: readonly LiveHelperNotificationSummary[];
  };
  activeHelperGrants: {
    count: number;
    items: readonly LiveHelperActiveGrantSummary[];
  };
  recentSimulatedHistory: {
    items: readonly LiveHelperEventHistorySummary[];
  };
  fakeLocalModerationAudit: {
    items: readonly LiveHelperFakeLocalModerationAuditSummary[];
  };
  boundaries: readonly string[];
};

export type LiveHelperDashboardResult =
  | LiveHelperDashboardSnapshot
  | {
    ok: false;
    reason: "live_helper_user_unlinked" | "live_helper_forbidden";
  };

export interface LiveHelperDashboardRepository {
  resolveActor(authUserId: string): Promise<LiveHelperDashboardActor | null>;
  countPendingApprovals(): Promise<number>;
  listPendingApprovals(limit: number): Promise<readonly Omit<LiveHelperPendingApprovalSummary, "label">[]>;
  countOpenWarningCriticalNotifications(): Promise<{
    openWarningCount: number;
    openCriticalCount: number;
  }>;
  listRecentWarningCriticalNotifications(limit: number): Promise<readonly LiveHelperNotificationSummary[]>;
  listActiveHelperGrants(limit: number): Promise<readonly LiveHelperGrantRecord[]>;
  listRecentSimulatedEventHistory(limit: number): Promise<readonly Omit<LiveHelperEventHistorySummary, "label">[]>;
  listRecentFakeLocalModerationAudit(limit: number): Promise<readonly LiveHelperFakeLocalModerationAuditSummary[]>;
}
