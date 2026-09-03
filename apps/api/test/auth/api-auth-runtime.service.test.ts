import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { createApiAuthRuntime } from "../../src/api-auth-runtime.service.js";

vi.mock("../../src/auth/better-auth.service.js", () => ({
  auth: {
    handler: vi.fn()
  }
}));

const request = {
  headers: {
    host: "api.example.test",
    "x-forwarded-proto": "https"
  }
} as FastifyRequest;

describe("API auth runtime session classification", () => {
  it("propagates an unavailable Better Auth lookup instead of projecting signed-out", async () => {
    const runtime = createApiAuthRuntime({
      getDatabasePool: () => {
        throw new Error("database fallback must not run");
      },
      handleAuthRequest: vi.fn(async () => new Response("Service unavailable", { status: 503 }))
    });

    await expect(runtime.getAuthSession(request)).rejects.toThrow(
      "Auth session lookup failed with 503."
    );
  });

  it("keeps a successful null Better Auth response as signed-out", async () => {
    const runtime = createApiAuthRuntime({
      getDatabasePool: () => ({}) as DatabasePool,
      handleAuthRequest: vi.fn(async () => new Response("null", {
        headers: { "Content-Type": "application/json" },
        status: 200
      }))
    });

    await expect(runtime.getAuthSession(request)).resolves.toBeNull();
  });
});
