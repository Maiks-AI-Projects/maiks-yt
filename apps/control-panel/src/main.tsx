import { createNotificationScenario, createReplaySessionFromPreset, type EventStormPreset } from "@maiks-yt/testing";
import { validateUrlAccessGate } from "@maiks-yt/ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const scenario = createNotificationScenario();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const eventStormPresets: Array<{ key: EventStormPreset; label: string }> = [
  { key: "notification-burst", label: "Notification burst" },
  { key: "urgent-center-alert", label: "Urgent center alert" },
  { key: "project-focus-shift", label: "Project focus shift" }
];
const maxProbeMessages = 6;

type ControlPanelAuthState =
  | {
    status: "checking";
  }
  | {
    status: "allowed";
    displayName: string;
  }
  | {
    status: "blocked";
    message: string;
  };

type AccountSessionResponse = {
  user: {
    name?: string | null;
    email?: string | null;
  };
} | null;

type ProbeStatus = "idle" | "connecting" | "open" | "failed" | "closed";

type OverlayPresenceState =
  | {
    status: "checking";
  }
  | {
    status: "ready";
    activeOverlayConnections: number;
    checkedAt: string;
    topBarEnabled: boolean;
    centerEnabled: boolean;
    centerDefaultTiming: CenterNotificationTiming;
  }
  | {
    status: "error";
    message: string;
  };

type CenterNotificationTiming = {
  onscreenMs: number;
  fadeOutMs: number;
  restMs: number;
};

type OverlayStatusResponse = {
  ok: true;
  activeOverlayConnections: number;
  overlayActive: boolean;
  checkedAt: string;
  topBarEnabled: boolean;
  centerEnabled: boolean;
  centerDefaultTiming: CenterNotificationTiming;
} | {
  ok: false;
  reason: string;
};

