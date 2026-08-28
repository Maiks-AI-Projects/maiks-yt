import type { OverlayActiveGoalState, OverlayPresentationState } from "@maiks-yt/events";
import { useEffect, useState } from "react";
import { apiFetch } from "../dev-auth-token.js";
import {
  GoalWidgetSettings,
  NotificationSettings,
  SurfaceStatusControls,
  OverlayTargetSettings
} from "./SurfaceStatusSections.js";
import { useOverlayPresence } from "./useOverlayPresence.js";
import {
  defaultGoalDraft,
  type CenterNotificationTiming,
  type OverlayChatOrderResponse,
  type OverlayGoalUpdateResponse,
  type OverlayPresentationStateResponse,
  type SurfaceStatusProps
} from "./SurfaceStatus.types.js";
import { shouldRenderUnsupportedProductOverlayControls } from "./SurfaceStatus.rules.js";

export const SurfaceStatus = ({ apiBaseUrl, panelMode }: SurfaceStatusProps): React.ReactNode => {
  const { overlayPresence, sceneOptions, setOverlayPresence } = useOverlayPresence(apiBaseUrl);
  const [topBarActionStatus, setTopBarActionStatus] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<OverlayActiveGoalState>(defaultGoalDraft);
  const unsupportedProductControlsEnabled = shouldRenderUnsupportedProductOverlayControls();

  const overlayActive = overlayPresence.status === "ready" && overlayPresence.activeOverlayConnections > 0;
  const emergencyCleanModeEnabled = overlayPresence.status === "ready" && overlayPresence.emergencyCleanModeEnabled;
  const chatVisible = overlayPresence.status === "ready" && overlayPresence.chatVisible;
  const chatNewestOnTop = overlayPresence.status === "ready" && overlayPresence.chatNewestOnTop;
  const sponsorVisible = overlayPresence.status === "ready" && overlayPresence.sponsorVisible;
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

    const response = await apiFetch(`${apiBaseUrl}/overlay/top-bar/enabled`, {
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

    const response = await apiFetch(`${apiBaseUrl}/overlay/emergency-clean-mode`, {
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

    const response = await apiFetch(`${apiBaseUrl}/overlay/chat/visibility`, {
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

    const response = await apiFetch(`${apiBaseUrl}/overlay/chat/order`, {
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

    const response = await apiFetch(`${apiBaseUrl}/overlay/sponsor/visibility`, {
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
    const response = await apiFetch(`${apiBaseUrl}/overlay/center/settings`, {
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
    const response = await apiFetch(`${apiBaseUrl}/overlay/presentation-state`, {
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

    const response = await apiFetch(`${apiBaseUrl}/overlay/goal`, {
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
      <SurfaceStatusControls
        chatNewestOnTop={chatNewestOnTop}
        chatVisible={chatVisible}
        emergencyCleanModeEnabled={emergencyCleanModeEnabled}
        overlayActive={overlayActive}
        overlayPresence={overlayPresence}
        panelMode={panelMode}
        sponsorVisible={sponsorVisible}
        topBarEnabled={topBarEnabled}
        unsupportedProductControlsEnabled={unsupportedProductControlsEnabled}
        updateChatOrder={updateChatOrder}
        updateChatVisibility={updateChatVisibility}
        updateEmergencyCleanMode={updateEmergencyCleanMode}
        updateSponsorVisibility={updateSponsorVisibility}
        updateTopBarEnabled={updateTopBarEnabled}
      />
      <OverlayTargetSettings
        presentationState={presentationState}
        sceneOptions={sceneOptions}
        themedSceneOptions={themedSceneOptions}
        updatePresentationState={updatePresentationState}
      />
      <GoalWidgetSettings
        activeGoal={activeGoal}
        goalDraft={goalDraft}
        saveActiveGoal={saveActiveGoal}
        setGoalDraft={setGoalDraft}
        unsupportedProductControlsEnabled={unsupportedProductControlsEnabled}
        updateGoalDraft={updateGoalDraft}
      />
      {topBarActionStatus ? <span className="status-note">{topBarActionStatus}</span> : null}
      <NotificationSettings
        centerEnabled={centerEnabled}
        centerTiming={centerTiming}
        updateCenterSettings={updateCenterSettings}
      />
    </section>
  );
};
