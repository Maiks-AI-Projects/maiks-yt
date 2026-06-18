import type {
  OverlayActiveGoalState,
  OverlayFakeChatMessageReceivedEvent,
  OverlayLayoutKey,
  OverlayLiveMessage,
  OverlaySceneKey,
  OverlayStateSnapshot,
  OverlayThemeKey,
  OverlayRoutedNotificationQueuedEvent,
  OverlaySceneSlotDefinition,
  OverlayTopBarNotificationQueuedEvent
} from "@maiks-yt/events";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { validateUrlAccessGate, type UrlAccessGateState } from "@maiks-yt/ui";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const overlayAccessStorageKey = "maiks.yt.overlay.accessToken";
const overlayCanvasWidth = 1920;
const overlayCanvasHeight = 1080;
const topBarIntakeDelayMs = 500;
const maxVisibleTopBarNotifications = 8;
const maxVisibleFakeChatMessages = 6;
const safeDefaultAvatarUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23161b22'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23f2c94c'/%3E%3Cpath d='M14 57c3-13 13-20 18-20s15 7 18 20' fill='%23d64545'/%3E%3C/svg%3E";

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

type CachedOverlaySnapshotRecord = {
  cachedAt: string;
  snapshot: OverlayStateSnapshot;
};

type TopBarNotification = OverlayTopBarNotificationQueuedEvent["payload"];
type RoutedNotification = OverlayRoutedNotificationQueuedEvent["payload"];
type FakeChatMessage = OverlayFakeChatMessageReceivedEvent["payload"];
type CenterNotificationRuntime = {
  notification: RoutedNotification;
  phase: "onscreen" | "fading";
};
type OverlayLiveStatus = "snapshot" | "live" | "reconnecting" | "offline";

const isMinimalFallbackLiveStatus = (liveStatus: OverlayLiveStatus): boolean =>
  liveStatus === "reconnecting" || liveStatus === "offline";

const canRenderFakeChat = (snapshot: OverlayStateSnapshot): boolean =>
  snapshot.slots.chat.visible && snapshot.sceneDefinition.slots.chat.visible;

const isRenderableFakeChatMessage = (message: FakeChatMessage): boolean =>
  message.source === "fake-local" && message.authorKind === "human";

const getOverlayCanvasScale = (): number => {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.min(
    window.innerWidth / overlayCanvasWidth,
    window.innerHeight / overlayCanvasHeight
  );
};

const parseUrlOptions = (): OverlayUrlOptions => {
  const params = new URL(window.location.href).searchParams;

  return {
    scene: parseSceneKey(params.get("scene")),
    layout: parseParam(params.get("layout"), ["standard", "camera-left", "camera-right", "clean"], "standard"),
    theme: parseParam(params.get("theme"), ["default", "satisfactory"], "default"),
    mode: parseParam(params.get("mode"), ["normal", "clean"], "normal")
  };
};

const parseSceneKey = (value: string | null): OverlaySceneKey => {
  return value && /^[a-z0-9][a-z0-9-]{0,47}$/.test(value) ? value : "default";
};

const parseParam = <TValue extends string>(
  value: string | null,
  allowedValues: readonly TValue[],
  fallback: TValue
): TValue => {
  return allowedValues.includes(value as TValue) ? value as TValue : fallback;
};

const getOverlaySnapshotStorageKey = (options: OverlayUrlOptions): string => {
  const params = new URLSearchParams({
    layout: options.layout,
    mode: options.mode,
    scene: options.scene,
    theme: options.theme
  });

  return `maiks.yt.overlay.last-known-good.v1:${params.toString()}`;
};

const readCachedSnapshot = (options: OverlayUrlOptions): OverlayStateSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getOverlaySnapshotStorageKey(options);

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<CachedOverlaySnapshotRecord>;

    return parsedValue.snapshot ?? null;
  } catch {
    return null;
  }
};

