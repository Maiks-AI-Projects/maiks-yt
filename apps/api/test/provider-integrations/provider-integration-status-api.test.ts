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

const forbiddenMarkers = [
  "sdk",
  "readOnly",
  "env",
  "issues",
  "boundaries",
  "lastError",
  "reconnectCount",
  "disconnectsInWindow",
  "reconnectSuppressed",
  "autoStartEnabled",
  "TWITCH_CLIENT_SECRET",
  "YOUTUBE_API_KEY",
  "DISCORD_BOT_TOKEN",
  "secret-twitch-value",
  "secret-youtube-value",
  "secret-discord-value",
  "@twurple",
  "discord.js",
  "googleapis"
] as const;

describe("ProviderIntegrationStatusService", () => {
  it("returns the allowlisted owner operator status for owner wildcard", async () => {
    const service = new ProviderIntegrationStatusService(
      new FakeProviderIntegrationStatusRepository(),
      {
        env: {
          TWITCH_CLIENT_ID: "twitch-client",
          TWITCH_CLIENT_SECRET: "secret-twitch-value",
          YOUTUBE_API_KEY: "secret-youtube-value",
          DISCORD_BOT_TOKEN: "secret-discord-value"
        },
        now: () => new Date("2026-06-29T12:00:00.000Z"),
        runtimeState: () => ({
          twitchChatIntakeState: "connected",
          youtubeLiveChatIntakeState: "waiting",
          discordChatIntakeState: "stopped"
        })
      }
    );

    const result = await service.getStatus({ authUserId: "auth-owner" });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: true,
      generatedAt: "2026-06-29T12:00:00.000Z",
      providers: [
        {
          id: "twitch",
          label: "Twitch",
          readiness: "ready",
          capabilities: [
            { key: "twitch_api_access", label: "Twitch API access", state: "available" },
            { key: "twitch_chat_intake", label: "Twitch chat intake", state: "available" },
            { key: "twitch_eventsub_intake", label: "Twitch event intake", state: "needs_setup" }
          ],
          runtime: {
            state: "connected",
            accountSummary: null,
            connectedAt: null,
            lastActivityAt: null,
            nextRetryAt: null
          },
          guidance: null
        },
        {
          id: "youtube",
          label: "YouTube",
          readiness: "ready",
          capabilities: [
            { key: "youtube_data_access", label: "YouTube data access", state: "available" },
            { key: "youtube_owner_consent", label: "YouTube owner consent", state: "needs_setup" },
            { key: "youtube_live_chat_intake", label: "YouTube live chat intake", state: "available" }
          ],
          runtime: {
            state: "waiting",
            accountSummary: null,
            connectedAt: null,
            lastActivityAt: null,
            nextRetryAt: null
          },
          guidance: null
        },
        {
          id: "discord",
          label: "Discord",
          readiness: "ready",
          capabilities: [
            { key: "discord_bot_access", label: "Discord bot access", state: "available" },
            { key: "discord_guild_target", label: "Discord guild target", state: "needs_setup" },
            { key: "discord_webhook_intake", label: "Discord webhook intake", state: "needs_setup" },
            { key: "discord_chat_intake", label: "Discord chat intake", state: "available" }
          ],
          runtime: {
            state: "stopped",
            accountSummary: null,
            connectedAt: null,
            lastActivityAt: null,
            nextRetryAt: null
          },
          guidance: "Start intake when this provider should capture live activity."
        }
      ]
    });
    for (const marker of forbiddenMarkers) {
      expect(serialized).not.toContain(marker);
    }
  });

  it("reports missing setup without environment variable names", async () => {
    const service = new ProviderIntegrationStatusService(
      new FakeProviderIntegrationStatusRepository(),
      {
        env: {},
        now: () => new Date("2026-06-29T12:00:00.000Z")
      }
    );

    const result = await service.getStatus({ authUserId: "auth-owner" });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      providers: [
        {
          id: "twitch",
          readiness: "needs_setup",
          guidance: "Finish Twitch setup before starting chat or event intake."
        },
        {
          id: "youtube",
          readiness: "needs_setup",
          guidance: "Finish YouTube owner-consent setup before starting live-chat polling."
        },
        {
          id: "discord",
          readiness: "needs_setup",
          guidance: "Finish Discord bot and guild setup before starting intake."
        }
      ]
    });
    expect(serialized).not.toContain("TWITCH_CLIENT_ID");
    expect(serialized).not.toContain("TWITCH_CLIENT_SECRET");
    expect(serialized).not.toContain("DISCORD_BOT_TOKEN");
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

  it("returns the finite unavailable reason when authentication fails", async () => {
    const server = Fastify();

    registerProviderIntegrationStatusRoutes(server, {
      getAuthSession: async () => {
        throw new Error("auth unavailable");
      },
      getDatabasePool: () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/status"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_integrations_unavailable"
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

  it("returns the finite unavailable reason when status lookup fails", async () => {
    const server = Fastify();

    registerProviderIntegrationStatusRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        getStatus: async () => {
          throw new Error("status unavailable");
        }
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/status"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_integrations_unavailable"
    });
  });

  it("returns sanitized runtime status for authenticated owner access", async () => {
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
            DISCORD_BOT_TOKEN: "secret-discord-value",
            DISCORD_GUILD_ID: "987654321098765432",
            TWITCH_CLIENT_ID: "twitch-client",
            TWITCH_CLIENT_SECRET: "secret-twitch-value",
            YOUTUBE_CLIENT_ID: "youtube-client",
            YOUTUBE_CLIENT_SECRET: "secret-youtube-value"
          },
          now: () => new Date("2026-06-29T12:00:00.000Z"),
          runtimeState: () => ({
            discordChatIntake: {
              channelIds: ["123456789012345678"],
              connectedAt: null,
              disconnectsInWindow: 10,
              guildId: "987654321098765432",
              lastDisconnectAt: "2026-06-29T11:59:00.000Z",
              lastError: "Authorization: Bearer secret-discord-value failed for guildId=987654321098765432 payload={raw}",
              lastMessageAt: "2026-06-29T11:58:00.000Z",
              nextReconnectAt: null,
              recentMessages: [],
              reconnectSuppressed: true,
              state: "stopped"
            },
            twitchChatIntake: {
              channelName: "maiksmc",
              channelNames: ["maiksmc"],
              connectedAt: "2026-06-29T11:00:00.000Z",
              disconnectsInWindow: 0,
              lastDisconnectAt: null,
              lastError: null,
              lastMessageAt: "2026-06-29T11:55:00.000Z",
              nextReconnectAt: null,
              recentMessages: [],
              reconnectSuppressed: false,
              state: "connected"
            },
            youtubeLiveChatIntake: {
              activeLiveChatId: null,
              channelId: "UC1234567890123456789012",
              channelName: "MaiksMC",
              connectedAt: null,
              lastError: null,
              lastMessageAt: null,
              nextPollAt: "2026-06-29T12:01:00.000Z",
              recentMessages: [],
              state: "waiting"
            }
          })
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
      providers: [
        {
          id: "twitch",
          readiness: "ready",
          runtime: {
            state: "connected",
            accountSummary: "maiksmc",
            lastActivityAt: "2026-06-29T11:55:00.000Z"
          }
        },
        {
          id: "youtube",
          readiness: "ready",
          runtime: {
            state: "waiting",
            accountSummary: "MaiksMC",
            nextRetryAt: null
          }
        },
        {
          id: "discord",
          readiness: "ready",
          runtime: {
            state: "stopped",
            accountSummary: "1 configured channels",
            lastActivityAt: "2026-06-29T11:58:00.000Z"
          }
        }
      ]
    });
    for (const marker of forbiddenMarkers) {
      expect(serialized).not.toContain(marker);
    }
    expect(serialized).not.toContain("987654321098765432");
    expect(serialized).not.toContain("123456789012345678");
    expect(serialized).not.toContain("UC1234567890123456789012");
    expect(serialized).not.toContain("payload={raw}");
  });
});
