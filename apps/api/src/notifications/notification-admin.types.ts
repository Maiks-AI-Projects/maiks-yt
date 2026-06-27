import type {
  NotificationCreateInput,
  NotificationRecord,
  NotificationStatus,
  NotificationValidationIssue
} from "@maiks-yt/domain/notifications";

export type NotificationAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type NotificationListOptions = {
  includeArchived: boolean;
  limit: number;
};

export type NotificationCreateRecordInput = NotificationCreateInput & {
  createdByUserId: string | null;
};

export type NotificationStatusUpdateInput = {
  id: string;
  status: Extract<NotificationStatus, "read" | "archived">;
};

export type NotificationPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string | null;
};

export type NotificationPushSubscriptionRecord = NotificationPushSubscriptionInput & {
  id: string;
  userId: string;
  endpointHash: string;
  lastPushAt: string | null;
  lastError: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationListResult =
  | {
    ok: true;
    notifications: readonly NotificationRecord[];
    unreadCount: number;
    criticalUnreadCount: number;
  }
  | {
    ok: false;
    reason: "notification_admin_user_unlinked" | "notification_admin_forbidden";
  };

export type NotificationCreateResult =
  | {
    ok: true;
    notification: NotificationRecord;
  }
  | {
    ok: false;
    reason: "notification_invalid_input";
    issues: readonly NotificationValidationIssue[];
  };

export type NotificationDevCreateResult =
  | NotificationCreateResult
  | {
    ok: false;
    reason: "notification_dev_secret_missing" | "notification_dev_secret_invalid";
  };

export type NotificationStatusUpdateResult =
  | {
    ok: true;
    notification: NotificationRecord;
  }
  | {
    ok: false;
    reason:
      | "notification_admin_user_unlinked"
      | "notification_admin_forbidden"
      | "notification_not_found";
  };

export type NotificationPushConfigResult =
  | {
    ok: true;
    enabled: boolean;
    publicKey: string | null;
  }
  | {
    ok: false;
    reason: "notification_admin_user_unlinked" | "notification_admin_forbidden";
  };

export type NotificationPushSubscriptionResult =
  | {
    ok: true;
    subscription: NotificationPushSubscriptionRecord;
  }
  | {
    ok: false;
    reason:
      | "notification_admin_user_unlinked"
      | "notification_admin_forbidden"
      | "notification_push_invalid_input"
      | "notification_push_unavailable";
  };

export type NotificationPushRevokeResult =
  | {
    ok: true;
    revoked: boolean;
  }
  | {
    ok: false;
    reason:
      | "notification_admin_user_unlinked"
      | "notification_admin_forbidden"
      | "notification_push_invalid_input";
  };

export type NotificationPushSendSummary = {
  attempted: number;
  sent: number;
  failed: number;
};

export interface NotificationAdminRepository {
  resolveActor(authUserId: string): Promise<NotificationAdminActor | null>;
  listNotifications(options: NotificationListOptions): Promise<readonly NotificationRecord[]>;
  countUnread(): Promise<{ unreadCount: number; criticalUnreadCount: number }>;
  createNotification(input: NotificationCreateRecordInput): Promise<NotificationRecord>;
  updateNotificationStatus(input: NotificationStatusUpdateInput): Promise<NotificationRecord | null>;
  upsertPushSubscription(input: NotificationPushSubscriptionInput & {
    userId: string;
    endpointHash: string;
  }): Promise<NotificationPushSubscriptionRecord>;
  revokePushSubscription(input: {
    userId: string;
    endpointHash: string;
  }): Promise<boolean>;
  listActivePushSubscriptions(): Promise<readonly NotificationPushSubscriptionRecord[]>;
  recordPushSuccess(input: { endpointHash: string }): Promise<void>;
  recordPushFailure(input: {
    endpointHash: string;
    error: string;
    revoke: boolean;
  }): Promise<void>;
}
