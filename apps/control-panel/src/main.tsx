import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  resolveControlPanelPage,
  type ControlPanelPageKey
} from "@maiks-yt/domain/security";
import type { ControlPanelAuthState } from "./access/control-access.service.js";
import { useControlAccess } from "./access/control-access.state.js";
import { createAccessRecoveryUrl } from "./access/access-recovery.service.js";
import {
  loadControlPanelNavigation
} from "./access/control-navigation.service.js";
import { ControlActionsPanel } from "./actions/ControlActionsPanel.js";
import { ChatServiceStatusStrip } from "./chat/ChatServiceStatusStrip.js";
import { ChatWindowHeader } from "./chat/ChatWindowHeader.js";
import { StandaloneStreamerChatViewer } from "./chat/StandaloneStreamerChatViewer.js";
import { captureDevAuthTokenFromUrl, withDevAuthToken } from "./dev-auth-token.js";
import { ModerationControlWindow } from "./moderation/ModerationControlWindow.js";
import { MusicControlPanel } from "./music/MusicControlPanel.js";
import { OperationNavIcon, type OperationNavIconName } from "./operations/OperationNavIcon.js";
import { SurfaceStatus } from "./overlay/SurfaceStatus.js";
import { apiBaseUrl, createWebUrl, webBaseUrl } from "./runtime-config.service.js";
import { SceneDesigner } from "./scene-designer/SceneDesigner.js";
import { createRoot } from "react-dom/client";
import "./styles.css";

const panelModeStorageKey = "maiks.yt.control.panelMode";
const controlPageStorageKey = "maiks.yt.control.selectedPage";
const controlSidebarStorageKey = "maiks.yt.control.sidebarCollapsed";
const controlScaleStorageKey = "maiks.yt.control.uiScale";
const currentRoutePath = window.location.pathname.replace(/\/+$/, "") || "/";
const isStandaloneChatRoute = currentRoutePath === "/chat";
const isModerationRoute = currentRoutePath === "/moderation" || currentRoutePath.startsWith("/moderation/");
const defaultPanelMode = "creator";
type PanelMode = "creator" | "advanced";
const controlRouteLabels: Record<string, string> = {
  "/chat": "Streamer Chat",
  "/control": "Control Panel",
  "/moderation": "Moderation"
};

const controlPageLabels: Record<ControlPanelPageKey, string> = {
  actions: "Actions",
  music: "Music",
  overlays: "Overlays & Scenes",
  overview: "Overview",
  providers: "Provider Health",
  stream: "Stream Controls"
};

const controlPagePathSegments: Record<ControlPanelPageKey, string> = {
  actions: "actions",
  music: "music",
  overlays: "overlays",
  overview: "",
  providers: "providers",
  stream: "stream"
};
const controlPageOrder: readonly ControlPanelPageKey[] = ["overview", "stream", "overlays", "actions", "music", "providers"];
const controlPageIcons: Record<ControlPanelPageKey, OperationNavIconName> = {
  actions: "actions",
  music: "music",
  overlays: "overlays",
  overview: "overview",
  providers: "providers",
  stream: "stream"
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
      : isModerationRoute
        ? "/moderation-manifest.webmanifest"
        : "/manifest.webmanifest";
  }
};

const getCurrentSurfaceLabel = (): string =>
  controlRouteLabels[currentRoutePath] ?? "Control Panel";

type ControlPanelBlockedState = Extract<ControlPanelAuthState, { status: "blocked" }>;
type ControlPanelPendingState = Extract<ControlPanelAuthState, { status: "checking" | "reconnecting" }>;
type ControlPanelAllowedState = Extract<ControlPanelAuthState, { status: "allowed" }>;
type LoadedControlNavigation = {
  readonly authState: ControlPanelAllowedState;
  readonly pages: readonly ControlPanelPageKey[];
};

const getInitialControlPage = (): ControlPanelPageKey => {
  const segment = window.location.pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  const routePage = (Object.entries(controlPagePathSegments).find(([, pathSegment]) => pathSegment === segment)?.[0] ?? null) as ControlPanelPageKey | null;

  if (routePage) {
    return routePage;
  }

  const storedPage = window.localStorage.getItem(controlPageStorageKey);

  return storedPage === "actions"
    || storedPage === "music"
    || storedPage === "overlays"
    || storedPage === "overview"
    || storedPage === "providers"
    || storedPage === "stream"
    ? storedPage
    : "overview";
};

