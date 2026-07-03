import type { OverlaySceneDefinition, OverlaySceneSlotDefinition, OverlaySceneSlotId } from "@maiks-yt/events";
import { getDefaultThemeScene } from "@maiks-yt/themes";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { OverlayScenesResponse } from "../overlay/overlay-api.types.js";
import {
  cloneScene,
  clamp,
  createSceneCopyKey,
  formatSlotLabel,
  getSceneLayoutWarnings
} from "./scene-layout.service.js";
import { SceneCanvasPreview, SceneDesignerToolbar, SlotEditorPanel } from "./SceneDesignerSections.js";
import type {
  OverlaySceneSaveResponse,
  SceneDesignerProps,
  SlotDragState,
  SlotResizeState
} from "./SceneDesigner.types.js";

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
      <SceneDesignerToolbar
        duplicateSelectedScene={duplicateSelectedScene}
        loadScenes={loadScenes}
        saveSelectedScene={saveSelectedScene}
        scenes={scenes}
        selectedSceneKey={selectedScene?.sceneKey ?? selectedSceneKey}
        selectedSlotId={selectedSlotId}
        setSelectedSceneKey={setSelectedSceneKey}
        setSelectedSlotId={setSelectedSlotId}
      />
      {selectedScene ? (
        <div className="scene-designer-grid">
          <SceneCanvasPreview
            finishSlotDrag={finishSlotDrag}
            finishSlotResize={finishSlotResize}
            moveSlotDrag={moveSlotDrag}
            moveSlotResize={moveSlotResize}
            selectedScene={selectedScene}
            selectedSlotId={selectedSlotId}
            setSelectedSlotId={setSelectedSlotId}
            startSlotDrag={startSlotDrag}
            startSlotResize={startSlotResize}
            warningSlotIds={warningSlotIds}
          />
          {selectedSlot ? (
            <SlotEditorPanel
              blockedLayoutIssues={blockedLayoutIssues}
              layoutWarnings={layoutWarnings}
              resetSelectedSlot={resetSelectedSlot}
              selectedScene={selectedScene}
              selectedSlot={selectedSlot}
              softLayoutWarnings={softLayoutWarnings}
              updateSelectedSlot={updateSelectedSlot}
              updateSelectedSlotAspectLock={updateSelectedSlotAspectLock}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
