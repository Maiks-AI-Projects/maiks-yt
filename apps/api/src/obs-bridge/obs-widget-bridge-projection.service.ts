import type {
  ObsWidgetDescriptor,
  ObsWidgetStateSnapshot,
  ObsWidgetThemeState,
  OverlayStateSnapshot,
  StreamerChatMessage
} from "@maiks-yt/events";

export const obsWidgetDescriptors: ObsWidgetDescriptor[] = [
  {
    kind: "chat",
    label: "Chat",
    resizeMode: "fluid",
    defaultViewport: { width: 480, height: 720 },
    minimumViewport: { width: 320, height: 240 }
  },
  {
    kind: "stream-goal",
    label: "Stream goal",
    resizeMode: "fluid",
    defaultViewport: { width: 800, height: 120 },
    minimumViewport: { width: 360, height: 80 }
  },
  {
    kind: "sponsor",
    label: "Sponsor",
    resizeMode: "fluid",
    defaultViewport: { width: 520, height: 160 },
    minimumViewport: { width: 280, height: 90 }
  },
  {
    kind: "alerts-effects",
    label: "Alerts & Effects",
    resizeMode: "full-canvas",
    defaultViewport: { width: 1920, height: 1080 }
  }
];

export const createObsWidgetThemeState = (themeKey: string): ObsWidgetThemeState => ({
  key: themeKey,
  label: themeKey === "default" ? "Default" : themeKey,
  version: `${themeKey}:1`
});

export const createObsWidgetStateSnapshot = ({
  chatMessages,
  overlaySnapshot,
  revision,
  sessionId
}: {
  chatMessages: StreamerChatMessage[];
  overlaySnapshot: OverlayStateSnapshot;
  revision: number;
  sessionId: string;
}): ObsWidgetStateSnapshot => ({
  sessionId,
  revision,
  generatedAt: new Date().toISOString(),
  theme: createObsWidgetThemeState(overlaySnapshot.theme),
  emergencyCleanModeEnabled: overlaySnapshot.mode === "clean",
  widgets: {
    alertsEffects: {
      centerDefaultTiming: { ...overlaySnapshot.center.defaultTiming },
      centerEnabled: overlaySnapshot.center.enabled && overlaySnapshot.mode !== "clean",
      topEnabled: overlaySnapshot.topBar.enabled && overlaySnapshot.mode !== "clean"
    },
    chat: {
      messages: chatMessages.map((message) => ({ ...message })),
      newestOnTop: overlaySnapshot.chat.newestOnTop,
      visible: overlaySnapshot.slots.chat.visible
    },
    sponsor: {
      visible: overlaySnapshot.slots.sponsorPrimary.visible
    },
    streamGoal: {
      goal: overlaySnapshot.activeGoal ? { ...overlaySnapshot.activeGoal } : null,
      visible: overlaySnapshot.slots.streamGoal.visible
    }
  }
});
