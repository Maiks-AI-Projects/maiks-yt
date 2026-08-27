import type {
  OverlayLiveMessage,
} from "@maiks-yt/events";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { validateUrlAccessGate, type UrlAccessGateState } from "@maiks-yt/ui";
import { CenterNotification, FakeChatOverlay, StreamGoalWidget, TopNotificationBar } from "./overlay-components.js";
import {
  apiBaseUrl,
  canRenderFakeChat,
  createFallbackTopBarHighlight,
  createSlotStyle,
  createWebSocketUrl,
  getOverlayCanvasScale,
  isMinimalFallbackLiveStatus,
  isRenderableFakeChatMessage,
  loadSnapshot,
  maxVisibleFakeChatMessages,
  maxVisibleTopBarNotifications,
  overlayAccessStorageKey,
  parseUrlOptions,
  playNotificationSoundOnce,
  readCachedSnapshot,
  topBarIntakeDelayMs,
  writeCachedSnapshot,
  type CenterNotificationRuntime,
  type FakeChatMessage,
  type OverlayRuntimeState,
  type RoutedNotification,
  type TopBarNotification
} from "./overlay-client.service.js";
import "./styles.css";

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
  const playedNotificationSoundIdsRef = useRef<Set<string>>(new Set());
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
    playNotificationSoundOnce(nextNotification, playedNotificationSoundIdsRef.current);
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
    playNotificationSoundOnce(nextNotification, playedNotificationSoundIdsRef.current);

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

          if (message.type === "overlay.fake-chat.message.hidden") {
            setFakeChatMessages((messages) => messages.filter((chatMessage) => chatMessage.id !== message.payload.id));
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
  const fakeChatMessagesForDisplay = runtimeState.status === "ready" && runtimeState.snapshot.chat.newestOnTop
    ? [...fakeChatMessages].reverse()
    : fakeChatMessages;
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
          newestOnTop={snapshot.chat.newestOnTop}
          messages={fakeChatMessagesForDisplay}
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
