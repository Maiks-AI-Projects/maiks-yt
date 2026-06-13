import type { OverlaySceneDefinition, OverlaySceneSlotDefinition, OverlaySceneSlotId } from "@maiks-yt/events";
import { createNotificationScenario, createReplaySessionFromPreset, type EventStormPreset } from "@maiks-yt/testing";
import { getDefaultThemeScene, overlaySceneSlotIds } from "@maiks-yt/themes";
import { validateUrlAccessGate } from "@maiks-yt/ui";
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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
    emergencyCleanModeEnabled: boolean;
    chatVisible: boolean;
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
  emergencyCleanModeEnabled: boolean;
  chatVisible: boolean;
  topBarEnabled: boolean;
  centerEnabled: boolean;
  centerDefaultTiming: CenterNotificationTiming;
} | {
  ok: false;
  reason: string;
};

type OverlayScenesResponse = {
  ok: true;
  scenes: OverlaySceneDefinition[];
} | {
  ok: false;
  reason: string;
};

type OverlaySceneSaveResponse = {
  ok: true;
  scene: OverlaySceneDefinition;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

type SlotDragState = {
  canvasHeight: number;
  canvasWidth: number;
  pointerId: number;
  sceneKey: string;
  slotHeight: number;
  slotId: OverlaySceneSlotId;
  slotWidth: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type SlotResizeState = {
  canvasHeight: number;
  canvasWidth: number;
  lockedAspectRatio?: number | undefined;
  pointerId: number;
  sceneKey: string;
  slotId: OverlaySceneSlotId;
  slotX: number;
  slotY: number;
  startClientX: number;
  startClientY: number;
  startHeight: number;
  startWidth: number;
};

type SceneLayoutWarning = {
  id: string;
  message: string;
  slotIds: readonly OverlaySceneSlotId[];
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
            emergencyCleanModeEnabled: result.emergencyCleanModeEnabled,
            chatVisible: result.chatVisible,
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
  const emergencyCleanModeEnabled = overlayPresence.status === "ready" && overlayPresence.emergencyCleanModeEnabled;
  const chatVisible = overlayPresence.status === "ready" && overlayPresence.chatVisible;
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

  const updateEmergencyCleanMode = async (enabled: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setTopBarActionStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/emergency-clean-mode`, {
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
      <button
        type="button"
        className={`status-action ${emergencyCleanModeEnabled ? "danger-action" : ""}`}
        onClick={() => void updateEmergencyCleanMode(!emergencyCleanModeEnabled)}
      >
        {emergencyCleanModeEnabled ? "Clean mode on" : "Emergency clean"}
      </button>
      <button type="button" className="status-action" onClick={() => void updateTopBarEnabled(!topBarEnabled)}>
        {topBarEnabled ? "Top bar on" : "Top bar off"}
      </button>
      <button type="button" className="status-action" onClick={() => void updateChatVisibility(!chatVisible)}>
        {chatVisible ? "Chat on" : "Chat off"}
      </button>
      <button type="button" className="status-action" onClick={() => void sendTopBarTest()}>
        Test top bar
      </button>
      <button type="button" className="status-action" onClick={() => void sendRoutedNotificationTest("center", "top")}>
        Test center + top
      </button>
      <button type="button" className="status-action" onClick={() => void sendRoutedNotificationTest("center", "none")}>
        Test redeem
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

const createSceneSlotStyle = (slot: OverlaySceneSlotDefinition, canvas: OverlaySceneDefinition["canvas"]): CSSProperties => ({
  height: `${slot.height / canvas.height * 100}%`,
  left: `${slot.x / canvas.width * 100}%`,
  top: `${slot.y / canvas.height * 100}%`,
  width: `${slot.width / canvas.width * 100}%`
});

const formatSlotLabel = (slotId: OverlaySceneSlotId): string => {
  return slotId.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
};

const cloneScene = (scene: OverlaySceneDefinition): OverlaySceneDefinition => structuredClone(scene);

const clamp = (value: number, minimum: number, maximum: number): number => {
  return Math.min(maximum, Math.max(minimum, value));
};

const slotsOverlap = (
  firstSlot: OverlaySceneSlotDefinition,
  secondSlot: OverlaySceneSlotDefinition
): boolean => {
  return firstSlot.x < secondSlot.x + secondSlot.width
    && firstSlot.x + firstSlot.width > secondSlot.x
    && firstSlot.y < secondSlot.y + secondSlot.height
    && firstSlot.y + firstSlot.height > secondSlot.y;
};

const getSceneLayoutWarnings = (scene: OverlaySceneDefinition): SceneLayoutWarning[] => {
  const warnings: SceneLayoutWarning[] = [];
  const visibleSlotIds = overlaySceneSlotIds.filter((slotId) => scene.slots[slotId].visible);
  const overlaySlotIds = visibleSlotIds.filter((slotId) => slotId !== "game");

  for (const slotId of visibleSlotIds) {
    const slot = scene.slots[slotId];

    if (slot.x + slot.width > scene.canvas.width || slot.y + slot.height > scene.canvas.height) {
      warnings.push({
        id: `outside-${slotId}`,
        message: `${formatSlotLabel(slotId)} is outside the ${scene.canvas.width}x${scene.canvas.height} canvas.`,
        slotIds: [slotId]
      });
    }
  }

  for (let firstIndex = 0; firstIndex < overlaySlotIds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < overlaySlotIds.length; secondIndex += 1) {
      const firstSlotId = overlaySlotIds[firstIndex]!;
      const secondSlotId = overlaySlotIds[secondIndex]!;

      if (slotsOverlap(scene.slots[firstSlotId], scene.slots[secondSlotId])) {
        warnings.push({
          id: `overlap-${firstSlotId}-${secondSlotId}`,
          message: `${formatSlotLabel(firstSlotId)} overlaps ${formatSlotLabel(secondSlotId)}.`,
          slotIds: [firstSlotId, secondSlotId]
        });
      }
    }
  }

  return warnings;
};

const createSceneCopyKey = (sceneKey: string, scenes: OverlaySceneDefinition[]): string => {
  const baseKey = `${sceneKey.replace(/-copy(?:-[0-9]+)?$/, "")}-copy`;
  const sceneKeys = new Set(scenes.map((scene) => scene.sceneKey));

  if (!sceneKeys.has(baseKey)) {
    return baseKey;
  }

  for (let index = 2; index < 100; index += 1) {
    const nextKey = `${baseKey}-${index}`;

    if (!sceneKeys.has(nextKey)) {
      return nextKey;
    }
  }

  return `${baseKey}-${Date.now().toString(36)}`.slice(0, 48);
};

const SceneDesigner = (): React.ReactNode => {
  const [scenes, setScenes] = useState<OverlaySceneDefinition[]>([]);
  const [selectedSceneKey, setSelectedSceneKey] = useState<string>("default");
  const [selectedSlotId, setSelectedSlotId] = useState<OverlaySceneSlotId>("camera");
  const [dragState, setDragState] = useState<SlotDragState | null>(null);
  const [resizeState, setResizeState] = useState<SlotResizeState | null>(null);
  const [status, setStatus] = useState<string>("Loading scenes.");

  const selectedScene = scenes.find((scene) => scene.sceneKey === selectedSceneKey) ?? scenes[0] ?? null;
  const selectedSlot = selectedScene?.slots[selectedSlotId] ?? null;
  const layoutWarnings = selectedScene ? getSceneLayoutWarnings(selectedScene) : [];
  const warningSlotIds = new Set(layoutWarnings.flatMap((warning) => warning.slotIds));

  const loadScenes = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    const url = new URL("/overlay/scenes", apiBaseUrl);
    url.searchParams.set("accessToken", token);
    const response = await fetch(url);

    if (!response.ok) {
      setStatus(`Scene load failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlayScenesResponse;

    if (!result.ok) {
      setStatus(result.reason);
      return;
    }

    setScenes(result.scenes.map(cloneScene));
    setSelectedSceneKey((currentSceneKey) =>
      result.scenes.some((scene) => scene.sceneKey === currentSceneKey)
        ? currentSceneKey
        : result.scenes[0]?.sceneKey ?? "default");
    setStatus("Scenes loaded.");
  };

  useEffect(() => {
    void loadScenes();
  }, []);

  const updateSceneSlot = (
    sceneKey: string,
    slotId: OverlaySceneSlotId,
    patch: Partial<OverlaySceneSlotDefinition>
  ): void => {
    setScenes((currentScenes) => currentScenes.map((scene) => {
      if (scene.sceneKey !== sceneKey) {
        return scene;
      }

      return {
        ...scene,
        slots: {
          ...scene.slots,
          [slotId]: {
            ...scene.slots[slotId],
            ...patch
          }
        }
      };
    }));
  };

  const updateSelectedSlot = (patch: Partial<OverlaySceneSlotDefinition>): void => {
    if (!selectedScene) {
      return;
    }

    updateSceneSlot(selectedScene.sceneKey, selectedSlotId, patch);
  };

  const resetSelectedSlot = (): void => {
    if (!selectedScene) {
      return;
    }

    const defaultSlot = getDefaultThemeScene(selectedScene.sceneKey).slots[selectedSlotId];

    updateSceneSlot(selectedScene.sceneKey, selectedSlotId, structuredClone(defaultSlot));
    setStatus(`${formatSlotLabel(selectedSlotId)} reset. Save scene to keep it.`);
  };

  const updateSelectedSlotAspectLock = (locked: boolean): void => {
    if (!selectedSlot) {
      return;
    }

    updateSelectedSlot({
      lockedAspectRatio: locked
        ? selectedSlot.width / Math.max(1, selectedSlot.height)
        : undefined
    });
    setStatus(`${formatSlotLabel(selectedSlotId)} aspect ratio ${locked ? "locked" : "unlocked"}. Save scene to keep it.`);
  };

  const startSlotDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    slotId: OverlaySceneSlotId,
    slot: OverlaySceneSlotDefinition
  ): void => {
    if (!selectedScene || resizeState) {
      return;
    }

    const canvasElement = event.currentTarget.parentElement;

    if (!canvasElement) {
      return;
    }

    const canvasRect = canvasElement.getBoundingClientRect();

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedSlotId(slotId);
    setDragState({
      canvasHeight: canvasRect.height,
      canvasWidth: canvasRect.width,
      pointerId: event.pointerId,
      sceneKey: selectedScene.sceneKey,
      slotHeight: slot.height,
      slotId,
      slotWidth: slot.width,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: slot.x,
      startY: slot.y
    });
    setStatus(`Dragging ${formatSlotLabel(slotId)}.`);
  };

  const moveSlotDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!selectedScene || !dragState || resizeState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = (event.clientX - dragState.startClientX) / dragState.canvasWidth * selectedScene.canvas.width;
    const deltaY = (event.clientY - dragState.startClientY) / dragState.canvasHeight * selectedScene.canvas.height;
    const nextX = clamp(Math.round(dragState.startX + deltaX), 0, selectedScene.canvas.width - dragState.slotWidth);
    const nextY = clamp(Math.round(dragState.startY + deltaY), 0, selectedScene.canvas.height - dragState.slotHeight);

    updateSceneSlot(dragState.sceneKey, dragState.slotId, {
      x: nextX,
      y: nextY
    });
  };

  const finishSlotDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!dragState || resizeState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragState(null);
    setStatus(`${formatSlotLabel(dragState.slotId)} moved. Save scene to keep it.`);
  };

  const startSlotResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    slotId: OverlaySceneSlotId,
    slot: OverlaySceneSlotDefinition
  ): void => {
    if (!selectedScene || dragState) {
      return;
    }

    const canvasElement = event.currentTarget.closest(".scene-canvas");

    if (!(canvasElement instanceof HTMLElement)) {
      return;
    }

    const canvasRect = canvasElement.getBoundingClientRect();

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedSlotId(slotId);
    setResizeState({
      canvasHeight: canvasRect.height,
      canvasWidth: canvasRect.width,
      lockedAspectRatio: slot.lockedAspectRatio,
      pointerId: event.pointerId,
      sceneKey: selectedScene.sceneKey,
      slotId,
      slotX: slot.x,
      slotY: slot.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHeight: slot.height,
      startWidth: slot.width
    });
    setStatus(`Resizing ${formatSlotLabel(slotId)}.`);
  };

  const moveSlotResize = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    if (!selectedScene || !resizeState || dragState || event.pointerId !== resizeState.pointerId) {
      return;
    }

    const deltaX = (event.clientX - resizeState.startClientX) / resizeState.canvasWidth * selectedScene.canvas.width;
    const deltaY = (event.clientY - resizeState.startClientY) / resizeState.canvasHeight * selectedScene.canvas.height;
    const maxWidth = selectedScene.canvas.width - resizeState.slotX;
    const maxHeight = selectedScene.canvas.height - resizeState.slotY;
    let nextWidth = clamp(Math.round(resizeState.startWidth + deltaX), 0, maxWidth);
    let nextHeight = clamp(Math.round(resizeState.startHeight + deltaY), 0, maxHeight);

    if (resizeState.lockedAspectRatio) {
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        nextHeight = clamp(Math.round(nextWidth / resizeState.lockedAspectRatio), 0, maxHeight);
        nextWidth = clamp(Math.round(nextHeight * resizeState.lockedAspectRatio), 0, maxWidth);
      } else {
        nextWidth = clamp(Math.round(nextHeight * resizeState.lockedAspectRatio), 0, maxWidth);
        nextHeight = clamp(Math.round(nextWidth / resizeState.lockedAspectRatio), 0, maxHeight);
      }
    }

    updateSceneSlot(resizeState.sceneKey, resizeState.slotId, {
      height: nextHeight,
      width: nextWidth
    });
  };

  const finishSlotResize = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    if (!resizeState || dragState || event.pointerId !== resizeState.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    event.stopPropagation();
    setResizeState(null);
    setStatus(`${formatSlotLabel(resizeState.slotId)} resized. Save scene to keep it.`);
  };

  useEffect(() => {
    if (!selectedScene || !resizeState || dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== resizeState.pointerId) {
        return;
      }

      const deltaX = (event.clientX - resizeState.startClientX) / resizeState.canvasWidth * selectedScene.canvas.width;
      const deltaY = (event.clientY - resizeState.startClientY) / resizeState.canvasHeight * selectedScene.canvas.height;
      const maxWidth = selectedScene.canvas.width - resizeState.slotX;
      const maxHeight = selectedScene.canvas.height - resizeState.slotY;
      let nextWidth = clamp(Math.round(resizeState.startWidth + deltaX), 0, maxWidth);
      let nextHeight = clamp(Math.round(resizeState.startHeight + deltaY), 0, maxHeight);

      if (resizeState.lockedAspectRatio) {
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
          nextHeight = clamp(Math.round(nextWidth / resizeState.lockedAspectRatio), 0, maxHeight);
          nextWidth = clamp(Math.round(nextHeight * resizeState.lockedAspectRatio), 0, maxWidth);
        } else {
          nextWidth = clamp(Math.round(nextHeight * resizeState.lockedAspectRatio), 0, maxWidth);
          nextHeight = clamp(Math.round(nextWidth / resizeState.lockedAspectRatio), 0, maxHeight);
        }
      }

      updateSceneSlot(resizeState.sceneKey, resizeState.slotId, {
        height: nextHeight,
        width: nextWidth
      });
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.pointerId !== resizeState.pointerId) {
        return;
      }

      setResizeState(null);
      setStatus(`${formatSlotLabel(resizeState.slotId)} resized. Save scene to keep it.`);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, resizeState, selectedScene]);

  const saveSelectedScene = async (): Promise<void> => {
    if (!selectedScene) {
      setStatus("No scene selected.");
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/overlay/scenes/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        scene: selectedScene
      })
    });

    if (!response.ok) {
      setStatus(`Scene save failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlaySceneSaveResponse;

    if (!result.ok) {
      setStatus(result.reason);
      return;
    }

    setScenes((currentScenes) => currentScenes.map((scene) =>
      scene.sceneKey === result.scene.sceneKey ? cloneScene(result.scene) : scene));
    setStatus(`Saved ${result.scene.label}. ${result.activeOverlayConnections} overlay connection(s) updated.`);
  };

  const duplicateSelectedScene = async (): Promise<void> => {
    if (!selectedScene) {
      setStatus("No scene selected.");
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    const duplicatedScene: OverlaySceneDefinition = {
      ...cloneScene(selectedScene),
      label: `${selectedScene.label} Copy`,
      sceneKey: createSceneCopyKey(selectedScene.sceneKey, scenes)
    };
    const response = await fetch(`${apiBaseUrl}/overlay/scenes/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: token,
        scene: duplicatedScene
      })
    });

    if (!response.ok) {
      setStatus(`Scene duplicate failed with ${response.status}.`);
      return;
    }

    const result = await response.json() as OverlaySceneSaveResponse;

    if (!result.ok) {
      setStatus(result.reason);
      return;
    }

    setScenes((currentScenes) => [
      ...currentScenes.filter((scene) => scene.sceneKey !== result.scene.sceneKey),
      cloneScene(result.scene)
    ]);
    setSelectedSceneKey(result.scene.sceneKey);
    setStatus(`Duplicated ${selectedScene.label} as ${result.scene.label}.`);
  };

  return (
    <section className="scene-designer">
      <div className="section-heading">
        <h2>Scene Designer</h2>
        <span>{status}</span>
      </div>
      <div className="scene-designer-toolbar">
        <label>
          <span>Scene</span>
          <select value={selectedScene?.sceneKey ?? selectedSceneKey} onChange={(event) => setSelectedSceneKey(event.currentTarget.value)}>
            {scenes.map((scene) => (
              <option key={scene.sceneKey} value={scene.sceneKey}>{scene.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Slot</span>
          <select value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.currentTarget.value as OverlaySceneSlotId)}>
            {overlaySceneSlotIds.map((slotId) => (
              <option key={slotId} value={slotId}>{formatSlotLabel(slotId)}</option>
            ))}
          </select>
        </label>
        <button type="button" className="status-action" onClick={() => void saveSelectedScene()}>
          Save scene
        </button>
        <button type="button" className="status-action" onClick={() => void duplicateSelectedScene()}>
          Duplicate
        </button>
        <button type="button" className="status-action" onClick={() => void loadScenes()}>
          Reload
        </button>
      </div>
      {selectedScene ? (
        <div className="scene-designer-grid">
          <div className="scene-canvas" aria-label={`${selectedScene.label} layout preview`}>
            {overlaySceneSlotIds.map((slotId) => {
              const slot = selectedScene.slots[slotId];

              return (
                <button
                  type="button"
                  className={`scene-slot ${selectedSlotId === slotId ? "selected" : ""} ${slot.visible ? "visible" : "hidden"} ${warningSlotIds.has(slotId) ? "warning" : ""}`}
                  key={slotId}
                  style={createSceneSlotStyle(slot, selectedScene.canvas)}
                  onClick={() => setSelectedSlotId(slotId)}
                  onPointerCancel={finishSlotDrag}
                  onPointerDown={(event) => startSlotDrag(event, slotId, slot)}
                  onPointerMove={moveSlotDrag}
                  onPointerUp={finishSlotDrag}
                >
                  <span className="scene-slot-label">{formatSlotLabel(slotId)}</span>
                  <span
                    aria-hidden="true"
                    className="scene-slot-resize-handle"
                    onPointerCancel={finishSlotResize}
                    onPointerDown={(event) => startSlotResize(event, slotId, slot)}
                    onPointerMove={moveSlotResize}
                    onPointerUp={finishSlotResize}
                  />
                </button>
              );
            })}
          </div>
          {selectedSlot ? (
            <div className="slot-editor">
              <div className={`layout-warning-summary ${layoutWarnings.length > 0 ? "warning" : "clear"}`}>
                <strong>{layoutWarnings.length > 0 ? `${layoutWarnings.length} layout warning(s)` : "No layout warnings"}</strong>
                {layoutWarnings.length > 0 ? (
                  <ul>
                    {layoutWarnings.map((warning) => (
                      <li key={warning.id}>{warning.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="slot-editor-actions">
                <button type="button" className="status-action" onClick={resetSelectedSlot}>
                  Reset slot
                </button>
              </div>
              <label className="slot-visible">
                <span>Visible</span>
                <input
                  checked={selectedSlot.visible}
                  type="checkbox"
                  onChange={(event) => updateSelectedSlot({ visible: event.currentTarget.checked })}
                />
              </label>
              <label className="slot-visible">
                <span>Lock ratio</span>
                <input
                  checked={selectedSlot.lockedAspectRatio !== undefined}
                  type="checkbox"
                  onChange={(event) => updateSelectedSlotAspectLock(event.currentTarget.checked)}
                />
              </label>
              {(["x", "y", "width", "height"] as const).map((field) => (
                <label key={field}>
                  <span>{field}</span>
                  <input
                    min={0}
                    max={field === "x" || field === "width" ? selectedScene.canvas.width : selectedScene.canvas.height}
                    step={1}
                    type="number"
                    value={selectedSlot[field]}
                    onChange={(event) => updateSelectedSlot({ [field]: Number(event.currentTarget.value) })}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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
      <SceneDesigner />
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
