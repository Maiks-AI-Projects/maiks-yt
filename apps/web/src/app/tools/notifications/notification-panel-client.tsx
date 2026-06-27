"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  NotificationRecord,
  NotificationSeverity,
  NotificationSource,
  NotificationStatus
} from "@maiks-yt/domain/notifications";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type NotificationListSuccess = {
  ok: true;
  notifications: NotificationRecord[];
  unreadCount: number;
  criticalUnreadCount: number;
};

type NotificationFailureReason =
  | "not_authenticated"
  | "notification_admin_user_unlinked"
  | "notification_admin_forbidden"
  | "notification_not_found"
  | "notification_unavailable";

type NotificationFailure = {
  ok: false;
  reason: NotificationFailureReason;
};

type NotificationListResponse = NotificationListSuccess | NotificationFailure;
type NotificationMutationResponse = {
  ok: true;
  notification: NotificationRecord;
} | NotificationFailure;

type LoadState = "loading" | "ready" | "signed-out" | "unlinked" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";
const pollIntervalMs = 30000;

const severityLabels = {
  critical: "Critical",
  info: "Info",
  warning: "Warning"
} satisfies Record<NotificationSeverity, string>;

const sourceLabels = {
  dev_smoke: "Dev smoke",
  moderation: "Moderation",
  money: "Money",
  provider: "Provider",
  security: "Security",
  system: "System"
} satisfies Record<NotificationSource, string>;

const statusLabels = {
  archived: "Archived",
  read: "Read",
  unread: "Unread"
} satisfies Record<NotificationStatus, string>;

const getFailureMessage = (reason: NotificationFailureReason): string => {
  switch (reason) {
    case "not_authenticated":
      return "Sign in to view private notifications.";
    case "notification_admin_user_unlinked":
      return "Your signed-in account is not linked to a Maiks.yt domain user yet.";
    case "notification_admin_forbidden":
      return "Your account is linked, but it does not have permission to manage notifications.";
    case "notification_not_found":
      return "That notification no longer exists.";
    case "notification_unavailable":
      return "The notification API is temporarily unavailable.";
  }
};

const getLoadStateForFailure = (response: Response, reason?: NotificationFailureReason): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (reason === "notification_admin_user_unlinked") {
    return "unlinked";
  }

  if (response.status === 403 || reason === "notification_admin_forbidden") {
    return "forbidden";
  }

  return "failed";
};

const parseJsonResponse = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
};

const sortNotifications = (notifications: readonly NotificationRecord[]): NotificationRecord[] =>
  [...notifications].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

const NotificationPanelClient = (): React.ReactNode => {
  const [panel, setPanel] = useState<NotificationListSuccess | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading notifications...");
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const notifications = useMemo(
    () => sortNotifications(panel?.notifications ?? []),
    [panel]
  );

  const loadNotifications = useCallback(async (options: { keepPanel?: boolean } = {}): Promise<void> => {
    if (options.keepPanel) {
      setRefreshing(true);
    } else {
      setLoadState("loading");
      setMessage("Loading notifications...");
    }

    try {
      const query = new URLSearchParams({
        includeArchived: includeArchived ? "true" : "false",
        limit: "80"
      });
      const response = await fetch(`${apiBaseUrl}/admin/notifications?${query.toString()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const data = await parseJsonResponse<NotificationListResponse>(response);

      if (response.ok && data?.ok) {
        setPanel(data);
        setLoadState("ready");
        setMessage(data.notifications.length === 0 ? "No notifications in this view." : "Notifications loaded.");
        return;
      }

      const reason = data?.ok === false ? data.reason : undefined;
      setPanel(null);
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(reason ? getFailureMessage(reason) : `Notification request failed with ${response.status}.`);
    } catch (error) {
      setPanel(null);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Notification request failed.");
    } finally {
      setRefreshing(false);
    }
  }, [includeArchived]);

  const updateStatus = async (notification: NotificationRecord, action: "read" | "archive"): Promise<void> => {
    setBusyId(`${notification.id}:${action}`);
    setMessage(action === "read" ? "Marking notification read..." : "Archiving notification...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/notifications/${encodeURIComponent(notification.id)}/${action}`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include"
      });
      const data = await parseJsonResponse<NotificationMutationResponse>(response);

      if (response.ok && data?.ok) {
        await loadNotifications({ keepPanel: true });
        setMessage(action === "read" ? "Notification marked read." : "Notification archived.");
        return;
      }

      const reason = data?.ok === false ? data.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(reason ? getFailureMessage(reason) : `Notification update failed with ${response.status}.`);
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Notification update failed.");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNotifications({ keepPanel: true });
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  return (
    <section className="notification-panel" aria-live="polite">
      <header className="notification-panel-header">
        <div>
          <p className="notification-panel-kicker">Maiks.yt operations</p>
          <h1>Notifications</h1>
        </div>
        <button
          className="notification-icon-button"
          disabled={refreshing}
          onClick={() => void loadNotifications({ keepPanel: true })}
          title="Refresh notifications"
          type="button"
        >
          Refresh
        </button>
      </header>

      <div className="notification-summary" aria-label="Notification counts">
        <div>
          <span>{panel?.unreadCount ?? 0}</span>
          <small>Unread</small>
        </div>
        <div className={(panel?.criticalUnreadCount ?? 0) > 0 ? "critical" : ""}>
          <span>{panel?.criticalUnreadCount ?? 0}</span>
          <small>Critical</small>
        </div>
      </div>

      <div className="notification-toolbar">
        <p>{message}</p>
        <label>
          <input
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.currentTarget.checked)}
            type="checkbox"
          />
          Show archived
        </label>
      </div>

      {loadState !== "ready" && notifications.length === 0 ? (
        <div className={`notification-empty ${loadState}`}>
          <p>{message}</p>
        </div>
      ) : null}

      <div className="notification-list">
        {notifications.map((notification) => (
          <article
            className={`notification-card ${notification.severity} ${notification.status}`}
            key={notification.id}
          >
            <div className="notification-card-main">
              <div className="notification-card-meta">
                <span>{severityLabels[notification.severity]}</span>
                <span>{sourceLabels[notification.source]}</span>
                <span>{statusLabels[notification.status]}</span>
                <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
              </div>
              <h2>{notification.title}</h2>
              <p>{notification.body}</p>
              {notification.actionUrl ? (
                <a className="notification-action-link" href={notification.actionUrl}>
                  Open related page
                </a>
              ) : null}
            </div>
            <div className="notification-card-actions">
              {notification.status === "unread" ? (
                <button
                  disabled={busyId === `${notification.id}:read`}
                  onClick={() => void updateStatus(notification, "read")}
                  type="button"
                >
                  Mark read
                </button>
              ) : null}
              {notification.status !== "archived" ? (
                <button
                  disabled={busyId === `${notification.id}:archive`}
                  onClick={() => void updateStatus(notification, "archive")}
                  type="button"
                >
                  Archive
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default NotificationPanelClient;
