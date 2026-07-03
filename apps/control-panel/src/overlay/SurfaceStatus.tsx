import type { OverlayActiveGoalState, OverlayPresentationState, OverlaySceneDefinition } from "@maiks-yt/events";
import { useEffect, useState } from "react";
import { StreamerChatViewer } from "../chat/StreamerChatViewer.js";
import { formatChatTime } from "../chat/chat-time.service.js";
import type { OverlayScenesResponse } from "./overlay-api.types.js";
import {
  FakeChatSettings,
  GoalWidgetSettings,
  NotificationSettings,
  OverlayTargetSettings
} from "./SurfaceStatusSections.js";
import {
  defaultGoalDraft,
  type CenterNotificationTiming,
  type OverlayChatOrderResponse,
  type OverlayFakeChatTestResponse,
  type OverlayGoalUpdateResponse,
  type OverlayPresenceState,
  type OverlayPresentationStateResponse,
  type OverlayRedeemTestResponse,
  type OverlayStatusResponse,
  type RedeemPreset,
  type SurfaceStatusProps
} from "./SurfaceStatus.types.js";

export const SurfaceStatus = ({ apiBaseUrl, panelMode }: SurfaceStatusProps): React.ReactNode => {
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
  const presentationState: OverlayPresentationState = overlayPresence.status === "ready"
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
      <OverlayTargetSettings
        presentationState={presentationState}
        sceneOptions={sceneOptions}
        themedSceneOptions={themedSceneOptions}
        updatePresentationState={updatePresentationState}
      />
      <FakeChatSettings
        fakeChatAuthorName={fakeChatAuthorName}
        fakeChatMessage={fakeChatMessage}
        sendFakeChatMessage={sendFakeChatMessage}
        setFakeChatAuthorName={setFakeChatAuthorName}
        setFakeChatMessage={setFakeChatMessage}
      />
      <StreamerChatViewer apiBaseUrl={apiBaseUrl} newestOnTop={chatNewestOnTop} />
      <GoalWidgetSettings
        activeGoal={activeGoal}
        goalDraft={goalDraft}
        saveActiveGoal={saveActiveGoal}
        setGoalDraft={setGoalDraft}
        updateGoalDraft={updateGoalDraft}
      />
      {topBarActionStatus ? <span className="status-note">{topBarActionStatus}</span> : null}
      <NotificationSettings
        centerEnabled={centerEnabled}
        centerTiming={centerTiming}
        sendRedeemTest={sendRedeemTest}
        updateCenterSettings={updateCenterSettings}
      />
    </section>
  );
};
