import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerProviderIntegrationStatusRoutes } from "../../src/provider-integrations/provider-integration-status.route.js";
import { ProviderIntegrationStatusService } from "../../src/provider-integrations/provider-integration-status.service.js";
import type {
  ProviderIntegrationStatusActor,
  ProviderIntegrationStatusRepository
} from "../../src/provider-integrations/provider-integration-status.types.js";

class FakeProviderIntegrationStatusRepository implements ProviderIntegrationStatusRepository {
  public actor: ProviderIntegrationStatusActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<ProviderIntegrationStatusActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

describe("ProviderIntegrationStatusService", () => {
  it("returns sanitized configured and missing provider status for owner wildcard", async () => {
    const service = new ProviderIntegrationStatusService(
      new FakeProviderIntegrationStatusRepository(),
      {
        env: {
          TWITCH_CLIENT_ID: "twitch-client",
          TWITCH_CLIENT_SECRET: "secret-twitch-value",
          YOUTUBE_API_KEY: "secret-youtube-value",
          DISCORD_BOT_TOKEN: "secret-discord-value"
        },
        now: () => new Date("2026-06-29T12:00:00.000Z")
      }
    );

    const result = await service.getStatus({ authUserId: "auth-owner" });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      readOnly: true,
      generatedAt: "2026-06-29T12:00:00.000Z",
      providers: [
        {
          id: "twitch",
          state: "configured"
        },
        {
          id: "youtube",
          state: "configured"
        },
        {
          id: "discord",
          state: "configured"
        }
      ]
    });
    expect(serialized).not.toContain("secret-twitch-value");
    expect(serialized).not.toContain("secret-youtube-value");
    expect(serialized).not.toContain("secret-discord-value");
    expect(serialized).toContain("TWITCH_CLIENT_SECRET");
    expect(serialized).toContain("DISCORD_BOT_TOKEN");
  });

  it("reports missing env vars safely instead of crashing", async () => {
    const service = new ProviderIntegrationStatusService(
      new FakeProviderIntegrationStatusRepository(),
      {
        env: {},
        now: () => new Date("2026-06-29T12:00:00.000Z")
      }
    );

    const result = await service.getStatus({ authUserId: "auth-owner" });

    expect(result).toMatchObject({
      ok: true,
      providers: [
        {
          id: "twitch",
          state: "missing",
          issues: ["TWITCH_CLIENT_ID is missing.", "TWITCH_CLIENT_SECRET is missing."]
        },
        {
          id: "youtube",
          state: "missing",
          issues: []
        },
        {
          id: "discord",
          state: "missing",
          issues: ["DISCORD_BOT_TOKEN is missing."]
        }
      ]
    });
  });

  it("denies unlinked and non-owner users", async () => {
    const repository = new FakeProviderIntegrationStatusRepository();
    const service = new ProviderIntegrationStatusService(repository);

    repository.actor = null;
    await expect(service.getStatus({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "provider_integrations_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [JSON.stringify(["moderators:manage"])]
    };
    await expect(service.getStatus({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "provider_integrations_forbidden"
    });
  });
});

describe("Provider integration status routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerProviderIntegrationStatusRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ProviderIntegrationStatusService(new FakeProviderIntegrationStatusRepository())
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/status"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns 403 for authenticated users without owner wildcard", async () => {
    const server = Fastify();
    const repository = new FakeProviderIntegrationStatusRepository();
    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["notifications:manage"]]
    };

    registerProviderIntegrationStatusRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-helper" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ProviderIntegrationStatusService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/status"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_integrations_forbidden"
    });
  });

  it("returns sanitized provider status for authenticated owner access", async () => {
    const server = Fastify();

    registerProviderIntegrationStatusRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ProviderIntegrationStatusService(
        new FakeProviderIntegrationStatusRepository(),
        {
          env: {
            TWITCH_CLIENT_ID: "twitch-client",
            TWITCH_CLIENT_SECRET: "secret-twitch-value",
            DISCORD_BOT_TOKEN: "secret-discord-value"
          },
          now: () => new Date("2026-06-29T12:00:00.000Z")
        }
      )
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/status"
    });
    const body = response.json();
    const serialized = JSON.stringify(body);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      readOnly: true,
      providers: [
        {
          id: "twitch",
          state: "configured"
        },
        {
          id: "youtube",
          state: "missing"
        },
        {
          id: "discord",
          state: "configured"
        }
      ]
    });
    expect(serialized).not.toContain("secret-twitch-value");
    expect(serialized).not.toContain("secret-discord-value");
  });

  it("includes sanitized Twitch chat runtime state when provided", async () => {
    const server = Fastify();

    registerProviderIntegrationStatusRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      getRuntimeState: () => ({
        twitchChatIntakeState: "connected"
      }),
      createService: () => new ProviderIntegrationStatusService(
        new FakeProviderIntegrationStatusRepository(),
        {
          env: {
            TWITCH_CLIENT_ID: "twitch-client",
            TWITCH_CLIENT_SECRET: "secret-twitch-value"
          },
          now: () => new Date("2026-06-29T12:00:00.000Z"),
          runtimeState: () => ({
            twitchChatIntakeState: "connected"
          })
        }
      )
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/status"
    });
    const body = response.json();
    const twitch = body.providers.find((provider: { id: string }) => provider.id === "twitch");

    expect(response.statusCode).toBe(200);
    expect(twitch.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "twitch-chat-runtime",
        state: "configured"
      })
    ]));
  });
});
