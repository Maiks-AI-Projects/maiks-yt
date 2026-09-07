import { validateUrlAccessGate } from "@maiks-yt/ui";
import { useEffect, useState } from "react";
import { AiControlsWindow } from "./ai/AiControlsWindow.js";
import { ChatServiceStatusStrip } from "./chat/ChatServiceStatusStrip.js";
import { ChatWindowHeader } from "./chat/ChatWindowHeader.js";
import { StreamerChatViewer } from "./chat/StreamerChatViewer.js";
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

type ControlPanelBlockedState = Exclude<ControlPanelAuthState, { status: "allowed" }>;

const AccessRequired = ({ authState }: { authState: ControlPanelBlockedState }): React.ReactNode => (
  <main
    {...controlShellDataAttributes}
    className={`surface access-required-surface ${isStandaloneChatRoute || isModerationRulesRoute || isAiControlsRoute ? "chat-surface" : ""}`}
  >
    <section className="access-required-panel">
      <p className="access-required-eyebrow">{getStreamWindowLabel(currentRoutePath)}</p>
      <h1>Access Required</h1>
      <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      {authState.status === "blocked" ? (
        <>
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
        </>
      ) : null}
    </section>
  </main>
);

const App = (): React.ReactNode => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [panelMode, setPanelMode] = useState<PanelMode>(defaultPanelMode);
  const [moderationAccess, setModerationAccess] = useState<StreamWindowAccessState["moderation"]>("unknown");

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
