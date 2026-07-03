import type {
  OverlayActiveGoalState,
  OverlayLayoutKey,
  OverlayPresentationState,
  OverlaySceneDefinition,
  StreamerChatMessage
} from "@maiks-yt/events";
import { validateUrlAccessGate } from "@maiks-yt/ui";
import { useEffect, useState } from "react";
import { ChatServiceStatusStrip } from "./chat/ChatServiceStatusStrip.js";
import { ChatWindowHeader } from "./chat/ChatWindowHeader.js";
import { StreamerChatViewer } from "./chat/StreamerChatViewer.js";
import { formatChatTime } from "./chat/chat-time.service.js";
import { ModerationControlWindow } from "./moderation/ModerationControlWindow.js";
import { OperationsPanel } from "./operations/OperationsPanel.js";
import type { OverlayScenesResponse } from "./overlay/overlay-api.types.js";
import { RealtimeProbe } from "./realtime/RealtimeProbe.js";
import { SimulatorPanel } from "./simulator/SimulatorPanel.js";
import { SceneDesigner } from "./scene-designer/SceneDesigner.js";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const panelModeStorageKey = "maiks.yt.control.panelMode";
const currentRoutePath = window.location.pathname.replace(/\/+$/, "") || "/";
const isStandaloneChatRoute = currentRoutePath === "/chat";
const isModerationRulesRoute = currentRoutePath === "/moderation";
const defaultPanelMode = "creator";
const overlayLayoutOptions: Array<{ key: OverlayLayoutKey; label: string }> = [
  { key: "standard", label: "Standard" },
  { key: "camera-left", label: "Camera left" },
  { key: "camera-right", label: "Camera right" },
  { key: "clean", label: "Clean" }
];
const redeemPresetOptions = [
  { key: "hydrate", label: "Hydrate" },
  { key: "jumpscare", label: "Jumpscare" },
  { key: "mime", label: "Mime" }
] as const;

type PanelMode = "creator" | "advanced";
type RedeemPreset = typeof redeemPresetOptions[number]["key"];

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

type OverlayPresenceState =
  | {
    status: "checking";
  }
  | {
    status: "ready";
    activeOverlayConnections: number;
    checkedAt: string;
    emergencyCleanModeEnabled: boolean;
    chatVisible: boolean;
    chatNewestOnTop: boolean;
    sponsorVisible: boolean;
    aiMuted: boolean;
    topBarEnabled: boolean;
    centerEnabled: boolean;
    centerDefaultTiming: CenterNotificationTiming;
    presentationState: OverlayPresentationState;
    activeGoal: OverlayActiveGoalState | null;
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
  presentationState: OverlayPresentationState;
  emergencyCleanModeEnabled: boolean;
  chatVisible: boolean;
  chatNewestOnTop: boolean;
  sponsorVisible: boolean;
  aiMuted: boolean;
  topBarEnabled: boolean;
  centerEnabled: boolean;
  centerDefaultTiming: CenterNotificationTiming;
  activeGoal: OverlayActiveGoalState | null;
} | {
  ok: false;
  reason: string;
};

