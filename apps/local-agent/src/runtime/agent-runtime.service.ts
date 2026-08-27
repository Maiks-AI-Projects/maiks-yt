import { ZodError } from "zod";
import type {
  AgentIdentity,
  CommandAcknowledgement,
  CommandEnvelope,
  JsonValue
} from "../protocol/agent-protocol.types.js";
import { parseAgentServerMessage } from "../protocol/agent-protocol.schema.js";
import type { AgentStateStore, PersistedAcknowledgement } from "../state/agent-state.types.js";
import type { OutboundConnector, OutboundSession } from "../transport/outbound-transport.js";
import { ModuleCommandError } from "../modules/agent-module.types.js";
import { ModuleHost } from "../modules/module-host.service.js";
import { getReconnectDelayMs, type ReconnectBackoff } from "./reconnect-backoff.rules.js";

export type AgentRuntimeOptions = {
  connector: OutboundConnector;
  heartbeatIntervalMs: number;
  identity: AgentIdentity;
  moduleHost: ModuleHost;
  reconnect: ReconnectBackoff;
  stateStore: AgentStateStore;
};

export class AgentRuntime {
  readonly #options: AgentRuntimeOptions;
  readonly #startedAt = new Date().toISOString();
  readonly #inFlight = new Map<string, string>();

  constructor(options: AgentRuntimeOptions) {
    this.#options = options;
  }

  async run(signal: AbortSignal): Promise<void> {
    await this.#options.moduleHost.start(signal);
    let reconnectAttempt = 0;
    try {
      while (!signal.aborted) {
        try {
          const session = await this.#options.connector.connect(signal);
          const connectedAt = Date.now();
          await this.#runSession(session, signal);
          if (Date.now() - connectedAt >= this.#options.heartbeatIntervalMs * 2) {
            reconnectAttempt = 0;
          }
        } catch (error) {
          if (signal.aborted) {
            break;
          }
          console.error("Local-agent outbound connection failed", error);
        }
        if (!signal.aborted) {
          const delayMs = getReconnectDelayMs(reconnectAttempt, this.#options.reconnect);
          reconnectAttempt += 1;
          await waitForDelay(delayMs, signal);
        }
      }
    } finally {
      await this.#options.moduleHost.stop();
    }
  }

  async #runSession(session: OutboundSession, signal: AbortSignal): Promise<void> {
    const removeListener = session.onMessage((value) => {
      void this.#handleServerMessage(value, session, signal).catch((error: unknown) => {
        console.error("Failed to handle local-agent server message", error);
      });
    });
    try {
      await session.send({
        type: "register",
        identity: this.#options.identity,
        capabilities: this.#options.moduleHost.getCapabilities(),
        status: this.#status()
      });
      await this.#heartbeatUntilClosed(session, signal);
    } finally {
      removeListener();
      await session.close().catch(() => undefined);
    }
  }

  async #heartbeatUntilClosed(session: OutboundSession, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const outcome = await Promise.race([
        session.closed.then(() => "closed" as const),
        waitForDelay(this.#options.heartbeatIntervalMs, signal).then(() => "heartbeat" as const)
      ]);
      if (outcome === "closed" || signal.aborted) {
        return;
      }
      await session.send({
        type: "heartbeat",
        identity: this.#options.identity,
        status: this.#status()
      });
    }
  }

  async #handleServerMessage(value: unknown, session: OutboundSession, signal: AbortSignal): Promise<void> {
    const message = parseAgentServerMessage(value);
    if (message.type === "registered") {
      console.info(`Local-agent registered as connection ${message.connectionId}`);
      return;
    }
    await this.#handleCommand(message, session, signal);
  }

  async #handleCommand(command: CommandEnvelope, session: OutboundSession, signal: AbortSignal): Promise<void> {
    const persisted = this.#options.stateStore.getAcknowledgement(command.eventId);
    if (persisted) {
      if (persisted.commandId !== command.commandId) {
        await this.#sendAck(session, this.#collisionAck(command));
      } else {
        await this.#sendAck(session, { ...persisted, replayed: true });
      }
      return;
    }
    const inFlightCommandId = this.#inFlight.get(command.eventId);
    if (inFlightCommandId) {
      const acknowledgement = inFlightCommandId === command.commandId
        ? this.#ack(command, "received", true)
        : this.#collisionAck(command);
      await this.#sendAck(session, acknowledgement);
      return;
    }

    this.#inFlight.set(command.eventId, command.commandId);
    try {
      await this.#sendAck(session, this.#ack(command, "received", false));
      let terminal: PersistedAcknowledgement;
      if (command.expiresAt && Date.parse(command.expiresAt) <= Date.now()) {
        terminal = this.#ack(command, "expired", false, undefined, {
          code: "COMMAND_EXPIRED",
          message: "Command expired before execution",
          retriable: false
        });
      } else {
        terminal = await this.#execute(command, signal);
      }
      await this.#options.stateStore.recordAcknowledgement(terminal);
      await this.#sendAck(session, terminal);
    } finally {
      this.#inFlight.delete(command.eventId);
    }
  }

  async #execute(command: CommandEnvelope, signal: AbortSignal): Promise<PersistedAcknowledgement> {
    try {
      const result = await this.#options.moduleHost.execute(command, signal);
      return this.#ack(command, "succeeded", false, result);
    } catch (error) {
      if (error instanceof ModuleCommandError) {
        return this.#ack(command, "failed", false, undefined, {
          code: error.code,
          message: error.message,
          retriable: error.retriable
        });
      }
      if (error instanceof ZodError) {
        return this.#ack(command, "rejected", false, undefined, {
          code: "INVALID_COMMAND_PAYLOAD",
          message: "Command payload did not match the registered action schema",
          retriable: false
        });
      }
      console.error("Local-agent module command failed", error);
      return this.#ack(command, "failed", false, undefined, {
        code: "MODULE_EXECUTION_FAILED",
        message: "The local module failed to execute the command",
        retriable: true
      });
    }
  }

  #ack(
    command: CommandEnvelope,
    status: "received",
    replayed: boolean
  ): CommandAcknowledgement;
  #ack(
    command: CommandEnvelope,
    status: PersistedAcknowledgement["status"],
    replayed: boolean,
    result?: JsonValue,
    error?: CommandAcknowledgement["error"]
  ): PersistedAcknowledgement;
  #ack(
    command: CommandEnvelope,
    status: CommandAcknowledgement["status"],
    replayed: boolean,
    result?: JsonValue,
    error?: CommandAcknowledgement["error"]
  ): CommandAcknowledgement {
    return {
      eventId: command.eventId,
      commandId: command.commandId,
      status,
      acknowledgedAt: new Date().toISOString(),
      replayed,
      ...(result === undefined ? {} : { result }),
      ...(error === undefined ? {} : { error })
    };
  }

  #collisionAck(command: CommandEnvelope): PersistedAcknowledgement {
    return this.#ack(command, "rejected", true, undefined, {
      code: "EVENT_ID_COLLISION",
      message: "Event ID was reused for a different command",
      retriable: false
    });
  }

  #sendAck(session: OutboundSession, acknowledgement: CommandAcknowledgement): Promise<void> {
    return session.send({
      type: "acknowledgement",
      identity: this.#options.identity,
      acknowledgement
    });
  }

  #status() {
    return {
      startedAt: this.#startedAt,
      observedAt: new Date().toISOString(),
      modules: this.#options.moduleHost.getStatuses()
    };
  }
}

function waitForDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || delayMs === 0) {
      resolve();
      return;
    }
    const timeout = setTimeout(finish, delayMs);
    const abort = (): void => finish();
    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      resolve();
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}
