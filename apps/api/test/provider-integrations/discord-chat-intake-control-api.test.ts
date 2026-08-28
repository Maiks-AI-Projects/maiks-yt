import type { DiscordChatIntakeStatus } from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerDiscordChatIntakeControlRoutes } from "../../src/provider-integrations/discord-chat-intake-control.route.js";
import { DiscordChatIntakeControlService } from "../../src/provider-integrations/discord-chat-intake-control.service.js";
import type {
  DiscordChatIntakeControlActor,
  DiscordChatIntakeControlRepository,
  DiscordChatIntakeRuntime
} from "../../src/provider-integrations/discord-chat-intake-control.types.js";

class FakeDiscordChatRepository implements DiscordChatIntakeControlRepository {
  public actor: DiscordChatIntakeControlActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<DiscordChatIntakeControlActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

class FakeDiscordChatRuntime implements DiscordChatIntakeRuntime {
  public startCalls = 0;
  public stopCalls = 0;
  private status: DiscordChatIntakeStatus = {
    channelIds: ["discord-channel-id"],
    connectedAt: null,
    disconnectsInWindow: 0,
    guildId: "guild-1",
    lastError: null,
    lastDisconnectAt: null,
    lastMessageAt: null,
    nextReconnectAt: null,
    recentMessages: [],
    reconnectSuppressed: false,
    state: "stopped"
  };

  public getStatus(): DiscordChatIntakeStatus {
    return structuredClone(this.status);
  }

  public start(): DiscordChatIntakeStatus {
    this.startCalls += 1;
    this.status = {
      ...this.status,
      connectedAt: "2026-07-02T14:00:00.000Z",
      disconnectsInWindow: 2,
      lastError: "raw discord provider error",
      lastMessageAt: "2026-07-02T14:00:01.000Z",
      recentMessages: [{
        authorKind: "human",
        authorName: "Private Discord User",
        channelId: "discord-channel-id",
        channelName: "private-channel-name",
        createdAt: "2026-07-02T14:00:01.000Z",
        guildId: "guild-1",
        id: "internal-discord-message-id",
        message: "private discord message body",
        providerMessageId: "provider-discord-message-id",
        source: "discord",
        userId: "discord-user-id",
        visibleOnOverlayByDefault: false
      }],
      state: "connected"
    };
    return this.getStatus();
  }

  public stop(): DiscordChatIntakeStatus {
    this.stopCalls += 1;
    this.status = {
      ...this.status,
      connectedAt: null,
      state: "stopped"
    };
    return this.getStatus();
  }
}

describe("DiscordChatIntakeControlService", () => {
  it("allows owner wildcard to read, start, and stop read-only chat intake", async () => {
    const runtime = new FakeDiscordChatRuntime();
    const service = new DiscordChatIntakeControlService(new FakeDiscordChatRepository(), runtime);

    await expect(service.getStatus({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "stopped"
      }
    });
    await expect(service.start({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      status: {
        state: "connected"
      }
    });
    await expect(service.stop({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      status: {
        state: "stopped"
      }
    });
  });

  it("denies unlinked and non-provider-management users", async () => {
    const repository = new FakeDiscordChatRepository();
    const runtime = new FakeDiscordChatRuntime();
    const service = new DiscordChatIntakeControlService(repository, runtime);

    repository.actor = null;
    await expect(service.getStatus({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "discord_chat_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.start({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "discord_chat_forbidden"
    });
  });
});

describe("Discord chat intake control routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerDiscordChatIntakeControlRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime: new FakeDiscordChatRuntime()
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/discord-chat"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("starts and stops through authenticated owner routes", async () => {
    const server = Fastify();
    const runtime = new FakeDiscordChatRuntime();
    const service = new DiscordChatIntakeControlService(new FakeDiscordChatRepository(), runtime);

    registerDiscordChatIntakeControlRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime,
      createService: () => service
    });

    const startResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/discord-chat/start"
    });
    const secondStartResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/discord-chat/start"
    });
    const stopResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/discord-chat/stop"
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.json()).toMatchObject({
      ok: true,
      status: {
        state: "connected"
      }
    });
    expect(startResponse.body).not.toContain("guild-1");
    expect(startResponse.body).not.toContain("discord-channel-id");
    expect(startResponse.body).not.toContain("discord-user-id");
    expect(startResponse.body).not.toContain("provider-discord-message-id");
    expect(startResponse.body).not.toContain("private discord message body");
    expect(startResponse.body).not.toContain("raw discord provider error");
    expect(startResponse.body).not.toContain("channelIds");
    expect(startResponse.body).not.toContain("lastError");
    expect(startResponse.body).not.toContain("disconnectsInWindow");
    expect(startResponse.body).not.toContain("reconnectSuppressed");
    expect(startResponse.body).not.toContain("recentMessages");
    expect(secondStartResponse.statusCode).toBe(200);
    expect(secondStartResponse.json()).toMatchObject({
      ok: true,
      status: {
        state: "connected"
      }
    });
    expect(stopResponse.statusCode).toBe(200);
    expect(stopResponse.json()).toMatchObject({
      ok: true,
      status: {
        state: "stopped"
      }
    });
    expect(runtime.startCalls).toBe(2);
    expect(runtime.stopCalls).toBe(1);
  });

  it("returns safe errors without leaking thrown values", async () => {
    const server = Fastify();
    const service = {
      getStatus: vi.fn(async () => {
        throw new Error("secret-discord-token-value exploded");
      }),
      start: vi.fn(),
      stop: vi.fn()
    };

    registerDiscordChatIntakeControlRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime: new FakeDiscordChatRuntime(),
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/discord-chat"
    });
    const serialized = response.body;

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "discord_chat_unavailable"
    });
    expect(serialized).not.toContain("secret-discord-token-value");
  });
});
