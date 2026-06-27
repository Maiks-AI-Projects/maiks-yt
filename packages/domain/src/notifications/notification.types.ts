export const notificationSeverities = ["info", "warning", "critical"] as const;
export type NotificationSeverity = typeof notificationSeverities[number];

export const notificationSources = ["dev_smoke", "system", "security", "provider", "moderation", "money"] as const;
export type NotificationSource = typeof notificationSources[number];

export const notificationStatuses = ["unread", "read", "archived"] as const;
export type NotificationStatus = typeof notificationStatuses[number];

export type NotificationCreateInput = {
  title: string;
  body: string;
  severity: NotificationSeverity;
  source: NotificationSource;
  actionUrl: string | null;
};

export type NotificationRecord = NotificationCreateInput & {
  id: string;
  status: NotificationStatus;
  createdByUserId: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationValidationIssue =
  | "notification_title_required"
  | "notification_title_too_long"
  | "notification_body_required"
  | "notification_body_too_long"
  | "notification_action_url_invalid"
  | "notification_action_url_too_long";

export type NotificationValidationResult =
  | {
    ok: true;
    value: NotificationCreateInput;
  }
  | {
    ok: false;
    issues: readonly NotificationValidationIssue[];
  };
