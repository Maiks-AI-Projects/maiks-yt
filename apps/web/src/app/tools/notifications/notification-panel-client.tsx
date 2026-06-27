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
  | "notification_push_invalid_input"
  | "notification_push_unavailable"
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
type PushConfigSuccess = {
  ok: true;
  publicKey: string | null;
  enabled: boolean;
};
type PushConfigResponse = PushConfigSuccess | NotificationFailure;
type PushSubscriptionSuccess = {
  ok: true;
};
type PushSubscriptionResponse = PushSubscriptionSuccess | NotificationFailure;

type LoadState = "loading" | "ready" | "signed-out" | "unlinked" | "forbidden" | "failed";
type PushState =
  | "checking"
  | "unsupported"
  | "disabled"
  | "missing-key"
  | "permission-needed"
  | "permission-denied"
  | "subscribed"
  | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";
const pollIntervalMs = 30000;
const notificationServiceWorkerPath = "/notification-service-worker.js";

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
    case "notification_push_invalid_input":
      return "The browser push subscription could not be saved.";
    case "notification_push_unavailable":
      return "Push delivery is not configured on the API.";
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

const hasPushSupport = (): boolean =>
  "Notification" in window &&
  "PushManager" in window &&
  "serviceWorker" in navigator;

const convertBase64UrlToArrayBuffer = (value: string): ArrayBuffer => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const output = new Uint8Array(buffer);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return buffer;
};

const getPushStateLabel = (pushState: PushState): string => {
  switch (pushState) {
    case "checking":
      return "Checking browser push support...";
    case "unsupported":
      return "This browser or context does not support Web Push.";
    case "disabled":
      return "Push delivery is disabled on the API.";
    case "missing-key":
      return "Push delivery is missing its public browser key.";
    case "permission-needed":
      return "Push notifications are available. Browser permission is needed.";
    case "permission-denied":
      return "Browser notification permission is denied.";
    case "subscribed":
      return "This browser is subscribed for push notifications.";
    case "failed":
      return "Push notification setup failed.";
  }
};

