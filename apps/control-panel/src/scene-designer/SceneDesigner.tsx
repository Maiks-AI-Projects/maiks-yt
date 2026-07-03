import type {
  OverlaySceneDefinition,
  OverlaySceneSlotDefinition,
  OverlaySceneSlotId
} from "@maiks-yt/events";
import { getDefaultThemeScene, overlaySceneSlotIds } from "@maiks-yt/themes";
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { OverlayScenesResponse } from "../overlay/overlay-api.types.js";

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
  severity: "blocked" | "warning";
  slotIds: readonly OverlaySceneSlotId[];
};

type SceneDesignerProps = {
  apiBaseUrl: string;
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
        severity: "blocked",
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
          severity: "warning",
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

export const SceneDesigner = ({ apiBaseUrl }: SceneDesignerProps): React.ReactNode => {
  const [scenes, setScenes] = useState<OverlaySceneDefinition[]>([]);
  const [selectedSceneKey, setSelectedSceneKey] = useState<string>("default");
  const [selectedSlotId, setSelectedSlotId] = useState<OverlaySceneSlotId>("camera");
  const [dragState, setDragState] = useState<SlotDragState | null>(null);
  const [resizeState, setResizeState] = useState<SlotResizeState | null>(null);
  const [status, setStatus] = useState<string>("Loading scenes.");

  const selectedScene = scenes.find((scene) => scene.sceneKey === selectedSceneKey) ?? scenes[0] ?? null;
  const selectedSlot = selectedScene?.slots[selectedSlotId] ?? null;
  const layoutWarnings = selectedScene ? getSceneLayoutWarnings(selectedScene) : [];
  const blockedLayoutIssues = layoutWarnings.filter((warning) => warning.severity === "blocked");
  const softLayoutWarnings = layoutWarnings.filter((warning) => warning.severity === "warning");
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
          <div className="scene-canvas-panel">
            <div className="scene-canvas-heading">
              <strong>Canvas preview</strong>
              <span>{selectedScene.canvas.width} x {selectedScene.canvas.height} px</span>
            </div>
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
          </div>
          {selectedSlot ? (
            <div className="slot-editor">
              <div className={`layout-warning-summary ${layoutWarnings.length > 0 ? "warning" : "clear"}`}>
                <strong>
                  {layoutWarnings.length > 0
                    ? `${blockedLayoutIssues.length} blocked issue(s), ${softLayoutWarnings.length} warning(s)`
                    : "No layout warnings"}
                </strong>
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

