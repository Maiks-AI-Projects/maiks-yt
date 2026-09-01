export const LOCAL_AGENT_PROTOCOL_VERSION = 1 as const;
export const LOCAL_AGENT_LIVE_PATH = "/local-agent/live" as const;
export const LOCAL_AGENT_WEBSOCKET_SUBPROTOCOL = "maiks-local-agent.v1" as const;
export const LOCAL_AGENT_VLC_MUSIC_CAPABILITY = "vlc-music" as const;

export const localAgentAudioRouteIds = [
  "communication",
  "music",
  "private",
  "game"
] as const;

export type LocalAgentAudioRouteId = typeof localAgentAudioRouteIds[number];
export type LocalAgentAudioRouteState = "available" | "unavailable" | "error" | "reconnecting";

export type LocalAgentAudioRouteDefinition = {
  id: LocalAgentAudioRouteId;
  label: string;
  pipeWireSink: string;
  mediaRole: string;
};

export const localAgentAudioRouteDefinitions = [
  {
    id: "communication",
    label: "Communication",
    pipeWireSink: "stream_communication",
    mediaRole: "Communication"
  },
  {
    id: "music",
    label: "Music",
    pipeWireSink: "stream_music",
    mediaRole: "Music"
  },
  {
    id: "private",
    label: "Private",
    pipeWireSink: "stream_private",
    mediaRole: "Private"
  },
  {
    id: "game",
    label: "Game",
    pipeWireSink: "stream_game",
    mediaRole: "Game"
  }
] as const satisfies readonly LocalAgentAudioRouteDefinition[];

export type LocalAgentAudioRouteStatus = LocalAgentAudioRouteDefinition & {
  state: LocalAgentAudioRouteState;
  detail?: string | undefined;
};

export const DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID = "music" as const satisfies LocalAgentAudioRouteId;

export const isLocalAgentAudioRouteId = (value: unknown): value is LocalAgentAudioRouteId =>
  typeof value === "string" && localAgentAudioRouteIds.includes(value as LocalAgentAudioRouteId);

export const getLocalAgentAudioRouteDefinition = (
  id: LocalAgentAudioRouteId
): LocalAgentAudioRouteDefinition =>
  localAgentAudioRouteDefinitions.find((route) => route.id === id)
  ?? localAgentAudioRouteDefinitions[1]!;

export const vlcMusicActions = [
  "track.play",
  "track.pause",
  "track.resume",
  "track.stop",
  "track.seek",
  "volume.set",
  "status.get"
] as const;

export type VlcMusicAction = typeof vlcMusicActions[number];

export type VlcMusicPlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "stopped"
  | "ended"
  | "error";

export type VlcMusicPlayCommandPayload = {
  playbackId: string;
  sourceUrl: string;
  startPaused: boolean;
  startAtSeconds: number;
  volumePercent: number;
  audioRouteId: LocalAgentAudioRouteId;
};

export type VlcMusicPlaybackState = {
  available: boolean;
  activeAudioRouteId: LocalAgentAudioRouteId;
  detail?: string | undefined;
  playbackId: string | null;
  positionSeconds: number | null;
  routes: readonly LocalAgentAudioRouteStatus[];
  status: VlcMusicPlaybackStatus;
  volumePercent: number;
};

export type AgentId = string;
export type DeviceId = string;
export type EventId = string;
export type CommandId = string;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type AgentIdentity = {
  agentId: AgentId;
  deviceId: DeviceId;
  protocolVersion: typeof LOCAL_AGENT_PROTOCOL_VERSION;
  serviceVersion: string;
};

export type CapabilityAvailability = "available" | "degraded" | "unavailable";

export type CapabilityRegistration = {
  id: string;
  version: number;
  actions: readonly string[];
  availability: CapabilityAvailability;
  detail?: string | undefined;
};

export type ModuleStatus = {
  capabilityId: string;
  availability: CapabilityAvailability;
  detail?: string | undefined;
  state?: JsonValue | undefined;
};

export type AgentStatus = {
  startedAt: string;
  observedAt: string;
  modules: readonly ModuleStatus[];
};

export type CommandEnvelope = {
  type: "command";
  eventId: EventId;
  commandId: CommandId;
  issuedAt: string;
  expiresAt?: string | undefined;
  capability: string;
  action: string;
  payload: unknown;
};

export type AcknowledgementStatus =
  | "received"
  | "succeeded"
  | "failed"
  | "rejected"
  | "expired";

export type CommandError = {
  code: string;
  message: string;
  retriable: boolean;
};

export type CommandAcknowledgement = {
  eventId: EventId;
  commandId: CommandId;
  status: AcknowledgementStatus;
  acknowledgedAt: string;
  replayed: boolean;
  result?: JsonValue | undefined;
  error?: CommandError | undefined;
};

export type AgentRegisterMessage = {
  type: "register";
  identity: AgentIdentity;
  capabilities: readonly CapabilityRegistration[];
  status: AgentStatus;
};

export type AgentHeartbeatMessage = {
  type: "heartbeat";
  identity: AgentIdentity;
  status: AgentStatus;
};

export type AgentAcknowledgementMessage = {
  type: "acknowledgement";
  identity: AgentIdentity;
  acknowledgement: CommandAcknowledgement;
};

export type AgentClientMessage =
  | AgentRegisterMessage
  | AgentHeartbeatMessage
  | AgentAcknowledgementMessage;

export type AgentRegisteredMessage = {
  type: "registered";
  connectionId: string;
  serverTime: string;
};

export type AgentServerMessage = AgentRegisteredMessage | CommandEnvelope;

export function isTerminalAcknowledgement(
  acknowledgement: CommandAcknowledgement
): boolean {
  return acknowledgement.status !== "received";
}
