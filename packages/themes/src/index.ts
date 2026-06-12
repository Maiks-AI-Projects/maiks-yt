export type OverlayThemeSurface = "website" | "overlay" | "control-panel";

export type OverlaySceneSlotId =
  | "game"
  | "camera"
  | "chat"
  | "sponsorPrimary"
  | "sponsorSecondary"
  | "topNotifications"
  | "centerNotifications"
  | "streamGoal";

export type OverlayLayoutSlot = OverlaySceneSlotId;

export type OverlaySceneSlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlaySceneSlotDefinition = OverlaySceneSlotRect & {
  visible: boolean;
  lockedAspectRatio?: number;
};

export type OverlayCanvasDefinition = {
  width: number;
  height: number;
};

export type OverlaySceneDefinition = {
  themeKey: string;
  sceneKey: string;
  label: string;
  canvas: OverlayCanvasDefinition;
  slots: Record<OverlaySceneSlotId, OverlaySceneSlotDefinition>;
};

export type ThemeManifest = {
  id: string;
  label: string;
  cssFile: string;
  surfaces: readonly OverlayThemeSurface[];
  requiredVariables: readonly string[];
  supportedSlots: readonly OverlayLayoutSlot[];
  defaultScenes: readonly OverlaySceneDefinition[];
};

export const requiredThemeVariables = [
  "--maiks-bg",
  "--maiks-fg",
  "--maiks-muted",
  "--maiks-panel",
  "--maiks-accent",
  "--maiks-danger",
  "--maiks-warning",
  "--maiks-success",
  "--maiks-notification-bg",
  "--maiks-notification-fg"
] as const;

export const overlayCanonicalCanvas: OverlayCanvasDefinition = {
  width: 1920,
  height: 1080
};

export const overlaySceneSlotIds: readonly OverlaySceneSlotId[] = [
  "game",
  "camera",
  "chat",
  "sponsorPrimary",
  "sponsorSecondary",
  "topNotifications",
  "centerNotifications",
  "streamGoal"
];

const hiddenSlot: OverlaySceneSlotDefinition = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  visible: false
};

const createDefaultSlots = (): Record<OverlaySceneSlotId, OverlaySceneSlotDefinition> => ({
  game: {
    x: 32,
    y: 92,
    width: 1856,
    height: 860,
    visible: true
  },
  camera: {
    x: 1504,
    y: 774,
    width: 384,
    height: 216,
    visible: true,
    lockedAspectRatio: 16 / 9
  },
  chat: {
    x: 32,
    y: 774,
    width: 430,
    height: 216,
    visible: true
  },
  sponsorPrimary: {
    x: 690,
    y: 92,
    width: 540,
    height: 76,
    visible: true
  },
  sponsorSecondary: hiddenSlot,
  topNotifications: {
    x: 0,
    y: 0,
    width: 1920,
    height: 64,
    visible: true
  },
  centerNotifications: {
    x: 600,
    y: 330,
    width: 720,
    height: 240,
    visible: true
  },
  streamGoal: {
    x: 690,
    y: 978,
    width: 540,
    height: 76,
    visible: true
  }
});

const createScene = (
  sceneKey: string,
  label: string,
  slots: Partial<Record<OverlaySceneSlotId, OverlaySceneSlotDefinition>>
): OverlaySceneDefinition => ({
  themeKey: "default",
  sceneKey,
  label,
  canvas: overlayCanonicalCanvas,
  slots: {
    ...createDefaultSlots(),
    ...slots
  }
});

export const defaultThemeScenes: readonly OverlaySceneDefinition[] = [
  createScene("default", "Default", {}),
  createScene("gameplay", "Gameplay", {}),
  createScene("chat-focus", "Chat Focus", {
    chat: {
      x: 1280,
      y: 118,
      width: 560,
      height: 760,
      visible: true
    },
    camera: {
      x: 64,
      y: 728,
      width: 480,
      height: 270,
      visible: true,
      lockedAspectRatio: 16 / 9
    }
  }),
  createScene("just-camera", "Just Camera", {
    camera: {
      x: 500,
      y: 180,
      width: 920,
      height: 518,
      visible: true,
      lockedAspectRatio: 16 / 9
    },
    chat: hiddenSlot,
    sponsorPrimary: hiddenSlot,
    streamGoal: hiddenSlot
  }),
  createScene("talking", "Talking", {
    game: hiddenSlot,
    camera: {
      x: 72,
      y: 150,
      width: 1040,
      height: 585,
      visible: true,
      lockedAspectRatio: 16 / 9
    },
    chat: {
      x: 1210,
      y: 150,
      width: 560,
      height: 700,
      visible: true
    },
    sponsorPrimary: {
      x: 72,
      y: 780,
      width: 1040,
      height: 90,
      visible: true
    },
    streamGoal: {
      x: 1210,
      y: 882,
      width: 560,
      height: 86,
      visible: true
    }
  })
];

export const defaultTheme: ThemeManifest = {
  id: "default",
  label: "Default",
  cssFile: "default.css",
  surfaces: ["website", "overlay", "control-panel"],
  requiredVariables: requiredThemeVariables,
  supportedSlots: overlaySceneSlotIds,
  defaultScenes: defaultThemeScenes
};

export const getDefaultThemeScene = (sceneKey: string): OverlaySceneDefinition => {
  return defaultThemeScenes.find((scene) => scene.sceneKey === sceneKey) ?? defaultThemeScenes[0]!;
};
