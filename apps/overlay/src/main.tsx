import type {
  OverlayLayoutKey,
  OverlayLiveMessage,
  OverlaySceneKey,
  OverlayStateSnapshot,
  OverlayThemeKey
} from "@maiks-yt/events";
import { defaultTheme } from "@maiks-yt/themes";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { validateUrlAccessGate, type UrlAccessGateState } from "@maiks-yt/ui";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const overlayAccessStorageKey = "maiks.yt.overlay.accessToken";

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

const App = (): React.ReactNode => {
  const [gateState, setGateState] = useState<UrlAccessGateState>({ status: "checking" });
  const [runtimeState, setRuntimeState] = useState<OverlayRuntimeState>({ status: "loading" });
  const urlOptions = useMemo(parseUrlOptions, []);

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
      <div className={`connection-dot ${runtimeState.liveStatus}`} aria-label={runtimeState.liveStatus} />
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
      <div className="game-safe-area" />
      {snapshot.slots.camera.visible ? <div className="slot camera-slot">{snapshot.slots.camera.label}</div> : null}
      {snapshot.slots.chat.visible ? <div className="slot chat-slot">{snapshot.slots.chat.label}</div> : null}
      {snapshot.slots.sponsorPrimary.visible ? (
        <div className="slot sponsor-primary-slot">{snapshot.slots.sponsorPrimary.label}</div>
      ) : null}
      {snapshot.slots.streamGoal.visible ? <div className="slot stream-goal-slot">{snapshot.slots.streamGoal.label}</div> : null}
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
