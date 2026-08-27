import type { CommandAcknowledgement, DeviceId, EventId } from "../protocol/agent-protocol.types.js";

export type PersistedAcknowledgement = CommandAcknowledgement & {
  status: Exclude<CommandAcknowledgement["status"], "received">;
};

export type AgentState = {
  schemaVersion: 1;
  deviceId: DeviceId;
  completedEvents: Record<EventId, PersistedAcknowledgement>;
};

export interface AgentStateStore {
  getDeviceId(): DeviceId;
  getAcknowledgement(eventId: EventId): PersistedAcknowledgement | undefined;
  recordAcknowledgement(acknowledgement: PersistedAcknowledgement): Promise<void>;
}
