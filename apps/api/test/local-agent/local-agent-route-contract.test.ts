import { LOCAL_AGENT_LIVE_PATH } from "@maiks-yt/events";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerLocalAgentRoutes } from "../../src/local-agent/local-agent.route.js";
import { LocalAgentRuntimeService } from "../../src/local-agent/local-agent-runtime.service.js";

describe("Local Agent route contract", () => {
  it("registers /local-agent/live as the only production WebSocket path", async () => {
    const server = Fastify({ logger: false });
    registerLocalAgentRoutes(server, {
      config: {
        configured: true,
        expectedAgentId: "maiks-audio-agent",
        expectedDeviceId: "device-1",
        token: "x".repeat(32)
      },
      runtime: new LocalAgentRuntimeService()
    });
    await server.ready();

    expect(server.hasRoute({ method: "GET", url: LOCAL_AGENT_LIVE_PATH })).toBe(true);
    expect(server.hasRoute({ method: "GET", url: "/local-agent/connect" })).toBe(false);
    await server.close();
  });

  it("rejects wrong-path registration attempts without mutating runtime state", async () => {
    const runtime = new LocalAgentRuntimeService();
    const server = Fastify({ logger: false });
    registerLocalAgentRoutes(server, {
      config: {
        configured: true,
        expectedAgentId: "maiks-audio-agent",
        expectedDeviceId: "device-1",
        token: "x".repeat(32)
      },
      runtime
    });

    const response = await server.inject({
      method: "GET",
      url: "/local-agent/connect"
    });

    expect(response.statusCode).toBe(404);
    expect(runtime.getStatus()).toMatchObject({
      connected: false,
      pendingCommands: 0
    });
    await server.close();
  });
});