const writeCachedSnapshot = (snapshot: OverlayStateSnapshot, options: OverlayUrlOptions): void => {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getOverlaySnapshotStorageKey(options);
  const record: CachedOverlaySnapshotRecord = {
    cachedAt: new Date().toISOString(),
    snapshot
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // Ignore storage write failures so the overlay can continue rendering.
  }
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
    actionLabel: "Donated EUR 20",
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

const createSlotStyle = (slot: OverlaySceneSlotDefinition): CSSProperties => ({
  bottom: "auto",
  height: `${slot.height / 10.8}%`,
  left: `${slot.x / 19.2}%`,
  right: "auto",
  top: `${slot.y / 10.8}%`,
  transform: "none",
  width: `${slot.width / 19.2}%`
});

const clampGoalProgress = (goal: OverlayActiveGoalState): number => {
  if (goal.targetAmount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(goal.currentAmount / goal.targetAmount, 1));
};

const formatGoalAmount = (amount: number, currencyCode: string): string => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(amount);
};

const TopNotificationBar = ({
  notifications,
  slotStyle
}: {
  notifications: TopBarNotification[];
  slotStyle: CSSProperties;
}): React.ReactNode => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="top-bar-notifications" aria-live="polite" style={slotStyle}>
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
            <img
              alt=""
              className="top-bar-avatar"
              src={notification.avatarUrl || safeDefaultAvatarUrl}
              onError={(event) => {
                if (event.currentTarget.src !== safeDefaultAvatarUrl) {
                  event.currentTarget.src = safeDefaultAvatarUrl;
                }
              }}
            />
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

const CenterNotification = ({
  runtime,
  slotStyle
}: {
  runtime: CenterNotificationRuntime;
  slotStyle: CSSProperties;
}): React.ReactNode => {
  const { notification, phase } = runtime;
  const center = notification.center;

  if (!center) {
    return null;
  }

  return (
    <div className="center-notification-zone" style={slotStyle}>
      <article
        className={`center-notification-card ${notification.priority} ${phase}`}
        aria-live="assertive"
        style={{ "--center-fade-ms": `${center.timing.fadeOutMs}ms` } as CSSProperties}
      >
        {center.imageUrl ? <img alt="" className="center-notification-image" src={center.imageUrl} /> : null}
        <div className="center-notification-copy">
          <strong>{center.title}</strong>
          <span>{center.message}</span>
        </div>
      </article>
    </div>
  );
};

const StreamGoalWidget = ({
  goal,
  slotStyle
}: {
  goal: OverlayActiveGoalState;
  slotStyle: CSSProperties;
}): React.ReactNode => {
  const progress = clampGoalProgress(goal);
  const progressPercent = Math.round(progress * 100);

  return (
    <section className="stream-goal-widget" style={slotStyle} aria-label={goal.label}>
      <div className="stream-goal-copy">
        <strong>{goal.label}</strong>
        <span>{formatGoalAmount(goal.currentAmount, goal.currencyCode)} / {formatGoalAmount(goal.targetAmount, goal.currencyCode)}</span>
      </div>
      <div className="stream-goal-meter" aria-hidden="true">
        <div className="stream-goal-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <span className="stream-goal-percent">{progressPercent}%</span>
    </section>
  );
};

const FakeChatOverlay = ({
  messages,
  slotStyle
}: {
  messages: FakeChatMessage[];
  slotStyle: CSSProperties;
}): React.ReactNode => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <section className="fake-chat-overlay" style={slotStyle} aria-label="Fake chat messages" aria-live="polite">
      {messages.map((message) => (
        <article className="fake-chat-message" key={message.id}>
          <strong>{message.authorName}</strong>
          <span>{message.message}</span>
        </article>
      ))}
    </section>
  );
};

