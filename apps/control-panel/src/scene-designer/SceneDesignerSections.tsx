import type {
  OverlaySceneDefinition,
  OverlaySceneSlotDefinition,
  OverlaySceneSlotId
} from "@maiks-yt/events";
import { overlaySceneSlotIds } from "@maiks-yt/themes";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { SceneLayoutWarning } from "./SceneDesigner.types.js";
import { createSceneSlotStyle, formatSlotLabel } from "./scene-layout.service.js";

type SceneDesignerToolbarProps = {
  duplicateSelectedScene: () => Promise<void>;
  loadScenes: () => Promise<void>;
  saveSelectedScene: () => Promise<void>;
  scenes: OverlaySceneDefinition[];
  selectedSceneKey: string;
  selectedSlotId: OverlaySceneSlotId;
  setSelectedSceneKey: (sceneKey: string) => void;
  setSelectedSlotId: (slotId: OverlaySceneSlotId) => void;
};

export const SceneDesignerToolbar = ({
  duplicateSelectedScene,
  loadScenes,
  saveSelectedScene,
  scenes,
  selectedSceneKey,
  selectedSlotId,
  setSelectedSceneKey,
  setSelectedSlotId
}: SceneDesignerToolbarProps): React.ReactNode => (
  <div className="scene-designer-toolbar">
    <label>
      <span>Scene</span>
      <select value={selectedSceneKey} onChange={(event) => setSelectedSceneKey(event.currentTarget.value)}>
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
);

type SceneCanvasPreviewProps = {
  finishSlotDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  finishSlotResize: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  moveSlotDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  moveSlotResize: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  selectedScene: OverlaySceneDefinition;
  selectedSlotId: OverlaySceneSlotId;
  setSelectedSlotId: (slotId: OverlaySceneSlotId) => void;
  startSlotDrag: (
    event: ReactPointerEvent<HTMLButtonElement>,
    slotId: OverlaySceneSlotId,
    slot: OverlaySceneSlotDefinition
  ) => void;
  startSlotResize: (
    event: ReactPointerEvent<HTMLSpanElement>,
    slotId: OverlaySceneSlotId,
    slot: OverlaySceneSlotDefinition
  ) => void;
  warningSlotIds: ReadonlySet<OverlaySceneSlotId>;
};

export const SceneCanvasPreview = ({
  finishSlotDrag,
  finishSlotResize,
  moveSlotDrag,
  moveSlotResize,
  selectedScene,
  selectedSlotId,
  setSelectedSlotId,
  startSlotDrag,
  startSlotResize,
  warningSlotIds
}: SceneCanvasPreviewProps): React.ReactNode => (
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
);

type SlotEditorPanelProps = {
  blockedLayoutIssues: SceneLayoutWarning[];
  layoutWarnings: SceneLayoutWarning[];
  resetSelectedSlot: () => void;
  selectedScene: OverlaySceneDefinition;
  selectedSlot: OverlaySceneSlotDefinition;
  softLayoutWarnings: SceneLayoutWarning[];
  updateSelectedSlot: (patch: Partial<OverlaySceneSlotDefinition>) => void;
  updateSelectedSlotAspectLock: (locked: boolean) => void;
};

export const SlotEditorPanel = ({
  blockedLayoutIssues,
  layoutWarnings,
  resetSelectedSlot,
  selectedScene,
  selectedSlot,
  softLayoutWarnings,
  updateSelectedSlot,
  updateSelectedSlotAspectLock
}: SlotEditorPanelProps): React.ReactNode => (
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
);
