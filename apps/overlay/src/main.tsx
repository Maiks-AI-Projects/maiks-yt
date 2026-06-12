import type {
  OverlayLayoutKey,
  OverlayLiveMessage,
  OverlaySceneKey,
  OverlayStateSnapshot,
  OverlayThemeKey,
  OverlayTopBarNotificationQueuedEvent
} from "@maiks-yt/events";
import { defaultTheme } from "@maiks-yt/themes";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { validateUrlAccessGate, type UrlAccessGateState } from "@maiks-yt/ui";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const overlayAccessStorageKey = "maiks.yt.overlay.accessToken";
const topBarIntakeDelayMs = 500;
const maxVisibleTopBarNotifications = 8;

type OverlayRuntimeState =
  | {
    status: "loading";
  }
  | {
    status: "ready";
    liveStatus: "snapshot" | "live" | "reconnecting" | "offline";
    snapshot: OverlayStateSnapshot;
    lastHeartbeatAt: string | null;
  }
  | {
    status: "error";
    message: string;
  };

type OverlayUrlOptions = {
  scene: OverlaySceneKey;
  layout: OverlayLayoutKey;
  theme: OverlayThemeKey;
  mode: OverlayStateSnapshot["mode"];
};

type OverlayStateResponse = {
  ok: true;
  snapshot: OverlayStateSnapshot;
} | {
  ok: false;
  reason: string;
};

type TopBarNotification = OverlayTopBarNotificationQueuedEvent["payload"];

const parseUrlOptions = (): OverlayUrlOptions => {
  const params = new URL(window.location.href).searchParams;

  return {
    scene: parseParam(params.get("scene"), ["default", "gameplay", "chat-focus", "just-camera"], "default"),
    layout: parseParam(params.get("layout"), ["standard", "camera-left", "camera-right", "clean"], "standard"),
    theme: parseParam(params.get("theme"), ["default"], "default"),
    mode: parseParam(params.get("mode"), ["normal", "clean"], "normal")
  };
};

const parseParam = <TValue extends string>(
  value: string | null,
  allowedValues: readonly TValue[],
  fallback: TValue
): TValue => {
  return allowedValues.includes(value as TValue) ? value as TValue : fallback;
};

const createApiUrl = (path: string, token: string, options: OverlayUrlOptions): URL => {
  const url = new URL(path, apiBaseUrl);

  url.searchParams.set("accessToken", token);
  url.searchParams.set("scene", options.scene);
  url.searchParams.set("layout", options.layout);
  url.searchParams.set("theme", options.theme);
  url.searchParams.set("mode", options.mode);

  return url;
};

const createWebSocketUrl = (path: string, token: string, options: OverlayUrlOptions): string => {
  const url = createApiUrl(path, token, options);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
};

const loadSnapshot = async (token: string, options: OverlayUrlOptions): Promise<OverlayStateSnapshot> => {
  const response = await fetch(createApiUrl("/overlay/state", token, options));

  if (!response.ok) {
    throw new Error(`Snapshot failed with ${response.status}`);
  }

  const result = await response.json() as OverlayStateResponse;

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.snapshot;
};

const fallbackTopBarHighlights: Array<Omit<TopBarNotification, "createdAt" | "id">> = [
  {
    actorName: "#1 Donator",
    actionLabel: "Donated €20",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  },
  {
    actorName: "#1 Bits",
    actionLabel: "Cheered 500",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  },
  {
    actorName: "#1 Gifted Subs",
    actionLabel: "Gifted 5 subs",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  }
];

const createFallbackTopBarHighlight = (index: number): TopBarNotification => ({
  id: `fallback-${Date.now()}-${index}`,
  createdAt: new Date().toISOString(),
  ...fallbackTopBarHighlights[index % fallbackTopBarHighlights.length]!
});

