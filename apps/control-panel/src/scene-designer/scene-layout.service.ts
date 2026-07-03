import type { OverlaySceneDefinition, OverlaySceneSlotDefinition, OverlaySceneSlotId } from "@maiks-yt/events";
import { overlaySceneSlotIds } from "@maiks-yt/themes";
import type { CSSProperties } from "react";
import type { SceneLayoutWarning } from "./SceneDesigner.types.js";

export const createSceneSlotStyle = (slot: OverlaySceneSlotDefinition, canvas: OverlaySceneDefinition["canvas"]): CSSProperties => ({
  height: `${slot.height / canvas.height * 100}%`,
  left: `${slot.x / canvas.width * 100}%`,
  top: `${slot.y / canvas.height * 100}%`,
  width: `${slot.width / canvas.width * 100}%`
});

export const formatSlotLabel = (slotId: OverlaySceneSlotId): string => {
  return slotId.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
};

export const cloneScene = (scene: OverlaySceneDefinition): OverlaySceneDefinition => structuredClone(scene);

export const clamp = (value: number, minimum: number, maximum: number): number => {
  return Math.min(maximum, Math.max(minimum, value));
};

export const slotsOverlap = (
  firstSlot: OverlaySceneSlotDefinition,
  secondSlot: OverlaySceneSlotDefinition
): boolean => {
  return firstSlot.x < secondSlot.x + secondSlot.width
    && firstSlot.x + firstSlot.width > secondSlot.x
    && firstSlot.y < secondSlot.y + secondSlot.height
    && firstSlot.y + firstSlot.height > secondSlot.y;
};

export const getSceneLayoutWarnings = (scene: OverlaySceneDefinition): SceneLayoutWarning[] => {
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

export const createSceneCopyKey = (sceneKey: string, scenes: OverlaySceneDefinition[]): string => {
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

