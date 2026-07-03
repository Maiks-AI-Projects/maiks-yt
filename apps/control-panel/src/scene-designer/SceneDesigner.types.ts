import type { OverlaySceneDefinition, OverlaySceneSlotId } from "@maiks-yt/events";

export type OverlaySceneSaveResponse = {
  ok: true;
  scene: OverlaySceneDefinition;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

export type SlotDragState = {
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

export type SlotResizeState = {
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

export type SceneLayoutWarning = {
  id: string;
  message: string;
  severity: "blocked" | "warning";
  slotIds: readonly OverlaySceneSlotId[];
};

export type SceneDesignerProps = {
  apiBaseUrl: string;
};