const TopNotificationBar = ({ notifications }: { notifications: TopBarNotification[] }): React.ReactNode => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="top-bar-notifications" aria-live="polite">
      {notifications.map((notification, index) => (
        <article
          className={`top-bar-card ${notification.priority} ${notification.platform} ${notification.kind}`}
          key={notification.id}
          style={{ "--top-bar-index": index } as CSSProperties}
        >
          {notification.kind === "community-highlight" ? (
            <span className="top-bar-rank">{notification.actorName}</span>
          ) : null}
          <div className="top-bar-line">
            <img alt="" className="top-bar-avatar" src={notification.avatarUrl} />
            {notification.kind === "community-highlight" ? (
              <span className="top-bar-action">{notification.actionLabel}</span>
            ) : (
              <>
                <strong>{notification.actorName}</strong>
                <span className="top-bar-action">{notification.actionLabel}</span>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

const App = (): React.ReactNode => {
  const [gateState, setGateState] = useState<UrlAccessGateState>({ status: "checking" });
  const [runtimeState, setRuntimeState] = useState<OverlayRuntimeState>({ status: "loading" });
  const [topBarNotifications, setTopBarNotifications] = useState<TopBarNotification[]>([]);
  const fallbackHighlightIndexRef = useRef(0);
  const pendingTopBarNotificationsRef = useRef<TopBarNotification[]>([]);
  const topBarProcessingRef = useRef(false);
  const urlOptions = useMemo(parseUrlOptions, []);

  const processTopBarQueue = (): void => {
    if (topBarProcessingRef.current) {
      return;
    }

    const nextNotification = pendingTopBarNotificationsRef.current.shift();

    if (!nextNotification) {
      return;
    }

    topBarProcessingRef.current = true;
    setTopBarNotifications((notifications) => [
      nextNotification,
      ...notifications
    ].slice(0, maxVisibleTopBarNotifications));
    window.setTimeout(() => {
      topBarProcessingRef.current = false;
      processTopBarQueue();
    }, topBarIntakeDelayMs);
  };

  const enqueueTopBarNotification = (notification: TopBarNotification): void => {
    pendingTopBarNotificationsRef.current.push(notification);
    processTopBarQueue();
  };

  useEffect(() => {
    void validateUrlAccessGate({
      apiBaseUrl,
      surface: "overlay",
      scope: "overlay:connect",
      storageKey: overlayAccessStorageKey
    }).then(setGateState);
  }, []);

  useEffect(() => {
    if (gateState.status !== "allowed") {
      return;
    }

    const token = window.localStorage.getItem(overlayAccessStorageKey);

    if (!token) {
      setRuntimeState({
        status: "error",
        message: "Overlay token missing after validation."
      });
      return;
    }

    let reconnectTimer: number | null = null;
    let webSocket: WebSocket | null = null;
    let disposed = false;

    const connect = async (): Promise<void> => {
      try {
        const snapshot = await loadSnapshot(token, urlOptions);

        if (disposed) {
          return;
        }

        setRuntimeState({
          status: "ready",
          liveStatus: "snapshot",
          snapshot,
          lastHeartbeatAt: null
        });

        webSocket = new WebSocket(createWebSocketUrl("/overlay/live", token, urlOptions));
        webSocket.addEventListener("message", (event) => {
          const message = JSON.parse(String(event.data)) as OverlayLiveMessage;

          if (message.type === "overlay.state.snapshot") {
            setRuntimeState({
              status: "ready",
              liveStatus: "live",
              snapshot: message.payload,
              lastHeartbeatAt: null
            });
            return;
          }

          if (message.type === "overlay.top-bar-notification.queued") {
            enqueueTopBarNotification(message.payload);
            return;
          }

          if (message.type === "overlay.connection.heartbeat") {
            setRuntimeState((currentState) => currentState.status === "ready"
              ? {
                ...currentState,
                liveStatus: "live",
                lastHeartbeatAt: message.payload.sentAt
              }
              : currentState);
          }
        });
        webSocket.addEventListener("close", () => {
          if (disposed) {
            return;
          }

          setRuntimeState((currentState) => currentState.status === "ready"
            ? {
              ...currentState,
              liveStatus: "reconnecting"
            }
            : currentState);
          reconnectTimer = window.setTimeout(connect, 2_500);
        });
        webSocket.addEventListener("error", () => {
          webSocket?.close();
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        setRuntimeState({
          status: "error",
          message: error instanceof Error ? error.message : "Overlay connection failed."
        });
        reconnectTimer = window.setTimeout(connect, 5_000);
      }
    };

    void connect();

    return () => {
      disposed = true;
      webSocket?.close();

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [gateState.status, urlOptions]);

  const topBarEnabled = runtimeState.status === "ready" && runtimeState.snapshot.topBar.enabled;
  const quietHighlightIntervalMs = runtimeState.status === "ready"
    ? runtimeState.snapshot.topBar.quietHighlightIntervalMs
    : 18_000;

  useEffect(() => {
    if (!topBarEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      enqueueTopBarNotification(createFallbackTopBarHighlight(fallbackHighlightIndexRef.current));
      fallbackHighlightIndexRef.current += 1;
    }, quietHighlightIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [quietHighlightIntervalMs, topBarEnabled]);

  if (gateState.status !== "allowed") {
    return (
      <main className="overlay access-gate">
        <div className="center-notification">
          {gateState.status === "checking" ? "Checking overlay access" : gateState.message}
        </div>
      </main>
    );
  }

  if (runtimeState.status !== "ready") {
    return (
      <main className="overlay access-gate">
        <div className="center-notification">
          {runtimeState.status === "loading" ? "Loading overlay" : runtimeState.message}
        </div>
      </main>
    );
  }

  const { snapshot } = runtimeState;

  return (
    <main className="overlay" data-layout={snapshot.layout} data-scene={snapshot.scene} data-theme={defaultTheme.id}>
      {snapshot.topBar.enabled ? <TopNotificationBar notifications={topBarNotifications} /> : null}
      {snapshot.topNotification ? (
        <div className={`top-notification ${snapshot.topNotification.priority}`}>
          <strong>{snapshot.topNotification.title}</strong>
          <span>{snapshot.topNotification.message}</span>
        </div>
      ) : null}
      {snapshot.centerNotification ? (
        <div className={`center-notification ${snapshot.centerNotification.priority}`}>
          <strong>{snapshot.centerNotification.title}</strong>
          <span>{snapshot.centerNotification.message}</span>
        </div>
      ) : null}
      <div className="reservation game-safe-area" aria-hidden="true" />
      {snapshot.slots.camera.visible ? <div className="reservation slot camera-slot" aria-hidden="true" /> : null}
      {snapshot.slots.chat.visible ? <div className="reservation slot chat-slot" aria-hidden="true" /> : null}
      {snapshot.slots.sponsorPrimary.visible ? (
        <div className="reservation slot sponsor-primary-slot" aria-hidden="true" />
      ) : null}
      {snapshot.slots.streamGoal.visible ? (
        <div className="reservation slot stream-goal-slot" aria-hidden="true" />
      ) : null}
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
