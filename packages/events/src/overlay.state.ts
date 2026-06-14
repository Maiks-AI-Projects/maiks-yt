import type {
  OverlayCenterNotificationTiming,
  OverlayEvent,
  OverlayNotificationQueuedEvent
} from "./overlay.events.js";

export type OverlayBuiltInSceneKey = "default" | "gameplay" | "chat-focus" | "just-camera" | "talking";

export type OverlaySceneKey = OverlayBuiltInSceneKey | (string & {});

export type OverlayLayoutKey = "standard" | "camera-left" | "camera-right" | "clean";

export type OverlayThemeKey = "default" | "satisfactory";

export type OverlayPresentationState = {
  scene: OverlaySceneKey;
  layout: OverlayLayoutKey;
  theme: OverlayThemeKey;
};

export type OverlayConnectionStatus = "snapshot" | "live" | "reconnecting" | "offline";

export type OverlaySceneSlotId =
  | "game"
  | "camera"
  | "chat"
  | "sponsorPrimary"
  | "sponsorSecondary"
  | "topNotifications"
  | "centerNotifications"
  | "streamGoal";

export type OverlaySceneSlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlaySceneSlotDefinition = OverlaySceneSlotRect & {
  visible: boolean;
  lockedAspectRatio?: number | undefined;
};

export type OverlayCanvasDefinition = {
  width: number;
  height: number;
};

export type OverlaySceneDefinition = {
  themeKey: OverlayThemeKey;
  sceneKey: OverlaySceneKey;
  label: string;
  canvas: OverlayCanvasDefinition;
  slots: Record<OverlaySceneSlotId, OverlaySceneSlotDefinition>;
};

export type OverlaySlotState = {
  id: string;
  visible: boolean;
  label: string;
};

export type OverlayTopBarState = {
  enabled: boolean;
  quietHighlightIntervalMs: number;
};

export type OverlayCenterNotificationState = {
  enabled: boolean;
  defaultTiming: OverlayCenterNotificationTiming;
};

export type OverlayActiveGoalState = {
  enabled: boolean;
  label: string;
  currentAmount: number;
  targetAmount: number;
  currencyCode: string;
};

export type OverlayStateSnapshot = {
  id: string;
  scene: OverlaySceneKey;
  layout: OverlayLayoutKey;
  theme: OverlayThemeKey;
  mode: "normal" | "clean";
  connectionStatus: OverlayConnectionStatus;
  sceneDefinition: OverlaySceneDefinition;
  topBar: OverlayTopBarState;
  center: OverlayCenterNotificationState;
  activeGoal: OverlayActiveGoalState | null;
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
