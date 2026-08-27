import { describe, expect, it } from "vitest";
import type { CommandEnvelope } from "../protocol/agent-protocol.types.js";
import type { AgentModule } from "./agent-module.types.js";
import { ModuleHost } from "./module-host.service.js";

function moduleFixture(capabilityId: string, events: string[], failStart = false): AgentModule {
  return {
    capabilityId,
    async start() {
      events.push(`start:${capabilityId}`);
      if (failStart) {
        throw new Error("start failed");
      }
    },
    async stop() {
      events.push(`stop:${capabilityId}`);
    },
    getCapability() {
      return { id: capabilityId, version: 1, actions: [], availability: "available" };
    },
    getStatus() {
      return { capabilityId, availability: "available" };
    },
    async execute(_command: CommandEnvelope) {
      return null;
    }
  };
}

describe("ModuleHost", () => {
  it("rolls successfully started modules back in reverse order", async () => {
    const events: string[] = [];
    const host = new ModuleHost([
      moduleFixture("one", events),
      moduleFixture("two", events),
      moduleFixture("three", events, true)
    ]);

    await expect(host.start(new AbortController().signal)).rejects.toThrow("start failed");
    expect(events).toEqual([
      "start:one",
      "start:two",
      "start:three",
      "stop:two",
      "stop:one"
    ]);
  });
});