const NotificationPanelClient = (): React.ReactNode => {
  const [panel, setPanel] = useState<NotificationListSuccess | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading notifications...");
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [pushMessage, setPushMessage] = useState<string>("Checking browser push support...");
  const [pushConfig, setPushConfig] = useState<PushConfigSuccess | null>(null);
  const [pushBusy, setPushBusy] = useState<boolean>(false);

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

  const getNotificationRegistration = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!hasPushSupport()) {
      setPushState("unsupported");
      setPushMessage(getPushStateLabel("unsupported"));
      return null;
    }

    return await navigator.serviceWorker.register(notificationServiceWorkerPath);
  }, []);

  const loadPushStatus = useCallback(async (): Promise<void> => {
    if (!hasPushSupport()) {
      setPushState("unsupported");
      setPushMessage(getPushStateLabel("unsupported"));
      return;
    }

    setPushState("checking");
    setPushMessage(getPushStateLabel("checking"));

    try {
      const response = await fetch(`${apiBaseUrl}/admin/notifications/push-config`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const data = await parseJsonResponse<PushConfigResponse>(response);

      if (!response.ok || !data?.ok) {
        const reason = data?.ok === false ? data.reason : undefined;
        setPushState("failed");
        setPushMessage(reason ? getFailureMessage(reason) : `Push config request failed with ${response.status}.`);
        return;
      }

      setPushConfig(data);

      if (!data.enabled) {
        setPushState("disabled");
        setPushMessage(getPushStateLabel("disabled"));
        return;
      }

      if (!data.publicKey) {
        setPushState("missing-key");
        setPushMessage(getPushStateLabel("missing-key"));
        return;
      }

      if (Notification.permission === "denied") {
        setPushState("permission-denied");
        setPushMessage(getPushStateLabel("permission-denied"));
        return;
      }

      const registration = await getNotificationRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const nextState: PushState = subscription ? "subscribed" : "permission-needed";
      setPushState(nextState);
      setPushMessage(getPushStateLabel(nextState));
    } catch (error) {
      setPushState("failed");
      setPushMessage(error instanceof Error ? error.message : getPushStateLabel("failed"));
    }
  }, [getNotificationRegistration]);

  const subscribeToPush = async (): Promise<void> => {
    setPushBusy(true);
    setPushMessage("Subscribing this browser...");

    try {
      if (!pushConfig?.enabled || !pushConfig.publicKey) {
        await loadPushStatus();
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setPushState("permission-denied");
        setPushMessage(getPushStateLabel("permission-denied"));
        return;
      }

      if (permission !== "granted") {
        setPushState("permission-needed");
        setPushMessage("Browser notification permission was not granted.");
        return;
      }

      const registration = await getNotificationRegistration();
      if (!registration) {
        return;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        applicationServerKey: convertBase64UrlToArrayBuffer(pushConfig.publicKey),
        userVisibleOnly: true
      });
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error("Browser did not provide push subscription keys.");
      }

      const response = await fetch(`${apiBaseUrl}/admin/notifications/push-subscriptions`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          endpoint,
          keys: {
            p256dh,
            auth
          }
        })
      });
      const data = await parseJsonResponse<PushSubscriptionResponse>(response);

      if (response.ok && data?.ok) {
        setPushState("subscribed");
        setPushMessage("This browser is subscribed for push notifications.");
        return;
      }

      const reason = data?.ok === false ? data.reason : undefined;
      setPushState("failed");
      setPushMessage(reason ? getFailureMessage(reason) : `Push subscribe failed with ${response.status}.`);
    } catch (error) {
      setPushState("failed");
      setPushMessage(error instanceof Error ? error.message : "Push subscribe failed.");
    } finally {
      setPushBusy(false);
    }
  };

  const unsubscribeFromPush = async (): Promise<void> => {
    setPushBusy(true);
    setPushMessage("Unsubscribing this browser...");

    try {
      const registration = await getNotificationRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        setPushState(Notification.permission === "denied" ? "permission-denied" : "permission-needed");
        setPushMessage("This browser does not have an active push subscription.");
        return;
      }

      const response = await fetch(`${apiBaseUrl}/admin/notifications/push-subscriptions/revoke`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });
      const data = await parseJsonResponse<PushSubscriptionResponse>(response);

      if (!response.ok || !data?.ok) {
        const reason = data?.ok === false ? data.reason : undefined;
        setPushState("failed");
        setPushMessage(reason ? getFailureMessage(reason) : `Push unsubscribe failed with ${response.status}.`);
        return;
      }

      await subscription.unsubscribe();
      setPushState("permission-needed");
      setPushMessage("This browser was unsubscribed from push notifications.");
    } catch (error) {
      setPushState("failed");
      setPushMessage(error instanceof Error ? error.message : "Push unsubscribe failed.");
    } finally {
      setPushBusy(false);
    }
  };

  const showTestNotification = async (): Promise<void> => {
    setPushBusy(true);
    setPushMessage("Showing a local test notification...");

    try {
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          setPushState(permission === "denied" ? "permission-denied" : "permission-needed");
          setPushMessage("Browser notification permission was not granted.");
          return;
        }
      }

      const registration = await getNotificationRegistration();
      await registration?.showNotification("Maiks.yt notification test", {
        body: "Local browser notification delivery is working.",
        icon: "/icons/maiks-tools-icon.svg",
        badge: "/icons/maiks-tools-maskable.svg",
        data: {
          url: "/tools/notifications"
        },
        tag: "maiks-yt-notification-test"
      });
      setPushMessage("Local test notification sent.");
      await loadPushStatus();
    } catch (error) {
      setPushState("failed");
      setPushMessage(error instanceof Error ? error.message : "Test notification failed.");
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadNotifications();
    void loadPushStatus();
  }, [loadNotifications, loadPushStatus]);

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

      <section className={`notification-push-panel ${pushState}`}>
        <div>
          <h2>Push delivery</h2>
          <p>{pushMessage}</p>
        </div>
        <div className="notification-push-actions">
          <button
            disabled={
              pushBusy ||
              pushState === "unsupported" ||
              pushState === "disabled" ||
              pushState === "missing-key" ||
              pushState === "permission-denied" ||
              pushState === "subscribed"
            }
            onClick={() => void subscribeToPush()}
            type="button"
          >
            Subscribe
          </button>
          <button
            disabled={pushBusy || pushState !== "subscribed"}
            onClick={() => void unsubscribeFromPush()}
            type="button"
          >
            Unsubscribe
          </button>
          <button
            disabled={pushBusy || pushState === "unsupported" || pushState === "permission-denied"}
            onClick={() => void showTestNotification()}
            type="button"
          >
            Test
          </button>
          <button
            disabled={pushBusy}
            onClick={() => void loadPushStatus()}
            type="button"
          >
            Status
          </button>
        </div>
      </section>

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