const App = (): React.ReactNode => {
  const [gateState, setGateState] = useState<UrlAccessGateState>({ status: "checking" });
  const [runtimeState, setRuntimeState] = useState<OverlayRuntimeState>({ status: "loading" });
  const [topBarNotifications, setTopBarNotifications] = useState<TopBarNotification[]>([]);
  const [fakeChatMessages, setFakeChatMessages] = useState<FakeChatMessage[]>([]);
  const [centerNotification, setCenterNotification] = useState<CenterNotificationRuntime | null>(null);
  const [canvasScale, setCanvasScale] = useState(getOverlayCanvasScale);
  const fallbackHighlightIndexRef = useRef(0);
  const pendingTopBarNotificationsRef = useRef<TopBarNotification[]>([]);
  const pendingCenterNotificationsRef = useRef<RoutedNotification[]>([]);
  const runtimeStateRef = useRef<OverlayRuntimeState>({ status: "loading" });
  const topBarProcessingRef = useRef(false);
  const centerProcessingRef = useRef(false);
  const urlOptions = useMemo(parseUrlOptions, []);

  useEffect(() => {
    runtimeStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    const handleResize = (): void => {
      setCanvasScale(getOverlayCanvasScale());
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const clearTransientNotifications = (): void => {
    pendingTopBarNotificationsRef.current = [];
    pendingCenterNotificationsRef.current = [];
    topBarProcessingRef.current = false;
    centerProcessingRef.current = false;
    setTopBarNotifications([]);
    setFakeChatMessages([]);
    setCenterNotification(null);
  };

  const isMinimalFallbackActive = (): boolean => {
    const currentState = runtimeStateRef.current;

    return currentState.status === "ready" && isMinimalFallbackLiveStatus(currentState.liveStatus);
  };

  const processTopBarQueue = (): void => {
    if (topBarProcessingRef.current || isMinimalFallbackActive()) {
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

  const enqueueTopBarNotification = (notification: TopBarNotification, options?: { front?: boolean }): void => {
    if (isMinimalFallbackActive()) {
      return;
    }

    if (options?.front) {
      pendingTopBarNotificationsRef.current.unshift(notification);
    } else {
      pendingTopBarNotificationsRef.current.push(notification);
    }
    processTopBarQueue();
  };

  const processCenterQueue = (): void => {
    if (centerProcessingRef.current || isMinimalFallbackActive()) {
      return;
    }

    const nextNotification = pendingCenterNotificationsRef.current.shift();

    if (!nextNotification?.center) {
      return;
    }

    centerProcessingRef.current = true;
    setCenterNotification({
      notification: nextNotification,
      phase: "onscreen"
    });

    if (nextNotification.center.audioUrl) {
      const audio = new Audio(nextNotification.center.audioUrl);
      void audio.play().catch(() => undefined);
    }

    window.setTimeout(() => {
      setCenterNotification({
        notification: nextNotification,
        phase: "fading"
      });

      window.setTimeout(() => {
        setCenterNotification(null);

        if (nextNotification.afterCenter === "top") {
          enqueueTopBarNotification(nextNotification, { front: true });
        }

        window.setTimeout(() => {
          centerProcessingRef.current = false;
          processCenterQueue();
        }, nextNotification.center?.timing.restMs ?? 0);
      }, nextNotification.center?.timing.fadeOutMs ?? 700);
    }, nextNotification.center.timing.onscreenMs);
  };

  const enqueueRoutedNotification = (notification: RoutedNotification): void => {
    if (isMinimalFallbackActive()) {
      return;
    }

    if (notification.route === "center" && notification.center) {
      pendingCenterNotificationsRef.current.push(notification);
      processCenterQueue();
      return;
    }

    enqueueTopBarNotification(notification);
  };

  const receiveFakeChatMessage = (message: FakeChatMessage): void => {
    const currentState = runtimeStateRef.current;

    if (
      currentState.status !== "ready"
      || isMinimalFallbackLiveStatus(currentState.liveStatus)
      || !canRenderFakeChat(currentState.snapshot)
      || !isRenderableFakeChatMessage(message)
    ) {
      return;
    }

    setFakeChatMessages((messages) => [
      ...messages,
      message
    ].slice(-maxVisibleFakeChatMessages));
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

        writeCachedSnapshot(snapshot, urlOptions);

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
            writeCachedSnapshot(message.payload, urlOptions);
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

          if (message.type === "overlay.routed-notification.queued") {
            enqueueRoutedNotification(message.payload);
            return;
          }

          if (message.type === "overlay.fake-chat.message.received") {
            receiveFakeChatMessage(message.payload);
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

        const currentRuntimeState = runtimeStateRef.current;
        const fallbackSnapshot = readCachedSnapshot(urlOptions)
          ?? (currentRuntimeState.status === "ready" ? currentRuntimeState.snapshot : null);

        if (fallbackSnapshot) {
          setRuntimeState({
            status: "ready",
            liveStatus: "reconnecting",
            snapshot: fallbackSnapshot,
            lastHeartbeatAt: currentRuntimeState.status === "ready" ? currentRuntimeState.lastHeartbeatAt : null
          });
        } else {
          setRuntimeState({
            status: "error",
            message: error instanceof Error ? error.message : "Overlay connection failed."
          });
        }
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

  useEffect(() => {
    if (runtimeState.status === "ready" && isMinimalFallbackLiveStatus(runtimeState.liveStatus)) {
      clearTransientNotifications();
    }
  }, [runtimeState]);

  useEffect(() => {
    if (runtimeState.status === "ready" && !canRenderFakeChat(runtimeState.snapshot)) {
      setFakeChatMessages([]);
    }
  }, [runtimeState]);

  const topBarEnabled = runtimeState.status === "ready" && runtimeState.snapshot.topBar.enabled;
  const isMinimalFallback = runtimeState.status === "ready" && isMinimalFallbackLiveStatus(runtimeState.liveStatus);
  const quietHighlightIntervalMs = runtimeState.status === "ready"
    ? runtimeState.snapshot.topBar.quietHighlightIntervalMs
    : 18_000;
  const overlayCanvasStyle = {
    "--overlay-canvas-scale": canvasScale
  } as CSSProperties;

  useEffect(() => {
    if (!topBarEnabled || isMinimalFallback) {
      return;
    }

    const interval = window.setInterval(() => {
      enqueueTopBarNotification(createFallbackTopBarHighlight(fallbackHighlightIndexRef.current));
      fallbackHighlightIndexRef.current += 1;
    }, quietHighlightIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [isMinimalFallback, quietHighlightIntervalMs, topBarEnabled]);

  if (gateState.status !== "allowed") {
    return (
      <main className="overlay access-gate" style={overlayCanvasStyle}>
        <div className="center-notification">
          {gateState.status === "checking" ? "Checking overlay access" : gateState.message}
        </div>
      </main>
    );
  }

  if (runtimeState.status !== "ready") {
    return (
      <main className="overlay access-gate" style={overlayCanvasStyle}>
        <div className="center-notification">
          {runtimeState.status === "loading" ? "Loading overlay" : runtimeState.message}
        </div>
      </main>
    );
  }

  const { snapshot } = runtimeState;
  const sceneDefinition = snapshot.sceneDefinition;
  const slots = sceneDefinition.slots;

  return (
    <main
      className="overlay"
      data-layout={snapshot.layout}
      data-live-status={runtimeState.liveStatus}
      data-scene={snapshot.scene}
      data-theme={snapshot.theme}
      style={overlayCanvasStyle}
    >
      {snapshot.topBar.enabled && slots.topNotifications.visible && !isMinimalFallback ? (
        <TopNotificationBar
          notifications={topBarNotifications}
          slotStyle={createSlotStyle(slots.topNotifications)}
        />
      ) : null}
      {snapshot.topNotification ? (
        <div className={`top-notification ${snapshot.topNotification.priority}`}>
          <strong>{snapshot.topNotification.title}</strong>
          <span>{snapshot.topNotification.message}</span>
        </div>
      ) : null}
      {centerNotification && slots.centerNotifications.visible && !isMinimalFallback ? (
        <CenterNotification
          runtime={centerNotification}
          slotStyle={createSlotStyle(slots.centerNotifications)}
        />
      ) : null}
      {slots.game.visible ? (
        <div className="reservation game-safe-area" style={createSlotStyle(slots.game)} aria-hidden="true" />
      ) : null}
      {snapshot.slots.camera.visible && slots.camera.visible ? (
        <div className="reservation slot camera-slot" style={createSlotStyle(slots.camera)} aria-hidden="true" />
      ) : null}
      {snapshot.slots.chat.visible && slots.chat.visible ? (
        <FakeChatOverlay
          messages={fakeChatMessages}
          slotStyle={createSlotStyle(slots.chat)}
        />
      ) : null}
      {snapshot.slots.sponsorPrimary.visible && slots.sponsorPrimary.visible ? (
        <div
          className="reservation slot sponsor-primary-slot"
          style={createSlotStyle(slots.sponsorPrimary)}
          aria-hidden="true"
        />
      ) : null}
      {snapshot.slots.streamGoal.visible && slots.streamGoal.visible ? (
        snapshot.activeGoal?.enabled ? (
          <StreamGoalWidget goal={snapshot.activeGoal} slotStyle={createSlotStyle(slots.streamGoal)} />
        ) : null
      ) : null}
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
