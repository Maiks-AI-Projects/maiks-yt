import type {
  OverlayActiveGoalState,
  OverlayLayoutKey,
  OverlayPresentationState,
  StreamerChatMessage
} from "@maiks-yt/events";

export const overlayLayoutOptions: Array<{ key: OverlayLayoutKey; label: string }> = [
  { key: "standard", label: "Standard" },
  { key: "camera-left", label: "Camera left" },
  { key: "camera-right", label: "Camera right" },
  { key: "clean", label: "Clean" }
];
export const redeemPresetOptions = [
  { key: "hydrate", label: "Hydrate" },
  { key: "jumpscare", label: "Jumpscare" },
  { key: "mime", label: "Mime" }
] as const;

export type RedeemPreset = typeof redeemPresetOptions[number]["key"];

export type OverlayPresenceState =
  | {
    status: "checking";
  }
  | {
    status: "ready";
    activeOverlayConnections: number;
    checkedAt: string;
    emergencyCleanModeEnabled: boolean;
    chatVisible: boolean;
    chatNewestOnTop: boolean;
    sponsorVisible: boolean;
    aiMuted: boolean;
    topBarEnabled: boolean;
    centerEnabled: boolean;
    centerDefaultTiming: CenterNotificationTiming;
    presentationState: OverlayPresentationState;
    activeGoal: OverlayActiveGoalState | null;
  }
  | {
    status: "error";
    message: string;
  };

export type CenterNotificationTiming = {
  onscreenMs: number;
  fadeOutMs: number;
  restMs: number;
};

export type OverlayStatusResponse = {
  ok: true;
  activeOverlayConnections: number;
  overlayActive: boolean;
  checkedAt: string;
  presentationState: OverlayPresentationState;
  emergencyCleanModeEnabled: boolean;
  chatVisible: boolean;
  chatNewestOnTop: boolean;
  sponsorVisible: boolean;
  aiMuted: boolean;
  topBarEnabled: boolean;
  centerEnabled: boolean;
  centerDefaultTiming: CenterNotificationTiming;
  activeGoal: OverlayActiveGoalState | null;
} | {
  ok: false;
  reason: string;
};

export type OverlayGoalUpdateResponse = {
  ok: true;
  activeGoal: OverlayActiveGoalState;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

export type OverlayRedeemTestResponse = {
  ok: true;
  queued: number;
  redeem: RedeemPreset;
  reason?: string;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

export type OverlayFakeChatTestResponse = {
  ok: true;
  queued: number;
  reason?: string;
  mutedUntil?: string;
  chatVisible: boolean;
  streamerChatMessage: StreamerChatMessage | null;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

export type OverlayChatOrderResponse = {
  ok: true;
  chatNewestOnTop: boolean;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

export type OverlayPresentationStateResponse = {
  ok: true;
  presentationState: OverlayPresentationState;
  activeOverlayConnections: number;
} | {
  ok: false;
  reason: string;
};

export type SurfaceStatusProps = {
  apiBaseUrl: string;
  panelMode: string;
};

export const defaultGoalDraft = (): OverlayActiveGoalState => ({
  enabled: true,
  label: "Server upgrade fund",
  currentAmount: 320,
  targetAmount: 500,
  currencyCode: "EUR"
});