type OverlayGoalUpdateResponse = {
  ok: true;
  activeGoal: OverlayActiveGoalState;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

type OverlayRedeemTestResponse = {
  ok: true;
  queued: number;
  redeem: RedeemPreset;
  reason?: string;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

type OverlayFakeChatTestResponse = {
  ok: true;
  queued: number;
  reason?: string;
  mutedUntil?: string;
  chatVisible: boolean;
  streamerChatMessage: StreamerChatMessage | null;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

type OverlayChatOrderResponse = {
  ok: true;
  chatNewestOnTop: boolean;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

type OverlayPresentationStateResponse = {
  ok: true;
  presentationState: OverlayPresentationState;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

const defaultGoalDraft = (): OverlayActiveGoalState => ({
  enabled: true,
  label: "Server upgrade fund",
  currentAmount: 320,
  targetAmount: 500,
  currencyCode: "EUR"
});

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

const updateManifestForRoute = (): void => {
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');

  if (manifestLink) {
    manifestLink.href = isStandaloneChatRoute ? "/chat-manifest.webmanifest" : "/manifest.webmanifest";
  }
};

const SurfaceStatus = ({ panelMode }: { panelMode: PanelMode }): React.ReactNode => {
  const [overlayPresence, setOverlayPresence] = useState<OverlayPresenceState>({ status: "checking" });
  const [topBarActionStatus, setTopBarActionStatus] = useState<string | null>(null);
  const [sceneOptions, setSceneOptions] = useState<OverlaySceneDefinition[]>([]);
  const [fakeChatAuthorName, setFakeChatAuthorName] = useState("Test chatter");
  const [fakeChatMessage, setFakeChatMessage] = useState("Hello from local test chat.");
  const [goalDraft, setGoalDraft] = useState<OverlayActiveGoalState>(defaultGoalDraft);

  useEffect(() => {
    let disposed = false;
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    const refreshPresence = async (): Promise<void> => {
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
            emergencyCleanModeEnabled: result.emergencyCleanModeEnabled,
            chatVisible: result.chatVisible,
            chatNewestOnTop: result.chatNewestOnTop,
            sponsorVisible: result.sponsorVisible,
            aiMuted: result.aiMuted,
            topBarEnabled: result.topBarEnabled,
            centerEnabled: result.centerEnabled,
            centerDefaultTiming: result.centerDefaultTiming,
            presentationState: result.presentationState,
            activeGoal: result.activeGoal
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

    const loadScenes = async (): Promise<void> => {
      if (!token) {
        return;
      }

      try {
        const url = new URL("/overlay/scenes", apiBaseUrl);
        url.searchParams.set("accessToken", token);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Overlay scenes failed with ${response.status}`);
        }

        const result = await response.json() as OverlayScenesResponse;

        if (!result.ok) {
          throw new Error(result.reason);
        }

        if (!disposed) {
          setSceneOptions(result.scenes);
        }
      } catch {
        if (!disposed) {
          setSceneOptions([]);
        }
      }
    };

    void refreshPresence();
    void loadScenes();
    const interval = window.setInterval(refreshPresence, 5_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  const overlayActive = overlayPresence.status === "ready" && overlayPresence.activeOverlayConnections > 0;
  const emergencyCleanModeEnabled = overlayPresence.status === "ready" && overlayPresence.emergencyCleanModeEnabled;
  const chatVisible = overlayPresence.status === "ready" && overlayPresence.chatVisible;
  const chatNewestOnTop = overlayPresence.status === "ready" && overlayPresence.chatNewestOnTop;
  const sponsorVisible = overlayPresence.status === "ready" && overlayPresence.sponsorVisible;
  const aiMuted = overlayPresence.status === "ready" && overlayPresence.aiMuted;
  const topBarEnabled = overlayPresence.status === "ready" && overlayPresence.topBarEnabled;
  const centerEnabled = overlayPresence.status === "ready" && overlayPresence.centerEnabled;
  const centerTiming = overlayPresence.status === "ready"
    ? overlayPresence.centerDefaultTiming
    : {
      onscreenMs: 4_000,
      fadeOutMs: 700,
      restMs: 1_500
    };
  const presentationState = overlayPresence.status === "ready"
    ? overlayPresence.presentationState
    : {
      scene: "default",
      layout: "standard",
      theme: "default"
    };
  const themedSceneOptions = sceneOptions.filter((scene) => scene.themeKey === presentationState.theme);
  const activeGoal = overlayPresence.status === "ready" ? overlayPresence.activeGoal : null;
  const goalSignature = overlayPresence.status === "ready"
    ? JSON.stringify(activeGoal)
    : "unavailable";

  useEffect(() => {
    if (activeGoal) {
      setGoalDraft(activeGoal);
    }
  }, [goalSignature]);

  const updateGoalDraft = (patch: Partial<OverlayActiveGoalState>): void => {
    setGoalDraft((currentGoal) => ({
      ...currentGoal,
      ...patch
    }));
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

  const updateEmergencyCleanMode = async (enabled: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/emergency-clean-mode`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        enabled
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Emergency clean mode failed with ${response.status}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        emergencyCleanModeEnabled: enabled
      }
      : currentState);
    setTopBarActionStatus(enabled ? "Emergency clean mode on." : "Emergency clean mode off.");
  };

  const updateChatVisibility = async (visible: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/chat/visibility`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        visible
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Chat visibility failed with ${response.status}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        chatVisible: visible
      }
      : currentState);
    setTopBarActionStatus(visible ? "Chat on." : "Chat off.");
  };

  const updateChatOrder = async (newestOnTop: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/chat/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        newestOnTop
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Chat order failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlayChatOrderResponse;

    if (!result.ok) {
      setTopBarActionStatus(`Chat order failed: ${result.reason}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        chatNewestOnTop: result.chatNewestOnTop
      }
      : currentState);
    setTopBarActionStatus(result.chatNewestOnTop ? "Newest chat on top." : "Newest chat on bottom.");
  };

  const updateSponsorVisibility = async (visible: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/sponsor/visibility`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        visible
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Sponsor visibility failed with ${response.status}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        sponsorVisible: visible
      }
      : currentState);
    setTopBarActionStatus(visible ? "Sponsor on." : "Sponsor off.");
  };

  const updateAiMuted = async (muted: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/ai/muted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        muted
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`AI mute failed with ${response.status}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        aiMuted: muted
      }
      : currentState);
    setTopBarActionStatus(muted ? "AI muted." : "AI live.");
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

  const sendRoutedNotificationTest = async (
    route: "top" | "center",
    afterCenter: "top" | "none" = "top"
  ): Promise<void> => {
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
        afterCenter,
        count: route === "center" ? 1 : 4
      })
    });

    setTopBarActionStatus(response.ok
      ? route === "center" && afterCenter === "none"
        ? "Center-only redeem queued."
        : route === "center" ? "Center then top test queued." : "Routed top burst sent."
      : `Notification test failed with ${response.status}.`);
  };

  const sendRedeemTest = async (redeem: RedeemPreset): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/redeem/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        redeem
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Redeem test failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlayRedeemTestResponse;

    if (!result.ok) {
      setTopBarActionStatus(`Redeem test failed: ${result.reason}.`);
      return;
    }

    setTopBarActionStatus(result.queued > 0 ? `${result.redeem} redeem queued.` : `Redeem skipped: ${result.reason ?? "not queued"}.`);
  };

  const sendFakeChatMessage = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");
    const trimmedAuthorName = fakeChatAuthorName.trim();
    const trimmedMessage = fakeChatMessage.trim();

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    if (!trimmedAuthorName || !trimmedMessage) {
      setTopBarActionStatus("Fake chat author and message are required.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/chat/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        authorKind: "human",
        authorName: trimmedAuthorName,
        message: trimmedMessage
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Fake chat failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlayFakeChatTestResponse;

    if (!result.ok) {
      setTopBarActionStatus(`Fake chat failed: ${result.reason}.`);
      return;
    }

    if (result.reason === "fake_local_author_muted") {
      setTopBarActionStatus(result.mutedUntil
        ? `Fake chat suppressed by local mute until ${formatChatTime(result.mutedUntil)}.`
        : "Fake chat suppressed by local mute.");
      return;
    }

    setTopBarActionStatus(result.chatVisible
      ? `Fake chat sent to ${result.activeOverlayConnections} overlay connection(s).`
      : "Fake chat sent, but chat is currently hidden.");
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

  const updatePresentationState = async (patch: Partial<OverlayPresentationState>): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    if (overlayPresence.status !== "ready") {
      setTopBarActionStatus("Overlay status unavailable.");
      return;
    }

    const nextState: OverlayPresentationState = {
      ...overlayPresence.presentationState,
      ...patch
    };
    const response = await fetch(`${apiBaseUrl}/overlay/presentation-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        ...nextState
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Overlay target failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlayPresentationStateResponse;

    if (!result.ok) {
      setTopBarActionStatus(`Overlay target failed: ${result.reason}.`);
      return;
    }

    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        presentationState: result.presentationState
      }
      : currentState);
    setTopBarActionStatus(`Overlay target set to ${result.presentationState.scene} / ${result.presentationState.layout}.`);
  };

  const saveActiveGoal = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    if (goalDraft.currentAmount > goalDraft.targetAmount) {
      setTopBarActionStatus("Goal current amount must stay at or below the target.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/goal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        ...goalDraft,
        currencyCode: goalDraft.currencyCode.toUpperCase()
      })
    });

    if (!response.ok) {
      setTopBarActionStatus(`Goal save failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlayGoalUpdateResponse;

    if (!result.ok) {
      setTopBarActionStatus(`Goal save failed: ${result.reason}.`);
      return;
    }

    setGoalDraft(result.activeGoal);
    setOverlayPresence((currentState) => currentState.status === "ready"
      ? {
        ...currentState,
        activeGoal: result.activeGoal
      }
      : currentState);
    setTopBarActionStatus(result.activeGoal.enabled ? "Active goal saved." : "Goal hidden.");
  };

  return (
    <section className="surface-status" aria-label="Surface status">
      <div className="status-pill active">
        <span>Control panel</span>
        <strong>active</strong>
      </div>
      {panelMode === "advanced" ? (
        <div className="status-pill">
          <span>Panel mode</span>
          <strong>advanced</strong>
          {overlayPresence.status === "ready" ? <small>{overlayPresence.checkedAt}</small> : null}
        </div>
      ) : null}
      <div className={`status-pill ${overlayActive ? "active" : "idle"}`}>
        <span>Overlay</span>
        <strong>{overlayPresence.status === "checking" ? "checking" : overlayActive ? "active" : "idle"}</strong>
        {overlayPresence.status === "ready" ? <small>{overlayPresence.activeOverlayConnections} connected</small> : null}
        {overlayPresence.status === "error" ? <small>{overlayPresence.message}</small> : null}
      </div>
      <button
        type="button"
        className={`status-action emergency-clean-action ${emergencyCleanModeEnabled ? "danger-action" : ""}`}
        onClick={() => void updateEmergencyCleanMode(!emergencyCleanModeEnabled)}
      >
        {emergencyCleanModeEnabled ? "Clean mode on" : "Emergency clean"}
      </button>
      <div className="status-action-group critical-controls" aria-label="Critical overlay controls">
        <button type="button" className="status-action" onClick={() => void updateTopBarEnabled(!topBarEnabled)}>
          {topBarEnabled ? "Top bar on" : "Top bar off"}
        </button>
        <button type="button" className="status-action" onClick={() => void updateChatVisibility(!chatVisible)}>
          {chatVisible ? "Chat on" : "Chat off"}
        </button>
        <button type="button" className="status-action" onClick={() => void updateChatOrder(!chatNewestOnTop)}>
          {chatNewestOnTop ? "Newest top" : "Newest bottom"}
        </button>
        <button type="button" className="status-action" onClick={() => void updateSponsorVisibility(!sponsorVisible)}>
          {sponsorVisible ? "Sponsor on" : "Sponsor off"}
        </button>
        <button type="button" className="status-action" onClick={() => void updateAiMuted(!aiMuted)}>
          {aiMuted ? "AI muted" : "AI live"}
        </button>
      </div>
      <div className="status-action-group notification-test-controls" aria-label="Notification test controls">
        <button type="button" className="status-action" onClick={() => void sendTopBarTest()}>
          Test top bar
        </button>
        <button type="button" className="status-action" onClick={() => void sendRoutedNotificationTest("center", "top")}>
          Test center + top
        </button>
        <button type="button" className="status-action" onClick={() => void sendRedeemTest("hydrate")}>
          Test redeem
        </button>
      </div>
      <div className="notification-settings overlay-presentation-settings" aria-label="Overlay target settings">
        <strong>Overlay target</strong>
        <label>
          <span>Scene</span>
          <select
            value={presentationState.scene}
            onChange={(event) => void updatePresentationState({ scene: event.currentTarget.value })}
          >
            {themedSceneOptions.length === 0 ? <option value={presentationState.scene}>{presentationState.scene}</option> : null}
            {themedSceneOptions.map((scene) => (
              <option key={`${scene.themeKey}:${scene.sceneKey}`} value={scene.sceneKey}>{scene.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Layout</span>
          <select
            value={presentationState.layout}
            onChange={(event) => void updatePresentationState({ layout: event.currentTarget.value as OverlayLayoutKey })}
          >
            {overlayLayoutOptions.map((layout) => (
              <option key={layout.key} value={layout.key}>{layout.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select
            value={presentationState.theme}
            onChange={(event) => {
              const theme = event.currentTarget.value as OverlayPresentationState["theme"];
              const firstThemeScene = sceneOptions.find((scene) => scene.themeKey === theme);

              void updatePresentationState({
                theme,
                ...(firstThemeScene ? { scene: firstThemeScene.sceneKey } : {})
              });
            }}
          >
            <option value="default">Default</option>
            <option value="satisfactory">Satisfactory</option>
          </select>
        </label>
      </div>
      <div className="notification-settings fake-chat-settings" aria-label="Fake chat test">
        <strong>Fake chat test</strong>
        <label>
          <span>Name</span>
          <input
            maxLength={40}
            type="text"
            value={fakeChatAuthorName}
            onChange={(event) => setFakeChatAuthorName(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Message</span>
          <input
            maxLength={280}
            type="text"
            value={fakeChatMessage}
            onChange={(event) => setFakeChatMessage(event.currentTarget.value)}
          />
        </label>
        <button type="button" className="status-action" onClick={() => void sendFakeChatMessage()}>
          Send fake chat
        </button>
      </div>
      <StreamerChatViewer apiBaseUrl={apiBaseUrl} newestOnTop={chatNewestOnTop} />
      <details className="notification-settings">
        <summary>Goal widget</summary>
        <label>
          <span>Enabled</span>
          <input
            checked={goalDraft.enabled}
            type="checkbox"
            onChange={(event) => updateGoalDraft({ enabled: event.currentTarget.checked })}
          />
        </label>
        <label>
          <span>Label</span>
          <input
            maxLength={80}
            type="text"
            value={goalDraft.label}
            onChange={(event) => updateGoalDraft({ label: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Current</span>
          <input
            min={0}
            max={1000000}
            step={1}
            type="number"
            value={goalDraft.currentAmount}
            onChange={(event) => updateGoalDraft({ currentAmount: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>Target</span>
          <input
            min={1}
            max={1000000}
            step={1}
            type="number"
            value={goalDraft.targetAmount}
            onChange={(event) => updateGoalDraft({ targetAmount: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>Currency</span>
          <input
            maxLength={3}
            type="text"
            value={goalDraft.currencyCode}
            onChange={(event) => updateGoalDraft({ currencyCode: event.currentTarget.value.toUpperCase() })}
          />
        </label>
        <div className="status-action-group goal-settings-actions">
          <button type="button" className="status-action" onClick={() => setGoalDraft(activeGoal ?? defaultGoalDraft())}>
            Reset
          </button>
          <button type="button" className="status-action" onClick={() => setGoalDraft(defaultGoalDraft())}>
            Load demo
          </button>
          <button type="button" className="status-action" onClick={() => void saveActiveGoal()}>
            Save goal
          </button>
        </div>
      </details>
      {topBarActionStatus ? <span className="status-note">{topBarActionStatus}</span> : null}
      <details className="notification-settings">
        <summary>Notification settings</summary>
        <div className="status-action-group redeem-test-actions">
          {redeemPresetOptions.map((redeem) => (
            <button
              type="button"
              className="status-action"
              key={redeem.key}
              onClick={() => void sendRedeemTest(redeem.key)}
            >
              {redeem.label}
            </button>
          ))}
        </div>
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

const App = (): React.ReactNode => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [panelMode, setPanelMode] = useState<PanelMode>(defaultPanelMode);

  useEffect(() => {
    updateManifestForRoute();
    document.title = isStandaloneChatRoute
      ? "Maiks.yt Streamer Chat"
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
    return (
      <main className={`surface ${isStandaloneChatRoute || isModerationRulesRoute ? "chat-surface" : ""}`}>
        <h1>Access Required</h1>
        <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      </main>
    );
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
      <SurfaceStatus panelMode={panelMode} />
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
