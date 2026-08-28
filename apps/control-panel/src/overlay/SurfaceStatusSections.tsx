import type {
  OverlayActiveGoalState,
  OverlayLayoutKey,
  OverlayPresentationState,
  OverlaySceneDefinition
} from "@maiks-yt/events";
import {
  defaultGoalDraft,
  overlayLayoutOptions,
  type CenterNotificationTiming,
  type OverlayPresenceState
} from "./SurfaceStatus.types.js";

type SurfaceStatusControlsProps = {
  chatNewestOnTop: boolean;
  chatVisible: boolean;
  emergencyCleanModeEnabled: boolean;
  overlayActive: boolean;
  overlayPresence: OverlayPresenceState;
  panelMode: string;
  sponsorVisible: boolean;
  topBarEnabled: boolean;
  unsupportedProductControlsEnabled: boolean;
  updateChatOrder: (newestOnTop: boolean) => Promise<void>;
  updateChatVisibility: (visible: boolean) => Promise<void>;
  updateEmergencyCleanMode: (enabled: boolean) => Promise<void>;
  updateSponsorVisibility: (visible: boolean) => Promise<void>;
  updateTopBarEnabled: (enabled: boolean) => Promise<void>;
};

export const SurfaceStatusControls = ({
  chatNewestOnTop,
  chatVisible,
  emergencyCleanModeEnabled,
  overlayActive,
  overlayPresence,
  panelMode,
  sponsorVisible,
  topBarEnabled,
  unsupportedProductControlsEnabled,
  updateChatOrder,
  updateChatVisibility,
  updateEmergencyCleanMode,
  updateSponsorVisibility,
  updateTopBarEnabled
}: SurfaceStatusControlsProps): React.ReactNode => (
  <>
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
      {unsupportedProductControlsEnabled ? (
        <button type="button" className="status-action" onClick={() => void updateSponsorVisibility(!sponsorVisible)}>
          {sponsorVisible ? "Sponsor on" : "Sponsor off"}
        </button>
      ) : null}
    </div>
  </>
);

type OverlayTargetSettingsProps = {
  presentationState: OverlayPresentationState;
  sceneOptions: OverlaySceneDefinition[];
  themedSceneOptions: OverlaySceneDefinition[];
  updatePresentationState: (patch: Partial<OverlayPresentationState>) => Promise<void>;
};

export const OverlayTargetSettings = ({
  presentationState,
  sceneOptions,
  themedSceneOptions,
  updatePresentationState
}: OverlayTargetSettingsProps): React.ReactNode => (
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
);

type GoalWidgetSettingsProps = {
  activeGoal: OverlayActiveGoalState | null;
  goalDraft: OverlayActiveGoalState;
  saveActiveGoal: () => Promise<void>;
  setGoalDraft: (goal: OverlayActiveGoalState) => void;
  unsupportedProductControlsEnabled: boolean;
  updateGoalDraft: (patch: Partial<OverlayActiveGoalState>) => void;
};

export const GoalWidgetSettings = ({
  activeGoal,
  goalDraft,
  saveActiveGoal,
  setGoalDraft,
  unsupportedProductControlsEnabled,
  updateGoalDraft
}: GoalWidgetSettingsProps): React.ReactNode => {
  if (!unsupportedProductControlsEnabled) {
    return null;
  }

  return (
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
        <button type="button" className="status-action" onClick={() => void saveActiveGoal()}>
          Save goal
        </button>
      </div>
    </details>
  );
};

type NotificationSettingsProps = {
  centerEnabled: boolean;
  centerTiming: CenterNotificationTiming;
  updateCenterSettings: (patch: Partial<CenterNotificationTiming> & { enabled?: boolean }) => Promise<void>;
};

export const NotificationSettings = ({
  centerEnabled,
  centerTiming,
  updateCenterSettings
}: NotificationSettingsProps): React.ReactNode => (
  <details className="notification-settings">
    <summary>Center notification timing</summary>
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
);
