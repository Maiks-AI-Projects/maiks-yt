import { useEffect, useState } from "react";
import { AiControlsWindow } from "./ai/AiControlsWindow.js";
import { ChatServiceStatusStrip } from "./chat/ChatServiceStatusStrip.js";
import { ChatWindowHeader } from "./chat/ChatWindowHeader.js";
import { StreamerChatViewer } from "./chat/StreamerChatViewer.js";
import { validateControlPanelAccess, type ControlPanelAuthState } from "./control-access.service.js";
import { getControlShellDataAttributes } from "./control-shell-surface.service.js";
import { captureDevAuthTokenFromUrl, createApiHeaders, withDevAuthToken } from "./dev-auth-token.js";
import { ModerationControlWindow } from "./moderation/ModerationControlWindow.js";
import { OperationsPanel } from "./operations/OperationsPanel.js";
import { SurfaceStatus } from "./overlay/SurfaceStatus.js";
import { RealtimeProbe } from "./realtime/RealtimeProbe.js";
import { SimulatorPanel } from "./simulator/SimulatorPanel.js";
import { SceneDesigner } from "./scene-designer/SceneDesigner.js";
import { StreamWindowChrome } from "./window/StreamWindowChrome.js";
import { getStreamWindowLabel, type StreamWindowAccessState } from "./window/stream-window-registry.service.js";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./visual-system.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const panelModeStorageKey = "maiks.yt.control.panelMode";
const currentRoutePath = window.location.pathname.replace(/\/+$/, "") || "/";
const isStandaloneChatRoute = currentRoutePath === "/chat";
const isModerationRulesRoute = currentRoutePath === "/moderation";
const isAiControlsRoute = currentRoutePath === "/ai";
const controlShellDataAttributes = getControlShellDataAttributes(currentRoutePath);
const defaultPanelMode = "creator";
type PanelMode = "creator" | "advanced";

type ModerationAccessProbeResponse = {
  ok: true;
  actions: Record<string, boolean>;
  panels: Record<string, boolean>;
} | {
  ok: false;
  reason: string;
};

const readStoredPanelMode = (): PanelMode => {
  const storedValue = window.localStorage.getItem(panelModeStorageKey);

  return storedValue === "advanced" ? "advanced" : defaultPanelMode;
};

const updateManifestForRoute = (): void => {
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');

  if (manifestLink) {
    manifestLink.href = isStandaloneChatRoute
      ? "/chat-manifest.webmanifest"
      : isModerationRulesRoute
        ? "/moderation-manifest.webmanifest"
        : "/manifest.webmanifest";
  }
};

type ControlPanelBlockedState = Extract<ControlPanelAuthState, { status: "blocked" }>;

const AccessReconnecting = ({ authState }: { authState: Extract<ControlPanelAuthState, { status: "checking" | "reconnecting" }> }): React.ReactNode => (
  <main
    {...controlShellDataAttributes}
    className={`surface access-required-surface ${isStandaloneChatRoute || isModerationRulesRoute || isAiControlsRoute ? "chat-surface" : ""}`}
  >
    <section className="access-required-panel">
      <p className="access-required-eyebrow">{getStreamWindowLabel(currentRoutePath)}</p>
      <h1>Reconnecting</h1>
      <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      <p className="access-required-help">
        Keeping private controls hidden while the session check retries.
      </p>
    </section>
  </main>
);

const AccessRequired = ({ authState }: { authState: ControlPanelBlockedState }): React.ReactNode => (
  <main
    {...controlShellDataAttributes}
    className={`surface access-required-surface ${isStandaloneChatRoute || isModerationRulesRoute || isAiControlsRoute ? "chat-surface" : ""}`}
  >
    <section className="access-required-panel">
      <p className="access-required-eyebrow">{getStreamWindowLabel(currentRoutePath)}</p>
      <h1>Access Required</h1>
      <p>{authState.message}</p>
      <p className="access-required-help">
        Use the current generated Control Panel access URL from Access Tokens. Opening the bare route is expected to stop here.
      </p>
      <div className="access-required-actions">
        <a className="secondary-window-link" href={withDevAuthToken("https://web-dev.maiks.yt/admin/tokens")}>
          Access Tokens
        </a>
        <a className="secondary-window-link" href={withDevAuthToken("https://web-dev.maiks.yt/admin/testing")}>
          Testing Guide
        </a>
      </div>
    </section>
  </main>
);