const createWebSocketUrl = (baseUrl: string, path: string): string => {
  const url = new URL(path, baseUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
};

const appendProbeMessage = (messages: string[], message: string): string[] => [
  message,
  ...messages
].slice(0, maxProbeMessages);

const validateControlPanelAccess = async (): Promise<ControlPanelAuthState> => {
  const gateState = await validateUrlAccessGate({
    apiBaseUrl,
    surface: "control-panel",
    scope: "control:open",
    storageKey: "maiks.yt.control.accessToken"
  });

  if (gateState.status === "checking") {
    return {
      status: "checking"
    };
  }

  if (gateState.status !== "allowed") {
    return {
      status: "blocked",
      message: gateState.message
    };
  }

  if (!gateState.requiresLogin) {
    return {
      status: "allowed",
      displayName: "Token user"
    };
  }

  const sessionResponse = await fetch(`${apiBaseUrl}/account/session`, {
    credentials: "include"
  });

  if (!sessionResponse.ok) {
    return {
      status: "blocked",
      message: "Sign in on the main site before opening the control panel."
    };
  }

  const session = await sessionResponse.json() as AccountSessionResponse;

  if (!session) {
    return {
      status: "blocked",
      message: "Sign in on the main site before opening the control panel."
    };
  }

  return {
    status: "allowed",
    displayName: session.user.name ?? session.user.email ?? "Signed-in user"
  };
};

const SurfaceStatus = (): React.ReactNode => {
  const [overlayPresence, setOverlayPresence] = useState<OverlayPresenceState>({ status: "checking" });
  const [topBarActionStatus, setTopBarActionStatus] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const refreshPresence = async (): Promise<void> => {
      const token = window.localStorage.getItem("maiks.yt.control.accessToken");

      if (!token) {
        setOverlayPresence({
          status: "error",
          message: "Control token missing."
        });
        return;
      }

      try {
        const url = new URL("/overlay/status", apiBaseUrl);
        url.searchParams.set("accessToken", token);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Overlay status failed with ${response.status}`);
        }

        const result = await response.json() as OverlayStatusResponse;

        if (!result.ok) {
          throw new Error(result.reason);
        }

        if (!disposed) {
          setOverlayPresence({
            status: "ready",
            activeOverlayConnections: result.activeOverlayConnections,
            checkedAt: result.checkedAt,
            topBarEnabled: result.topBarEnabled,
            centerEnabled: result.centerEnabled,
            centerDefaultTiming: result.centerDefaultTiming
          });
        }
      } catch (error) {
        if (!disposed) {
          setOverlayPresence({
            status: "error",
            message: error instanceof Error ? error.message : "Overlay status unavailable."
          });
        }
      }
    };

    void refreshPresence();
    const interval = window.setInterval(refreshPresence, 5_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  const overlayActive = overlayPresence.status === "ready" && overlayPresence.activeOverlayConnections > 0;
  const topBarEnabled = overlayPresence.status === "ready" && overlayPresence.topBarEnabled;
  const centerEnabled = overlayPresence.status === "ready" && overlayPresence.centerEnabled;
  const centerTiming = overlayPresence.status === "ready"
    ? overlayPresence.centerDefaultTiming
    : {
      onscreenMs: 4_000,
      fadeOutMs: 700,
      restMs: 1_500
    };

  const updateTopBarEnabled = async (enabled: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/top-bar/enabled`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        enabled
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Top bar toggle failed with ${response.status}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        topBarEnabled: enabled
      }
      : currentState);
    setTopBarActionStatus(enabled ? "Top bar on." : "Top bar off.");
  };

  const sendTopBarTest = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/top-bar/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        count: 4
      })
    });

    setTopBarActionStatus(response.ok ? "Top bar burst sent." : `Top bar burst failed with ${response.status}.`);
  };

  const sendRoutedNotificationTest = async (route: "top" | "center"): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/notification/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        route,
        count: route === "center" ? 1 : 4
      })
    });

    setTopBarActionStatus(response.ok
      ? route === "center" ? "Center test queued." : "Routed top burst sent."
      : `Notification test failed with ${response.status}.`);
  };

  const updateCenterSettings = async (patch: Partial<CenterNotificationTiming> & { enabled?: boolean }): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const nextSettings = {
      enabled: patch.enabled ?? centerEnabled,
      onscreenMs: patch.onscreenMs ?? centerTiming.onscreenMs,
      fadeOutMs: patch.fadeOutMs ?? centerTiming.fadeOutMs,
      restMs: patch.restMs ?? centerTiming.restMs
    };
    const response = await fetch(`${apiBaseUrl}/overlay/center/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        ...nextSettings
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Center settings failed with ${response.status}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        centerEnabled: nextSettings.enabled,
        centerDefaultTiming: {
          onscreenMs: nextSettings.onscreenMs,
          fadeOutMs: nextSettings.fadeOutMs,
          restMs: nextSettings.restMs
        }
      }
      : currentState);
    setTopBarActionStatus("Center settings saved.");
  };

  return (
    <section className="surface-status" aria-label="Surface status">
      <div className="status-pill active">
        <span>Control panel</span>
        <strong>active</strong>
      </div>
      <div className={`status-pill ${overlayActive ? "active" : "idle"}`}>
        <span>Overlay</span>
        <strong>{overlayPresence.status === "checking" ? "checking" : overlayActive ? "active" : "idle"}</strong>
        {overlayPresence.status === "ready" ? <small>{overlayPresence.activeOverlayConnections} connected</small> : null}
        {overlayPresence.status === "error" ? <small>{overlayPresence.message}</small> : null}
      </div>
      <button type="button" className="status-action" onClick={() => void updateTopBarEnabled(!topBarEnabled)}>
        {topBarEnabled ? "Top bar on" : "Top bar off"}
      </button>
      <button type="button" className="status-action" onClick={() => void sendTopBarTest()}>
        Test top bar
      </button>
      <button type="button" className="status-action" onClick={() => void sendRoutedNotificationTest("center")}>
        Test center
      </button>
      {topBarActionStatus ? <span className="status-note">{topBarActionStatus}</span> : null}
      <details className="notification-settings">
        <summary>Notification settings</summary>
        <label>
          <span>Center enabled</span>
          <input
            checked={centerEnabled}
            type="checkbox"
            onChange={(event) => void updateCenterSettings({ enabled: event.currentTarget.checked })}
          />
        </label>
        <label>
          <span>On screen</span>
          <input
            min={1000}
            max={20000}
            step={250}
            type="number"
            value={centerTiming.onscreenMs}
            onChange={(event) => void updateCenterSettings({ onscreenMs: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>Fade out</span>
          <input
            min={100}
            max={5000}
            step={100}
            type="number"
            value={centerTiming.fadeOutMs}
            onChange={(event) => void updateCenterSettings({ fadeOutMs: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>Rest</span>
          <input
            min={0}
            max={10000}
            step={250}
            type="number"
            value={centerTiming.restMs}
            onChange={(event) => void updateCenterSettings({ restMs: Number(event.currentTarget.value) })}
          />
        </label>
      </details>
    </section>
  );
};

const RealtimeProbe = (): React.ReactNode => {
  const [webSocketStatus, setWebSocketStatus] = useState<ProbeStatus>("idle");
  const [sseStatus, setSseStatus] = useState<ProbeStatus>("idle");
  const [webSocketMessages, setWebSocketMessages] = useState<string[]>([]);
  const [sseMessages, setSseMessages] = useState<string[]>([]);

  const testWebSocket = (): void => {
    setWebSocketStatus("connecting");
    setWebSocketMessages([]);

    const webSocket = new WebSocket(createWebSocketUrl(apiBaseUrl, "/realtime/spike/ws"));
    const timeout = window.setTimeout(() => {
      setWebSocketStatus("failed");
      webSocket.close();
    }, 12_000);

    webSocket.addEventListener("open", () => {
      setWebSocketStatus("open");
      webSocket.send("control-panel-probe");
    });
    webSocket.addEventListener("message", (event) => {
      window.clearTimeout(timeout);
      setWebSocketMessages((messages) => appendProbeMessage(messages, String(event.data)));
      webSocket.close();
    });
    webSocket.addEventListener("close", () => {
      window.clearTimeout(timeout);
      setWebSocketStatus((status) => status === "failed" ? status : "closed");
    });
    webSocket.addEventListener("error", () => {
      window.clearTimeout(timeout);
      setWebSocketStatus("failed");
      webSocket.close();
    });
  };

  const testSse = (): void => {
    setSseStatus("connecting");
    setSseMessages([]);

    const eventSource = new EventSource(new URL("/realtime/spike/sse", apiBaseUrl));
    const timeout = window.setTimeout(() => {
      setSseStatus("failed");
      eventSource.close();
    }, 12_000);

    eventSource.addEventListener("open", () => {
      setSseStatus("open");
    });
    eventSource.addEventListener("heartbeat", (event) => {
      window.clearTimeout(timeout);
      setSseMessages((messages) => appendProbeMessage(messages, event.data));
      eventSource.close();
      setSseStatus("closed");
    });
    eventSource.addEventListener("error", () => {
      window.clearTimeout(timeout);
      setSseStatus("failed");
      eventSource.close();
    });
  };

  return (
    <section className="realtime-probe">
      <h2>Realtime Probe</h2>
      <p>Quick transport check for the Cloudflare tunnel path.</p>
      <div className="probe-actions">
        <button type="button" onClick={testWebSocket}>Test WebSocket</button>
        <button type="button" onClick={testSse}>Test SSE</button>
      </div>
      <div className="probe-grid">
        <article>
          <strong>WebSocket</strong>
          <span className={`probe-status ${webSocketStatus}`}>{webSocketStatus}</span>
          <ol>
            {webSocketMessages.map((message, index) => (
              <li key={`ws-${index}`}>{message}</li>
            ))}
          </ol>
        </article>
        <article>
          <strong>SSE</strong>
          <span className={`probe-status ${sseStatus}`}>{sseStatus}</span>
          <ol>
            {sseMessages.map((message, index) => (
              <li key={`sse-${index}`}>{message}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
};

const App = (): React.ReactNode => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [selectedPreset, setSelectedPreset] = useState<EventStormPreset>("notification-burst");
  const replaySession = createReplaySessionFromPreset(selectedPreset);

  useEffect(() => {
    void validateControlPanelAccess().then(setAuthState);
  }, []);

  if (authState.status !== "allowed") {
    return (
      <main className="surface">
        <h1>Access Required</h1>
        <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      </main>
    );
  }

  return (
    <main className="surface">
      <h1>Maiks.yt Control Panel</h1>
      <p>Low-distraction control surface scaffold for {authState.displayName}.</p>
      <SurfaceStatus />
      <button type="button">Emergency clean mode</button>
      <RealtimeProbe />
      <section>
        <h2>Simulator</h2>
        <p>
          {scenario.length} starter event ready. {replaySession.events.length} sanitized replay events loaded from the
          selected preset.
        </p>
        <div className="preset-actions" aria-label="Event storm presets">
          {eventStormPresets.map((preset) => (
            <button
              type="button"
              className={selectedPreset === preset.key ? "selected-action" : undefined}
              key={preset.key}
              onClick={() => setSelectedPreset(preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="replay-summary">
          <strong>{replaySession.title}</strong>
          <span>{replaySession.source}</span>
          <span>{replaySession.sanitized ? "Sanitized" : "Raw"}</span>
        </div>
        <ol className="event-preview-list">
          {replaySession.events.map((entry, index) => (
            <li key={`${entry.event.type}-${index}`}>
              <strong>{entry.offsetMs}ms - {entry.event.type}</strong>
              <span>{JSON.stringify(entry.event.payload)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
