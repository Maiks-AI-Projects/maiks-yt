import type { OverlayActiveGoalState } from "./overlay.state.js";
import type {
  OverlayCenterNotificationTiming,
  OverlayRoutedNotificationQueuedEvent,
  OverlayTopBarNotificationQueuedEvent
} from "./overlay.events.js";
import type { StreamerChatMessage } from "./streamer-chat.events.js";

export const obsWidgetBridgeProtocolVersion = 1 as const;

export type ObsWidgetKind = "alerts-effects" | "chat" | "sponsor" | "stream-goal";

export type ObsWidgetViewport = {
  width: number;
  height: number;
};

export type ObsWidgetDescriptor = {
  kind: ObsWidgetKind;
  label: string;
  resizeMode: "fluid" | "full-canvas";
  defaultViewport: ObsWidgetViewport;
  minimumViewport?: ObsWidgetViewport;
};

export type ObsWidgetThemeState = {
  key: string;
  label: string;
  version: string;
};

export type ObsWidgetStateSnapshot = {
  sessionId: string;
  revision: number;
  generatedAt: string;
  theme: ObsWidgetThemeState;
  emergencyCleanModeEnabled: boolean;
  widgets: {
    alertsEffects: {
      centerDefaultTiming: OverlayCenterNotificationTiming;
      centerEnabled: boolean;
      topEnabled: boolean;
    };
    chat: {
      messages: StreamerChatMessage[];
      newestOnTop: boolean;
      visible: boolean;
    };
    sponsor: {
      visible: boolean;
    };
    streamGoal: {
      goal: OverlayActiveGoalState | null;
      visible: boolean;
    };
  };
};

export type ObsBridgeEffectEvent =
  | OverlayRoutedNotificationQueuedEvent
  | OverlayTopBarNotificationQueuedEvent;

export type ObsBridgeClientHelloMessage = {
  type: "obs.bridge.hello";
  payload: {
    protocolVersion: typeof obsWidgetBridgeProtocolVersion;
    installationId: string;
    clientVersion: string;
    supportedWidgets: ObsWidgetKind[];
    readyWidgets: ObsWidgetKind[];
  };
};

export type ObsBridgeCapabilitiesUpdateMessage = {
  type: "obs.bridge.capabilities.update";
  payload: {
    readyWidgets: ObsWidgetKind[];
  };
};

export type ObsBridgeEffectAckMessage = {
  type: "obs.effect.ack";
  payload: {
    deliveryId: string;
    status: "started" | "completed" | "failed";
    acknowledgedAt: string;
  };
};

export type StreamCountdownStartedPayload = {
  occurrenceId: string;
  countdownRuntimeId: "last-caretaker-runtime-v2";
  durationSeconds: 600;
  startedAt: string;
  endsAt: string;
  triggerSource: "stream_deck" | "control";
  plannedStreamId?: string | undefined;
};

export type ObsBridgeCountdownStartedMessage = {
  type: "stream.countdown.started";
  payload: StreamCountdownStartedPayload;
};

export type ObsBridgeCountdownStartedAckMessage = {
  type: "stream.countdown.started.ack";
  payload: {
    occurrenceId: string;
    status: "accepted" | "duplicate";
  };
};

export type ObsBridgeClientMessage =
  | ObsBridgeCapabilitiesUpdateMessage
  | ObsBridgeCountdownStartedMessage
  | ObsBridgeClientHelloMessage
  | ObsBridgeEffectAckMessage;

export type ObsBridgeWelcomeMessage = {
  type: "obs.bridge.welcome";
  payload: {
    connectionId: string;
    sessionId: string;
    protocolVersion: typeof obsWidgetBridgeProtocolVersion;
    effectDelivery: "master-overlay" | "obs-bridge";
    widgets: ObsWidgetDescriptor[];
    theme: ObsWidgetThemeState;
    connectedAt: string;
  };
};

export type ObsBridgeStateSnapshotMessage = {
  type: "obs.widget.state.snapshot";
  payload: ObsWidgetStateSnapshot;
};

export type ObsBridgeEffectDeliveryMessage = {
  type: "obs.effect.deliver";
  payload: {
    deliveryId: string;
    eventId: string;
    event: ObsBridgeEffectEvent;
    expiresAt: string;
  };
};

export type ObsBridgeHeartbeatMessage = {
  type: "obs.bridge.heartbeat";
  payload: {
    sentAt: string;
  };
};

export type ObsBridgeErrorMessage = {
  type: "obs.bridge.error";
  payload: {
    code: "invalid_message" | "unsupported_protocol";
    message: string;
  };
};

export type ObsBridgeServerMessage =
  | ObsBridgeCountdownStartedAckMessage
  | ObsBridgeEffectDeliveryMessage
  | ObsBridgeErrorMessage
  | ObsBridgeHeartbeatMessage
  | ObsBridgeStateSnapshotMessage
  | ObsBridgeWelcomeMessage;
