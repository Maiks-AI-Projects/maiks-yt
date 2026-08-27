export const LOCAL_AGENT_PROTOCOL_VERSION = 1 as const;

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
