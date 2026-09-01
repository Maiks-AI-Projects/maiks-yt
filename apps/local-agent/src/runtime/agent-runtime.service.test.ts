import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ModuleCommandError, type AgentModule } from "../modules/agent-module.types.js";
import { ModuleHost } from "../modules/module-host.service.js";
import type {
  AgentClientMessage,
  CommandEnvelope
} from "../protocol/agent-protocol.types.js";
import type { AgentStateStore, PersistedAcknowledgement } from "../state/agent-state.types.js";
import type {
  OutboundConnector,
  OutboundSession,
  TransportClose
} from "../transport/outbound-transport.js";
import { AgentRuntime } from "./agent-runtime.service.js";

const apiAcknowledgementMessageSchema = z.object({
  type: z.literal("acknowledgement"),
  identity: z.object({
    agentId: z.string(),
    deviceId: z.string(),
    protocolVersion: z.literal(1),
    serviceVersion: z.string()
  }).strict(),
  acknowledgement: z.object({
    eventId: z.string().min(1).max(128),
    commandId: z.string().min(1).max(128),
    status: z.enum(["received", "succeeded", "failed", "rejected", "expired"]),
    acknowledgedAt: z.iso.datetime({ offset: true }),
    replayed: z.boolean(),
    result: z.json().optional(),
    error: z.object({
      code: z.string().min(1).max(128),
      message: z.string().trim().min(1).max(500),
      retriable: z.boolean()
    }).strict().optional()
  }).strict()
}).strict();

class MemoryStateStore implements AgentStateStore {
  readonly acknowledgements = new Map<string, PersistedAcknowledgement>();
  getDeviceId() { return "6f107a60-f748-4f9e-90df-4e669242b5e2"; }
  getAcknowledgement(eventId: string) { return this.acknowledgements.get(eventId); }
  async recordAcknowledgement(acknowledgement: PersistedAcknowledgement) {
    this.acknowledgements.set(acknowledgement.eventId, acknowledgement);
  }
}

class FakeSession implements OutboundSession {
  readonly sent: AgentClientMessage[] = [];
  readonly closed: Promise<TransportClose>;
  invalidAcknowledgements = 0;
  #resolveClosed!: (value: TransportClose) => void;
  #listener: ((message: unknown) => void) | undefined;

