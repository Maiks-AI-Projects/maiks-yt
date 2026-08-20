import { validateUrlAccessGate } from "@maiks-yt/ui";
import { useEffect, useState } from "react";
import { AiControlsWindow } from "./ai/AiControlsWindow.js";
import { ChatServiceStatusStrip } from "./chat/ChatServiceStatusStrip.js";
import { ChatWindowHeader } from "./chat/ChatWindowHeader.js";
import { StreamerChatViewer } from "./chat/StreamerChatViewer.js";
import { captureDevAuthTokenFromUrl, createApiHeaders, withDevAuthToken } from "./dev-auth-token.js";
import { ModerationControlWindow } from "./moderation/ModerationControlWindow.js";
import { MusicControlPanel } from "./music/MusicControlPanel.js";
import { OperationsPanel } from "./operations/OperationsPanel.js";
import { SurfaceStatus } from "./overlay/SurfaceStatus.js";
import { RealtimeProbe } from "./realtime/RealtimeProbe.js";
import { apiBaseUrl, createWebUrl } from "./runtime-config.service.js";
import { SimulatorPanel } from "./simulator/SimulatorPanel.js";
import { SceneDesigner } from "./scene-designer/SceneDesigner.js";
import { createRoot } from "react-dom/client";
import "./styles.css";

const panelModeStorageKey = "maiks.yt.control.panelMode";
const currentRoutePath = window.location.pathname.replace(/\/+$/, "") || "/";
const isStandaloneChatRoute = currentRoutePath === "/chat";
const isModerationRulesRoute = currentRoutePath === "/moderation";
const isAiControlsRoute = currentRoutePath === "/ai";
const defaultPanelMode = "creator";
type PanelMode = "creator" | "advanced";
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

const controlRouteLabels: Record<string, string> = {
  "/chat": "Streamer Chat",
  "/control": "Control Panel",
  "/ai": "AI Controls",
  "/moderation": "Moderation"
};

const readStoredPanelMode = (): PanelMode => {
  const storedValue = window.localStorage.getItem(panelModeStorageKey);

  return storedValue === "advanced" ? "advanced" : defaultPanelMode;
};

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
    credentials: "include",
    headers: createApiHeaders()
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

const getCurrentSurfaceLabel = (): string =>
  controlRouteLabels[currentRoutePath] ?? "Control Panel";

type ControlPanelBlockedState = Exclude<ControlPanelAuthState, { status: "allowed" }>;

const AccessRequired = ({ authState }: { authState: ControlPanelBlockedState }): React.ReactNode => (
  <main className={`surface access-required-surface ${isStandaloneChatRoute || isModerationRulesRoute || isAiControlsRoute ? "chat-surface" : ""}`}>
    <section className="access-required-panel">
      <p className="access-required-eyebrow">{getCurrentSurfaceLabel()}</p>
      <h1>Access Required</h1>
      <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      {authState.status === "blocked" ? (
        <>
          <p className="access-required-help">
            Use the current generated Control Panel access URL from Access Tokens. Opening the bare route is expected to stop here.
          </p>
          <div className="access-required-actions">
            <a className="secondary-window-link" href={withDevAuthToken(createWebUrl("/admin/tokens"))}>
              Access Tokens
            </a>
            <a className="secondary-window-link" href={withDevAuthToken(createWebUrl("/admin"))}>
              Admin Overview
            </a>
          </div>
        </>
      ) : null}
    </section>
  </main>
);

const App = (): React.ReactNode => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [panelMode, setPanelMode] = useState<PanelMode>(defaultPanelMode);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    updateManifestForRoute();
    document.title = isStandaloneChatRoute
      ? "Maiks.yt Streamer Chat"
      : isAiControlsRoute
        ? "Maiks.yt AI Controls"
      : isModerationRulesRoute
        ? "Maiks.yt Moderation"
        : "Maiks.yt Control Panel";
    void validateControlPanelAccess().then(setAuthState);
  }, []);

  useEffect(() => {
    setPanelMode(readStoredPanelMode());
  }, []);

  const advancedModeEnabled = panelMode === "advanced";
  const togglePanelMode = (): void => {
    const nextMode: PanelMode = advancedModeEnabled ? "creator" : "advanced";

    setPanelMode(nextMode);
    window.localStorage.setItem(panelModeStorageKey, nextMode);
  };

  if (authState.status !== "allowed") {
    return <AccessRequired authState={authState} />;
  }

  if (isStandaloneChatRoute) {
    return (
    <main className="surface chat-surface chat-window-surface">
      <ChatWindowHeader apiBaseUrl={apiBaseUrl} />
      <ChatServiceStatusStrip apiBaseUrl={apiBaseUrl} />
      <StreamerChatViewer apiBaseUrl={apiBaseUrl} newestOnTop maxMessages={60} variant="standalone" />
    </main>
  );
  }

  if (isModerationRulesRoute) {
    return (
      <main className="surface chat-surface chat-window-surface">
        <div className="surface-header chat-surface-header">
          <div className="surface-title">
            <h1>Moderation</h1>
            <p>{authState.displayName}</p>
          </div>
          <div className="status-action-group">
            <a className="secondary-window-link" href="/chat">Chat</a>
            <a className="secondary-window-link" href="/control">Control panel</a>
          </div>
        </div>
        <ModerationControlWindow apiBaseUrl={apiBaseUrl} />
      </main>
    );
  }

  if (isAiControlsRoute) {
    return (
      <main className="surface chat-surface chat-window-surface">
        <div className="surface-header chat-surface-header">
          <div className="surface-title">
            <h1>AI Controls</h1>
            <p>{authState.displayName}</p>
          </div>
          <div className="status-action-group">
            <a className="secondary-window-link" href="/chat">Chat</a>
            <a className="secondary-window-link" href="/moderation">Moderation</a>
            <a className="secondary-window-link" href="/control">Control panel</a>
          </div>
        </div>
        <AiControlsWindow />
      </main>
    );
  }

  return (
    <main className="surface">
      <div className="surface-header">
        <div className="surface-title">
          <h1>Maiks.yt Control Panel</h1>
          <p>{authState.displayName}</p>
        </div>
        <button
          type="button"
          className={`panel-mode-toggle ${advancedModeEnabled ? "advanced" : ""}`}
          aria-pressed={advancedModeEnabled}
          onClick={togglePanelMode}
        >
          {advancedModeEnabled ? "Advanced" : "Creator"}
        </button>
      </div>
      <SurfaceStatus apiBaseUrl={apiBaseUrl} panelMode={panelMode} />
      <MusicControlPanel />
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
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
