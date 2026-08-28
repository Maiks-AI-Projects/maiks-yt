import type { TwitchChatIntakeStatus } from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerTwitchChatIntakeControlRoutes } from "../../src/provider-integrations/twitch-chat-intake-control.route.js";
import { TwitchChatIntakeControlService } from "../../src/provider-integrations/twitch-chat-intake-control.service.js";
import type {
  TwitchChatIntakeControlActor,
  TwitchChatIntakeControlRepository,
  TwitchChatIntakeRuntime
} from "../../src/provider-integrations/twitch-chat-intake-control.types.js";

class FakeTwitchChatRepository implements TwitchChatIntakeControlRepository {
  public actor: TwitchChatIntakeControlActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<TwitchChatIntakeControlActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

class FakeTwitchChatRuntime implements TwitchChatIntakeRuntime {
  public startCalls = 0;
  public stopCalls = 0;
  private status: TwitchChatIntakeStatus = {
    channelName: "maiksmc",
    channelNames: ["maiksmc"],
    connectedAt: null,
    disconnectsInWindow: 3,
    lastError: null,
    lastDisconnectAt: "2026-06-29T13:59:00.000Z",
    lastMessageAt: null,
    nextReconnectAt: "2026-06-29T14:01:00.000Z",
    recentMessages: [],
    reconnectSuppressed: false,
    state: "stopped"
  };

  public getStatus(): TwitchChatIntakeStatus {
    return structuredClone(this.status);
  }

  public start(): TwitchChatIntakeStatus {
    this.startCalls += 1;
    this.status = {
      ...this.status,
      connectedAt: "2026-06-29T14:00:00.000Z",
      lastError: "raw twitch provider error",
      lastMessageAt: "2026-06-29T14:00:01.000Z",
      recentMessages: [{
        authorKind: "human",
        authorName: "Private Twitch User",
        channelName: "maiksmc",
        createdAt: "2026-06-29T14:00:01.000Z",
        id: "internal-message-id",
        message: "private twitch message body",
        providerMessageId: "provider-message-id",
        source: "twitch",
        userId: "twitch-user-id",
        userName: "private_login",
        visibleOnOverlayByDefault: false
      }],
      state: "connected"
    };
    return this.getStatus();
  }

  public stop(): TwitchChatIntakeStatus {
    this.stopCalls += 1;
    this.status = {
      ...this.status,
      connectedAt: null,
      state: "stopped"
    };
    return this.getStatus();
  }
}

describe("TwitchChatIntakeControlService", () => {
  it("allows owner wildcard to read, start, and stop read-only chat intake", async () => {
    const runtime = new FakeTwitchChatRuntime();
    const service = new TwitchChatIntakeControlService(new FakeTwitchChatRepository(), runtime);

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
    const repository = new FakeTwitchChatRepository();
    const runtime = new FakeTwitchChatRuntime();
    const service = new TwitchChatIntakeControlService(repository, runtime);

    repository.actor = null;
    await expect(service.getStatus({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "twitch_chat_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.start({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "twitch_chat_forbidden"
    });
  });
});

describe("Twitch chat intake control routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerTwitchChatIntakeControlRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime: new FakeTwitchChatRuntime()
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/twitch-chat"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("starts and stops through authenticated owner routes", async () => {
    const server = Fastify();
    const runtime = new FakeTwitchChatRuntime();
    const service = new TwitchChatIntakeControlService(new FakeTwitchChatRepository(), runtime);

    registerTwitchChatIntakeControlRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime,
      createService: () => service
    });

    const startResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/twitch-chat/start"
    });
    const secondStartResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/twitch-chat/start"
    });
    const stopResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/twitch-chat/stop"
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.json()).toMatchObject({
      ok: true,
      status: {
        state: "connected"
      }
    });
    expect(startResponse.body).not.toContain("maiksmc");
    expect(startResponse.body).not.toContain("private twitch message body");
    expect(startResponse.body).not.toContain("provider-message-id");
    expect(startResponse.body).not.toContain("twitch-user-id");
    expect(startResponse.body).not.toContain("raw twitch provider error");
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
        throw new Error("secret-twitch-token-value exploded");
      }),
      start: vi.fn(),
      stop: vi.fn()
    };

    registerTwitchChatIntakeControlRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime: new FakeTwitchChatRuntime(),
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/twitch-chat"
    });
    const serialized = response.body;

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "twitch_chat_unavailable"
    });
    expect(serialized).not.toContain("secret-twitch-token-value");
  });
});
