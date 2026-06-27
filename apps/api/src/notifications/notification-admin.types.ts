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

export interface NotificationAdminRepository {
  resolveActor(authUserId: string): Promise<NotificationAdminActor | null>;
  listNotifications(options: NotificationListOptions): Promise<readonly NotificationRecord[]>;
  countUnread(): Promise<{ unreadCount: number; criticalUnreadCount: number }>;
  createNotification(input: NotificationCreateRecordInput): Promise<NotificationRecord>;
  updateNotificationStatus(input: NotificationStatusUpdateInput): Promise<NotificationRecord | null>;
}
