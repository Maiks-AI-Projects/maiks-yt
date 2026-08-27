import { randomUUID } from "node:crypto";

import type {
  AgentIdentity,
  AgentStatus,
  CapabilityRegistration,
  CommandAcknowledgement,
  CommandEnvelope,
  JsonValue
} from "@maiks-yt/events";

export type LocalAgentConnection = {
  close: (code: number, reason: string) => void;
  send: (message: string) => void;
};

type ActiveConnection = {
  capabilities: readonly CapabilityRegistration[];
  connectedAt: string;
  connectionId: string;
  identity: AgentIdentity;
  lastSeenAt: string;
  socket: LocalAgentConnection;
  status: AgentStatus;
};

type CommandRecord = {
  acknowledgement: CommandAcknowledgement | null;
  command: CommandEnvelope;
};

const maxCommandRecords = 256;

export class LocalAgentRuntimeService {
  #active: ActiveConnection | null = null;
  readonly #commands = new Map<string, CommandRecord>();

  register(input: {
    capabilities: readonly CapabilityRegistration[];
    identity: AgentIdentity;
    socket: LocalAgentConnection;
    status: AgentStatus;
  }): { connectionId: string; serverTime: string } {
    const now = new Date().toISOString();
    const connectionId = randomUUID();

    if (this.#active) {
      this.#active.socket.close(1012, "replaced_by_reconnect");
    }

    this.#active = {
      ...input,
      connectedAt: now,
      connectionId,
      lastSeenAt: now
    };

    return { connectionId, serverTime: now };
  }

  heartbeat(input: {
    identity: AgentIdentity;
    status: AgentStatus;
  }): boolean {
    if (!this.#matchesActiveIdentity(input.identity)) {
      return false;
    }

    this.#active!.lastSeenAt = new Date().toISOString();
    this.#active!.status = input.status;
    return true;
  }

  acknowledge(input: {
    identity: AgentIdentity;
    acknowledgement: CommandAcknowledgement;
  }): boolean {
    if (!this.#matchesActiveIdentity(input.identity)) {
      return false;
    }

    const record = this.#commands.get(input.acknowledgement.eventId);
    if (!record || record.command.commandId !== input.acknowledgement.commandId) {
      return false;
    }

    record.acknowledgement = structuredClone(input.acknowledgement);
    this.#active!.lastSeenAt = new Date().toISOString();
    return true;
  }

  issueCommand(input: {
    action: string;
    capability: string;
    expiresAt?: string;
    payload: JsonValue;
  }): { ok: true; command: CommandEnvelope } | {
    ok: false;
    reason: "local_agent_not_connected" | "local_agent_capability_unavailable";
  } {
    const active = this.#active;
    if (!active) {
      return { ok: false, reason: "local_agent_not_connected" };
    }

    const capability = active.capabilities.find((candidate) =>
      candidate.id === input.capability
      && candidate.availability !== "unavailable"
      && candidate.actions.includes(input.action)
    );
    if (!capability) {
      return { ok: false, reason: "local_agent_capability_unavailable" };
    }

    const command: CommandEnvelope = {
      type: "command",
      eventId: randomUUID(),
      commandId: randomUUID(),
      issuedAt: new Date().toISOString(),
      capability: input.capability,
      action: input.action,
      payload: input.payload,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
    };
    this.#commands.set(command.eventId, { acknowledgement: null, command });
    this.#pruneCommands();
    active.socket.send(JSON.stringify(command));
    return { ok: true, command: structuredClone(command) };
  }

  close(connectionId: string): void {
    if (this.#active?.connectionId === connectionId) {
      this.#active = null;
    }
  }

  getStatus(): {
    connected: boolean;
    identity: AgentIdentity | null;
    capabilities: readonly CapabilityRegistration[];
    status: AgentStatus | null;
    connectedAt: string | null;
    lastSeenAt: string | null;
    pendingCommands: number;
  } {
    const active = this.#active;
    return {
      connected: Boolean(active),
      identity: active ? structuredClone(active.identity) : null,
      capabilities: active ? structuredClone(active.capabilities) : [],
      status: active ? structuredClone(active.status) : null,
      connectedAt: active?.connectedAt ?? null,
      lastSeenAt: active?.lastSeenAt ?? null,
      pendingCommands: [...this.#commands.values()].filter((record) =>
        !record.acknowledgement || record.acknowledgement.status === "received"
      ).length
    };
  }

  #matchesActiveIdentity(identity: AgentIdentity): boolean {
    return Boolean(
      this.#active
      && this.#active.identity.agentId === identity.agentId
      && this.#active.identity.deviceId === identity.deviceId
      && this.#active.identity.protocolVersion === identity.protocolVersion
    );
  }

  #pruneCommands(): void {
    while (this.#commands.size > maxCommandRecords) {
      const terminal = [...this.#commands.entries()].find(([, record]) =>
        record.acknowledgement && record.acknowledgement.status !== "received"
      );
      const oldestKey = terminal?.[0] ?? this.#commands.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }
      this.#commands.delete(oldestKey);
    }
  }
}
