import { describe, expect, it } from "vitest";
import type { AgentModule } from "../modules/agent-module.types.js";
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
  #resolveClosed!: (value: TransportClose) => void;
  #listener: ((message: unknown) => void) | undefined;

  constructor() {
    this.closed = new Promise((resolve) => { this.#resolveClosed = resolve; });
  }
  onMessage(listener: (message: unknown) => void) {
    this.#listener = listener;
    return () => { this.#listener = undefined; };
  }
  async send(message: AgentClientMessage) { this.sent.push(message); }
  async close() { this.#resolveClosed({ code: 1000, reason: "test" }); }
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
});
