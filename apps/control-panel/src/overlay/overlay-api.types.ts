import type { OverlaySceneDefinition } from "@maiks-yt/events";

export type OverlayScenesResponse = {
  ok: true;
  scenes: OverlaySceneDefinition[];
} | {
  ok: false;
  reason: string;
};
