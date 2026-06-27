import type {
  NotificationCreateInput,
  NotificationValidationIssue,
  NotificationValidationResult
} from "./notification.types.js";

const maxTitleLength = 191;
const maxBodyLength = 2000;
const maxActionUrlLength = 1024;

const normalizeNullableText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

const isAllowedActionUrl = (value: string): boolean => {
  if (value.startsWith("/")) {
    return !value.startsWith("//");
  }

  try {
    const parsedUrl = new URL(value);

    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
};

export const canManageNotifications = (permissions: readonly string[]): boolean =>
  permissions.includes("*") || permissions.includes("notifications:manage");

export const validateNotificationCreateInput = (
  input: NotificationCreateInput
): NotificationValidationResult => {
  const issues: NotificationValidationIssue[] = [];
  const title = input.title.trim();
  const body = input.body.trim();
  const actionUrl = normalizeNullableText(input.actionUrl);

  if (title.length === 0) {
    issues.push("notification_title_required");
  } else if (title.length > maxTitleLength) {
    issues.push("notification_title_too_long");
  }

  if (body.length === 0) {
    issues.push("notification_body_required");
  } else if (body.length > maxBodyLength) {
    issues.push("notification_body_too_long");
  }

  if (actionUrl && actionUrl.length > maxActionUrlLength) {
    issues.push("notification_action_url_too_long");
  } else if (actionUrl && !isAllowedActionUrl(actionUrl)) {
    issues.push("notification_action_url_invalid");
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues
    };
  }

  return {
    ok: true,
    value: {
      title,
      body,
      severity: input.severity,
      source: input.source,
      actionUrl
    }
  };
};
