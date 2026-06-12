import type { OverlayEvent, OverlayNotificationQueuedEvent } from "./overlay.events.js";

export type OverlaySceneKey = "default" | "gameplay" | "chat-focus" | "just-camera";

export type OverlayLayoutKey = "standard" | "camera-left" | "camera-right" | "clean";

export type OverlayThemeKey = "default";

export type OverlayConnectionStatus = "snapshot" | "live" | "reconnecting" | "offline";

export type OverlaySlotState = {
  id: string;
  visible: boolean;
  label: string;
};

export type OverlayStateSnapshot = {
  id: string;
  scene: OverlaySceneKey;
  layout: OverlayLayoutKey;
  theme: OverlayThemeKey;
  mode: "normal" | "clean";
  connectionStatus: OverlayConnectionStatus;
  topNotification: OverlayNotificationQueuedEvent["payload"] | null;
  centerNotification: OverlayNotificationQueuedEvent["payload"] | null;
  slots: {
    camera: OverlaySlotState;
    chat: OverlaySlotState;
    sponsorPrimary: OverlaySlotState;
    sponsorSecondary: OverlaySlotState;
    streamGoal: OverlaySlotState;
  };
  updatedAt: string;
};

export type OverlayLiveMessage =
  | {
    type: "overlay.state.snapshot";
    payload: OverlayStateSnapshot;
  }
  | {
    type: "overlay.connection.heartbeat";
    payload: {
      id: string;
      sentAt: string;
    };
  }
  | OverlayEvent;