const readStoredScale = (): number => {
  const parsedValue = Number(window.localStorage.getItem(controlScaleStorageKey));

  return Number.isFinite(parsedValue) && parsedValue >= 80 && parsedValue <= 120
    ? parsedValue
    : 95;
};

const AccessRequired = ({
  authState,
  onRetry
}: {
  authState: ControlPanelBlockedState;
  onRetry: () => void;
}): React.ReactNode => (
  <main className={`surface access-required-surface ${isStandaloneChatRoute || isModerationRoute ? "chat-surface" : ""}`}>
    <section className="access-required-panel">
      <p className="access-required-eyebrow">{getCurrentSurfaceLabel()}</p>
      <h1>Access Required</h1>
      <p>{authState.message}</p>
      {authState.status === "blocked" ? (
        <>
          <p className="access-required-help">
            {authState.kind === "login-required"
              ? "Renew your account sign-in. The launch token stays in this window and will be checked again when you return."
              : authState.kind === "unavailable"
                ? "This window retries automatically while it is visible and whenever the network returns."
                : "Use a current generated Control Panel access URL. Opening a bare route on a new device is expected to stop here."}
          </p>
          <div className="access-required-actions">
            <button type="button" className="secondary-window-link" onClick={onRetry}>Try again</button>
            {authState.kind === "login-required" ? (
              <a
                className="secondary-window-link"
                href={createAccessRecoveryUrl({
                  currentHref: window.location.href,
                  webBaseUrl
                })}
              >
                Renew sign-in
              </a>
            ) : null}
            {authState.kind === "missing-token" || authState.kind === "token-denied" ? (
              <a className="secondary-window-link" href={withDevAuthToken(createWebUrl("/admin/tokens"))}>
                Access Tokens
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  </main>
);

const ReconnectingAccessStatus = ({
  authState
}: {
  authState: ControlPanelPendingState;
}): React.ReactNode => (
  <main className={`surface access-required-surface ${isStandaloneChatRoute || isModerationRoute ? "chat-surface" : ""}`}>
    <section className="access-required-panel neutral-access-panel">
      <p className="access-required-eyebrow">{getCurrentSurfaceLabel()}</p>
      <h1>{authState.status === "checking" ? "Checking access" : "Reconnecting"}</h1>
      <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      <p className="access-required-help">
        This window is retrying without showing account details or live controls until access is verified.
      </p>
    </section>
  </main>
);

const App = (): React.ReactNode => {
  const handOffConfirmedLogin = useCallback((): void => {
    window.location.assign(createAccessRecoveryUrl({
      currentHref: window.location.href,
      webBaseUrl
    }));
  }, []);
  const { authState, retryAccess, transientIssue } = useControlAccess(
    apiBaseUrl,
    handOffConfirmedLogin
  );
  const [panelMode, setPanelMode] = useState<PanelMode>(defaultPanelMode);
  const [controlPage, setControlPage] = useState<ControlPanelPageKey>(getInitialControlPage);
  const [loadedControlNavigation, setLoadedControlNavigation] = useState<LoadedControlNavigation | null>(null);
  const [failedNavigationAuthState, setFailedNavigationAuthState] = useState<ControlPanelAllowedState | null>(null);
  const [navigationRetryKey, setNavigationRetryKey] = useState(0);
  const [controlSidebarCollapsed, setControlSidebarCollapsed] = useState(() =>
    window.localStorage.getItem(controlSidebarStorageKey) === "true"
  );
  const [uiScale, setUiScale] = useState(readStoredScale);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    updateManifestForRoute();
    document.title = isStandaloneChatRoute
      ? "Maiks.yt Streamer Chat"
      : isModerationRoute
        ? "Maiks.yt Moderation"
        : "Maiks.yt Control Panel";
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

  const chooseControlPage = (page: ControlPanelPageKey): void => {
    setControlPage(page);
    window.localStorage.setItem(controlPageStorageKey, page);
    const segment = controlPagePathSegments[page];
    const nextPath = segment ? `/control/${segment}` : "/control";

    window.history.replaceState(null, "", nextPath);
  };

  useEffect(() => {
    if (authState.status !== "allowed" || isStandaloneChatRoute || isModerationRoute) {
      return;
    }

    let disposed = false;
    setFailedNavigationAuthState(null);

    const loadNavigation = async (): Promise<void> => {
      try {
        const pages = await loadControlPanelNavigation(apiBaseUrl);

        if (disposed) {
          return;
        }

        setLoadedControlNavigation({ authState, pages });
        const requestedPage = getInitialControlPage();
        const nextPage = resolveControlPanelPage(requestedPage, pages);

        setControlPage(nextPage);
        if (nextPage !== requestedPage) {
          window.localStorage.setItem(controlPageStorageKey, nextPage);
          const segment = controlPagePathSegments[nextPage];
          window.history.replaceState(null, "", segment ? `/control/${segment}` : "/control");
        }
      } catch {
        if (!disposed) {
          setLoadedControlNavigation(null);
          setFailedNavigationAuthState(authState);
        }
      }
    };

    void loadNavigation();

    return () => {
      disposed = true;
    };
  }, [authState, navigationRetryKey]);

  const toggleControlSidebar = (): void => {
    setControlSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      window.localStorage.setItem(controlSidebarStorageKey, String(nextValue));
      return nextValue;
    });
  };

  const updateUiScale = (delta: number): void => {
    setUiScale((currentScale) => {
      const nextScale = Math.min(120, Math.max(80, currentScale + delta));

      window.localStorage.setItem(controlScaleStorageKey, String(nextScale));
      return nextScale;
    });
  };

  if (authState.status === "checking" || authState.status === "reconnecting") {
    return <ReconnectingAccessStatus authState={authState} />;
  }

  if (authState.status === "blocked") {
    return <AccessRequired authState={authState} onRetry={retryAccess} />;
  }

  if (isStandaloneChatRoute) {
    return (
    <main className="surface chat-surface chat-window-surface operations-dark" style={{ fontSize: `${uiScale}%` }}>
      <div className="chat-compact-topbar">
        <div className="chat-compact-title">
          <h1>Streamer Chat</h1>
          <span>{authState.displayName}</span>
          {transientIssue ? <span className="control-session-health">Session retrying</span> : null}
        </div>
        <ChatServiceStatusStrip apiBaseUrl={apiBaseUrl} />
        <ChatWindowHeader apiBaseUrl={apiBaseUrl} />
        <div className="ui-scale-control" aria-label="UI scale">
          <button type="button" onClick={() => updateUiScale(-5)}>-</button>
          <span>{uiScale}%</span>
          <button type="button" onClick={() => updateUiScale(5)}>+</button>
        </div>
      </div>
      <StandaloneStreamerChatViewer apiBaseUrl={apiBaseUrl} />
    </main>
  );
  }

  if (isModerationRoute) {
    return (
      <main className="surface chat-surface moderation-surface operations-dark" style={{ fontSize: `${uiScale}%` }}>
        <div className="surface-header chat-surface-header">
          <div className="surface-title">
            <h1>Moderation</h1>
            <p>{authState.displayName}</p>
            {transientIssue ? <p className="control-session-health">Session retrying: {transientIssue.message}</p> : null}
          </div>
          <div className="ui-scale-control" aria-label="UI scale">
            <button type="button" onClick={() => updateUiScale(-5)}>-</button>
            <span>{uiScale}%</span>
            <button type="button" onClick={() => updateUiScale(5)}>+</button>
          </div>
        </div>
        <ModerationControlWindow apiBaseUrl={apiBaseUrl} />
      </main>
    );
  }

  if (failedNavigationAuthState === authState) {
    return (
      <AccessRequired
        authState={{
          status: "blocked",
          kind: "unavailable",
          message: "Your available Control pages could not be verified."
        }}
        onRetry={() => setNavigationRetryKey((currentValue) => currentValue + 1)}
      />
    );
  }

  const availableControlPages = loadedControlNavigation?.authState === authState
    ? loadedControlNavigation.pages
    : null;

  if (availableControlPages === null) {
    return <ReconnectingAccessStatus authState={{ status: "checking" }} />;
  }

  const shellStyle = { fontSize: `${uiScale}%` } satisfies CSSProperties;
  const activeControlPage = resolveControlPanelPage(controlPage, availableControlPages);
  const renderControlPage = (): React.ReactNode => {
    if (activeControlPage === "overlays") {
      return (
        <>
          <section className="overlay-workflow-strip" aria-label="Live-safe overlay workflow">
            <div className="overlay-workflow-step active"><span>1</span> Duplicate</div>
            <div className="overlay-workflow-line" />
            <div className="overlay-workflow-step current"><span>2</span> Edit compatibility layout</div>
          </section>
          <SceneDesigner apiBaseUrl={apiBaseUrl} />
        </>
      );
    }

    if (activeControlPage === "actions") {
      return <ControlActionsPanel apiBaseUrl={apiBaseUrl} />;
    }

    if (activeControlPage === "music") {
      return <MusicControlPanel />;
    }

    if (activeControlPage === "providers") {
      return (
        <section className="provider-health-page" aria-label="Provider health and recovery">
          <div className="section-heading">
            <h2>Provider Health & Recovery</h2>
            <span>Private intake state</span>
          </div>
          <ChatServiceStatusStrip apiBaseUrl={apiBaseUrl} />
        </section>
      );
    }

    return (
      <>
        <SurfaceStatus apiBaseUrl={apiBaseUrl} panelMode={panelMode} />
        {activeControlPage === "overview" ? (
          <section className="control-live-overview" aria-label="Live operations overview">
            {availableControlPages.includes("providers") ? (
              <article>
                <span>Next recovery stop</span>
                <strong>Provider Health</strong>
                <p>Use the recovery page for intake/provider status; raw diagnostics stay out of the routine overview.</p>
              </article>
            ) : null}
            <article>
              <span>Scene work</span>
              <strong>Overlays & Scenes</strong>
              <p>Duplicate a layout before editing. Compatibility saves can update the connected master overlay immediately.</p>
            </article>
            <article>
              <span>Live controls</span>
              <strong>Stream Controls</strong>
              <p>Emergency overlay controls and routine live operation state remain visible here.</p>
            </article>
          </section>
        ) : null}
      </>
    );
  };

  return (
    <main className={`surface operations-dark control-surface ${controlSidebarCollapsed ? "sidebar-collapsed" : ""}`} style={shellStyle}>
      <aside className="operations-sidebar" aria-label="Control pages">
        <button type="button" className="sidebar-collapse-button" onClick={toggleControlSidebar} aria-pressed={controlSidebarCollapsed}>
          {controlSidebarCollapsed ? ">" : "<"}
        </button>
        <nav className="operations-nav">
          {controlPageOrder
            .filter((page) => availableControlPages.includes(page))
            .map((page) => (
              <button
                type="button"
                className={page === activeControlPage ? "active" : ""}
                key={page}
                onClick={() => chooseControlPage(page)}
                title={controlPageLabels[page]}
              >
                <span className="nav-icon" aria-hidden="true"><OperationNavIcon name={controlPageIcons[page]} /></span>
                <span className="nav-label">{controlPageLabels[page]}</span>
              </button>
            ))}
        </nav>
      </aside>
      <section className="operations-page">
        <div className="operations-page-header">
          <div>
            <h1>Control</h1>
            <p>{controlPageLabels[activeControlPage]} · {authState.displayName}</p>
            {transientIssue ? <p className="control-session-health">Session retrying: {transientIssue.message}</p> : null}
          </div>
          <div className="operations-header-actions">
            <button
              type="button"
              className={`panel-mode-toggle ${advancedModeEnabled ? "advanced" : ""}`}
              aria-pressed={advancedModeEnabled}
              onClick={togglePanelMode}
            >
              {advancedModeEnabled ? "Advanced" : "Creator"}
            </button>
            <div className="ui-scale-control" aria-label="UI scale">
              <button type="button" onClick={() => updateUiScale(-5)}>-</button>
              <span>{uiScale}%</span>
              <button type="button" onClick={() => updateUiScale(5)}>+</button>
            </div>
          </div>
        </div>
        {renderControlPage()}
      </section>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
