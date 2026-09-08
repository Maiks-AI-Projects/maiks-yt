import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerAccountDomainRoutes } from "../../src/account/account-domain.route.js";

describe("account session route", () => {
  it("marks session responses private and no-store", async () => {
    const server = Fastify();

    registerAccountDomainRoutes(server, {
      configuredAuthProviderIds: [],
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used by /account/session");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/session"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toBe("null");
  });
});
