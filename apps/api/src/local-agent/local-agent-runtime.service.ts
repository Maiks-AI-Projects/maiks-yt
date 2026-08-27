import { randomUUID } from "node:crypto";

import type {
  AgentIdentity,
  AgentStatus,
  CapabilityRegistration,
  CommandAcknowledgement,
  CommandEnvelope,
  JsonValue
} from "@maiks-yt/events";
import { isTerminalAcknowledgement } from "@maiks-yt/events";

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
  expiryTimer: ReturnType<typeof setTimeout> | null;
};

export type LocalAgentRuntimeStatus = ReturnType<LocalAgentRuntimeService["getStatus"]>;
export type LocalAgentStatusListener = (status: LocalAgentRuntimeStatus) => void;
export type LocalAgentAcknowledgementListener = (
  acknowledgement: CommandAcknowledgement,
  command: CommandEnvelope
) => void;

const maxCommandRecords = 256;
const maxTimerDelayMs = 2_147_483_647;

export class LocalAgentRuntimeService {
  #active: ActiveConnection | null = null;
  readonly #commands = new Map<string, CommandRecord>();
  readonly #statusListeners = new Set<LocalAgentStatusListener>();
  readonly #acknowledgementListeners = new Set<LocalAgentAcknowledgementListener>();

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
    this.#notifyStatus();

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
    this.#notifyStatus();
    return true;
  }

  acknowledge(input: {
    identity: AgentIdentity;
    acknowledgement: CommandAcknowledgement;
  }): boolean {
    if (!this.#matchesActiveIdentity(input.identity)) {
      return false;
    }

    this.#expireDueCommands();

    const record = this.#commands.get(input.acknowledgement.eventId);
    if (!record || record.command.commandId !== input.acknowledgement.commandId) {
      return false;
    }

    if (record.acknowledgement && isTerminalAcknowledgement(record.acknowledgement)) {
      return true;
    }

    record.acknowledgement = structuredClone(input.acknowledgement);
    if (isTerminalAcknowledgement(input.acknowledgement)) {
      this.#clearExpiryTimer(record);
    }
    this.#active!.lastSeenAt = new Date().toISOString();
    for (const listener of this.#acknowledgementListeners) {
      listener(structuredClone(input.acknowledgement), structuredClone(record.command));
    }
    this.#notifyStatus();
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
    const record: CommandRecord = { acknowledgement: null, command, expiryTimer: null };
    this.#commands.set(command.eventId, record);
    this.#scheduleExpiry(record);
    this.#pruneCommands();
    active.socket.send(JSON.stringify(command));
    return { ok: true, command: structuredClone(command) };
  }

  close(connectionId: string): void {
    if (this.#active?.connectionId === connectionId) {
      this.#active = null;
      this.#notifyStatus();
    }
  }

  subscribeToStatus(listener: LocalAgentStatusListener): () => void {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  }

  subscribeToAcknowledgements(listener: LocalAgentAcknowledgementListener): () => void {
    this.#acknowledgementListeners.add(listener);
    return () => this.#acknowledgementListeners.delete(listener);
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
    this.#expireDueCommands();
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
      const oldest = this.#commands.get(oldestKey);
      if (oldest) {
        this.#clearExpiryTimer(oldest);
      }
      this.#commands.delete(oldestKey);
    }
  }

  #scheduleExpiry(record: CommandRecord): void {
    const expiresAtMs = record.command.expiresAt ? Date.parse(record.command.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAtMs)) {
      return;
    }

    const delayMs = Math.min(maxTimerDelayMs, Math.max(0, expiresAtMs - Date.now()));
    record.expiryTimer = setTimeout(() => {
      if (this.#expireCommand(record.command.eventId, Date.now())) {
        this.#notifyStatus();
      } else {
        this.#scheduleExpiry(record);
      }
    }, delayMs);
  }

  #expireDueCommands(nowMs = Date.now()): void {
    for (const eventId of this.#commands.keys()) {
      this.#expireCommand(eventId, nowMs);
    }
  }

  #expireCommand(eventId: string, nowMs: number): boolean {
    const record = this.#commands.get(eventId);
    if (!record || (record.acknowledgement && isTerminalAcknowledgement(record.acknowledgement))) {
      return false;
    }

    const expiresAtMs = record.command.expiresAt ? Date.parse(record.command.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs > nowMs) {
      return false;
    }

    this.#clearExpiryTimer(record);
    const acknowledgement: CommandAcknowledgement = {
      eventId: record.command.eventId,
      commandId: record.command.commandId,
      status: "expired",
      acknowledgedAt: new Date(nowMs).toISOString(),
      replayed: false,
      error: {
        code: "COMMAND_EXPIRED",
        message: "Command expired before terminal acknowledgement",
        retriable: true
      }
    };
    record.acknowledgement = acknowledgement;
    for (const listener of this.#acknowledgementListeners) {
      listener(structuredClone(acknowledgement), structuredClone(record.command));
    }
    return true;
  }

  #clearExpiryTimer(record: CommandRecord): void {
    if (record.expiryTimer) {
      clearTimeout(record.expiryTimer);
      record.expiryTimer = null;
    }
  }

  #notifyStatus(): void {
    const status = this.getStatus();
    for (const listener of this.#statusListeners) {
      listener(status);
    }
  }
}