const App = (): React.ReactNode => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [panelMode, setPanelMode] = useState<PanelMode>(defaultPanelMode);
  const [moderationAccess, setModerationAccess] = useState<StreamWindowAccessState["moderation"]>("unknown");

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | null = null;

    const checkAccess = async (): Promise<void> => {
      const nextAuthState = await validateControlPanelAccess({ apiBaseUrl });

      if (disposed) {
        return;
      }

      setAuthState(nextAuthState);

      if (nextAuthState.status === "reconnecting") {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          void checkAccess();
        }, nextAuthState.retryAfterMs);
      }
    };

    captureDevAuthTokenFromUrl();
    updateManifestForRoute();
    document.title = isStandaloneChatRoute
      ? "Maiks.yt Streamer Chat"
      : isAiControlsRoute
        ? "Maiks.yt AI Controls"
      : isModerationRulesRoute
        ? "Maiks.yt Moderation"
        : "Maiks.yt Control Panel";
    void checkAccess();

    return () => {
      disposed = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, []);

  useEffect(() => {
    setPanelMode(readStoredPanelMode());
  }, []);

  useEffect(() => {
    if (authState.status !== "allowed") {
      setModerationAccess("unknown");
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setModerationAccess("blocked");
      return;
    }

    const loadModerationAccess = async (): Promise<void> => {
      try {
        const url = new URL("/streamer-chat/moderation/access", apiBaseUrl);
        url.searchParams.set("accessToken", token);
        const response = await fetch(url, {
          credentials: "include",
          headers: createApiHeaders()
        });
        const result = await response.json() as ModerationAccessProbeResponse;

        if (!response.ok || !result.ok) {
          setModerationAccess("blocked");
          return;
        }

        setModerationAccess(
          Object.values(result.panels).some(Boolean) || Object.values(result.actions).some(Boolean)
            ? "allowed"
            : "blocked"
        );
      } catch {
        setModerationAccess("unknown");
      }
    };

    void loadModerationAccess();
  }, [authState]);

  const advancedModeEnabled = panelMode === "advanced";
  const togglePanelMode = (): void => {
    const nextMode: PanelMode = advancedModeEnabled ? "creator" : "advanced";

    setPanelMode(nextMode);
    window.localStorage.setItem(panelModeStorageKey, nextMode);
  };

  if (authState.status === "checking" || authState.status === "reconnecting") {
    return <AccessReconnecting authState={authState} />;
  }

  if (authState.status !== "allowed") {
    return <AccessRequired authState={authState} />;
  }

  const navigationAccess: StreamWindowAccessState = {
    ai: isAiControlsRoute ? "allowed" : "unknown",
    control: "allowed",
    moderation: moderationAccess
  };

  if (isStandaloneChatRoute) {
    return (
      <main {...controlShellDataAttributes} className="surface chat-surface chat-window-surface standalone-chat-surface">
        <StreamWindowChrome
          access={navigationAccess}
          currentPath={currentRoutePath}
          displayName={authState.displayName}
          leftAction={<ChatWindowHeader apiBaseUrl={apiBaseUrl} />}
          status={<ChatServiceStatusStrip apiBaseUrl={apiBaseUrl} />}
        >
          <StreamerChatViewer apiBaseUrl={apiBaseUrl} newestOnTop maxMessages={60} variant="standalone" />
        </StreamWindowChrome>
      </main>
    );
  }

  if (isModerationRulesRoute) {
    return (
      <main {...controlShellDataAttributes} className="surface chat-surface chat-window-surface moderation-surface">
        <ModerationControlWindow
          apiBaseUrl={apiBaseUrl}
          currentPath={currentRoutePath}
          displayName={authState.displayName}
          navigationAccess={navigationAccess}
          onAccessChange={(allowed) => setModerationAccess(allowed ? "allowed" : "blocked")}
        />
      </main>
    );
  }

  if (isAiControlsRoute) {
    return (
      <main {...controlShellDataAttributes} className="surface chat-surface chat-window-surface ai-surface">
        <StreamWindowChrome
          access={navigationAccess}
          currentPath={currentRoutePath}
          displayName={authState.displayName}
        >
          <AiControlsWindow />
        </StreamWindowChrome>
      </main>
    );
  }

  return (
    <main {...controlShellDataAttributes} className="surface">
      <StreamWindowChrome
        access={navigationAccess}
        currentPath={currentRoutePath}
        displayName={authState.displayName}
        panelSelector={(
          <div className="control-mode-bar" aria-label="Control panel view mode">
            <span>Workspace</span>
            <button
              type="button"
              className={`panel-mode-toggle ${advancedModeEnabled ? "advanced" : ""}`}
              aria-pressed={advancedModeEnabled}
              onClick={togglePanelMode}
            >
              {advancedModeEnabled ? "Advanced" : "Creator"}
            </button>
          </div>
        )}
      >
        <SurfaceStatus apiBaseUrl={apiBaseUrl} panelMode={panelMode} />
        <SceneDesigner apiBaseUrl={apiBaseUrl} />
        {advancedModeEnabled ? (
          <OperationsPanel apiBaseUrl={apiBaseUrl} displayName={authState.displayName} panelMode={panelMode} />
        ) : null}
        <details className="quiet-section">
          <summary>
            <span>Realtime Probe</span>
            {advancedModeEnabled ? <small>Transport</small> : null}
          </summary>
          <div className="quiet-section-body">
            <RealtimeProbe apiBaseUrl={apiBaseUrl} />
          </div>
        </details>
        <details className="quiet-section">
          <summary>
            <span>Simulator</span>
            {advancedModeEnabled ? <small>Local replay</small> : null}
          </summary>
          <div className="quiet-section-body">
            <SimulatorPanel apiBaseUrl={apiBaseUrl} />
          </div>
        </details>
      </StreamWindowChrome>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