  constructor() {
    this.closed = new Promise((resolve) => { this.#resolveClosed = resolve; });
  }
  onMessage(listener: (message: unknown) => void) {
    this.#listener = listener;
    return () => { this.#listener = undefined; };
  }
  async send(message: AgentClientMessage) {
    const serialized = JSON.stringify(message);
    if (message.type === "acknowledgement"
      && !apiAcknowledgementMessageSchema.safeParse(JSON.parse(serialized)).success) {
      this.invalidAcknowledgements += 1;
      this.#resolveClosed({ code: 1008, reason: "invalid_message" });
      throw new Error("API acknowledgement schema rejected the Agent message");
    }
    this.sent.push(JSON.parse(serialized) as AgentClientMessage);
  }
  async close() { this.#resolveClosed({ code: 1000, reason: "test" }); }
  disconnect() { this.#resolveClosed({ code: 1006, reason: "test reconnect" }); }
  dispatch(message: unknown) { this.#listener?.(message); }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Timed out waiting for runtime test condition");
}

describe("AgentRuntime", () => {
  it("executes an event once and replays its persisted terminal acknowledgement", async () => {
    const session = new FakeSession();
    const connector: OutboundConnector = { connect: async () => session };
    let executions = 0;
    const module: AgentModule = {
      capabilityId: "test",
      async start() {},
      async stop() {},
      getCapability: () => ({ id: "test", version: 1, actions: ["run"], availability: "available" }),
      getStatus: () => ({ capabilityId: "test", availability: "available" }),
      async execute() {
        executions += 1;
        return { executions };
      }
    };
    const stateStore = new MemoryStateStore();
    const controller = new AbortController();
    const runtime = new AgentRuntime({
      connector,
      heartbeatIntervalMs: 60_000,
      identity: {
        agentId: "test-agent",
        deviceId: stateStore.getDeviceId(),
        protocolVersion: 1,
        serviceVersion: "test"
      },
      moduleHost: new ModuleHost([module]),
      reconnect: { baseMs: 1, maxMs: 2 },
      stateStore
    });
    const run = runtime.run(controller.signal);
    await waitFor(() => session.sent.some((message) => message.type === "register"));
    const command: CommandEnvelope = {
      type: "command",
      eventId: "event-1",
      commandId: "command-1",
      issuedAt: new Date().toISOString(),
      capability: "test",
      action: "run",
      payload: {}
    };
    session.dispatch(command);
    await waitFor(() => stateStore.getAcknowledgement("event-1") !== undefined);
    session.dispatch(command);
    await waitFor(() => session.sent.filter((message) =>
      message.type === "acknowledgement" && message.acknowledgement.status === "succeeded"
    ).length === 2);

    expect(executions).toBe(1);
    const terminal = session.sent.filter((message) =>
      message.type === "acknowledgement" && message.acknowledgement.status === "succeeded"
    );
    expect(terminal[1]).toMatchObject({ acknowledgement: { replayed: true } });
    controller.abort();
    await run;
  });

  it("bounds failed acknowledgements before persistence and replays them across reconnect", async () => {
    const sessions = [new FakeSession(), new FakeSession(), new FakeSession()];
    let connection = 0;
    const connector: OutboundConnector = {
      connect: async () => sessions[Math.min(connection++, sessions.length - 1)]!
    };
    let executions = 0;
    const module: AgentModule = {
      capabilityId: "test",
      async start() {},
      async stop() {},
      getCapability: () => ({ id: "test", version: 1, actions: ["fail"], availability: "available" }),
      getStatus: () => ({ capabilityId: "test", availability: "available" }),
      async execute() {
        executions += 1;
        throw new ModuleCommandError("DETAILED_FAILURE", `sanitized diagnostic: ${"x".repeat(700)}`, true);
      }
    };
    const stateStore = new MemoryStateStore();
    const controller = new AbortController();
    const runtime = new AgentRuntime({
      connector,
      heartbeatIntervalMs: 60_000,
      identity: {
        agentId: "test-agent",
        deviceId: stateStore.getDeviceId(),
        protocolVersion: 1,
        serviceVersion: "test"
      },
      moduleHost: new ModuleHost([module]),
      reconnect: { baseMs: 1, maxMs: 2 },
      stateStore
    });
    const run = runtime.run(controller.signal);
    const command: CommandEnvelope = {
      type: "command",
      eventId: "event-long-diagnostic",
      commandId: "command-long-diagnostic",
      issuedAt: new Date().toISOString(),
      capability: "test",
      action: "fail",
      payload: {}
    };

    try {
      await waitFor(() => sessions[0]!.sent.some((message) => message.type === "register"));
      sessions[0]!.dispatch(command);
      await waitFor(() => stateStore.getAcknowledgement(command.eventId) !== undefined);
      sessions[0]!.disconnect();
      await waitFor(() => sessions[1]!.sent.some((message) => message.type === "register"));
      sessions[1]!.dispatch(command);
      await waitFor(() => sessions[1]!.invalidAcknowledgements > 0 || sessions[1]!.sent.some((message) =>
        message.type === "acknowledgement"
          && message.acknowledgement.eventId === command.eventId
          && message.acknowledgement.status === "failed"
      ));

      const persisted = stateStore.getAcknowledgement(command.eventId);
      expect(persisted?.error?.message.length).toBeLessThanOrEqual(500);
      expect(sessions[0]!.invalidAcknowledgements).toBe(0);
      expect(sessions[1]!.invalidAcknowledgements).toBe(0);
      expect(sessions[1]!.sent).toContainEqual(expect.objectContaining({
        type: "acknowledgement",
        acknowledgement: expect.objectContaining({
          eventId: command.eventId,
          commandId: command.commandId,
          status: "failed",
          replayed: true,
          error: expect.objectContaining({ code: "DETAILED_FAILURE", retriable: true })
        })
      }));
      expect(executions).toBe(1);

      sessions[1]!.dispatch({ ...command, commandId: "different-command" });
      await waitFor(() => sessions[1]!.sent.some((message) =>
        message.type === "acknowledgement"
          && message.acknowledgement.commandId === "different-command"
      ));
      expect(sessions[1]!.sent).toContainEqual(expect.objectContaining({
        type: "acknowledgement",
        acknowledgement: expect.objectContaining({
          status: "rejected",
          replayed: true,
          error: expect.objectContaining({ code: "EVENT_ID_COLLISION", retriable: false })
        })
      }));
      expect(connection).toBe(2);
    } finally {
      controller.abort();
      await run;
    }
  });
});
