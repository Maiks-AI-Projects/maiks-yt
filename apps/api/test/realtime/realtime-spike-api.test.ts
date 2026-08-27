import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { registerRealtimeSpikeRoutes } from "../../src/realtime/realtime-spike.route.js";

const originalNodeEnvironment = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnvironment === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnvironment;
  }
});

describe("realtime spike route registration", () => {
  it("omits the experimental routes in production", async () => {
    process.env.NODE_ENV = "production";
    const server = Fastify();

    registerRealtimeSpikeRoutes(server);

    expect(server.hasRoute({ method: "POST", url: "/events/test" })).toBe(false);
    expect(server.hasRoute({ method: "GET", url: "/realtime/spike/sse" })).toBe(false);
    expect(server.hasRoute({ method: "GET", url: "/realtime/spike/ws" })).toBe(false);

    const response = await server.inject({ method: "POST", url: "/events/test", payload: {} });
    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("retains the experimental routes outside production", async () => {
    process.env.NODE_ENV = "test";
    const server = Fastify();

    registerRealtimeSpikeRoutes(server);

    expect(server.hasRoute({ method: "POST", url: "/events/test" })).toBe(true);
    expect(server.hasRoute({ method: "GET", url: "/realtime/spike/sse" })).toBe(true);
    expect(server.hasRoute({ method: "GET", url: "/realtime/spike/ws" })).toBe(true);

    const response = await server.inject({
      method: "POST",
      url: "/events/test",
      payload: { type: "test.event", payload: {} }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accepted: true, eventType: "test.event" });

    await server.close();
  });
});
