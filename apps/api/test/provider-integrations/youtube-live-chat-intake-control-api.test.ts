import type { YouTubeLiveChatIntakeStatus } from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerYouTubeLiveChatIntakeControlRoutes } from "../../src/provider-integrations/youtube-live-chat-intake-control.route.js";
import { YouTubeLiveChatIntakeControlService } from "../../src/provider-integrations/youtube-live-chat-intake-control.service.js";
import type {
  YouTubeLiveChatIntakeControlActor,
  YouTubeLiveChatIntakeControlRepository,
  YouTubeLiveChatIntakeRuntime
} from "../../src/provider-integrations/youtube-live-chat-intake-control.types.js";

class FakeYouTubeLiveChatRepository implements YouTubeLiveChatIntakeControlRepository {
  public actor: YouTubeLiveChatIntakeControlActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<YouTubeLiveChatIntakeControlActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

class FakeYouTubeLiveChatRuntime implements YouTubeLiveChatIntakeRuntime {
  public startCalls = 0;
  public stopCalls = 0;
  private status: YouTubeLiveChatIntakeStatus = {
    activeLiveChatId: null,
    channelId: "UCG9tjGfhqaVpDpo8QDvPorA",
    channelName: "MaiksMC",
    connectedAt: null,
    lastError: null,
    lastMessageAt: null,
    nextPollAt: null,
    recentMessages: [],
    state: "stopped"
  };

  public getStatus(): YouTubeLiveChatIntakeStatus {
    return structuredClone(this.status);
  }

  public start(): YouTubeLiveChatIntakeStatus {
    this.startCalls += 1;
    this.status = {
      ...this.status,
      activeLiveChatId: "live-chat-1",
      connectedAt: "2026-07-04T14:00:00.000Z",
      lastError: "raw youtube provider error",
      lastMessageAt: "2026-07-04T14:00:01.000Z",
      recentMessages: [{
        authorChannelId: "youtube-author-channel-id",
        authorKind: "human",
        authorName: "Private YouTube User",
        channelName: "MaiksMC",
        createdAt: "2026-07-04T14:00:01.000Z",
        id: "internal-youtube-message-id",
        message: "private youtube message body",
        providerMessageId: "provider-youtube-message-id",
        source: "youtube",
        visibleOnOverlayByDefault: false
      }],
      state: "connected"
    };
    return this.getStatus();
  }

  public stop(): YouTubeLiveChatIntakeStatus {
    this.stopCalls += 1;
    this.status = {
      ...this.status,
      activeLiveChatId: null,
      connectedAt: null,
      state: "stopped"
    };
    return this.getStatus();
  }
}

describe("YouTubeLiveChatIntakeControlService", () => {
  it("allows owner wildcard to read, start, and stop read-only live chat intake", async () => {
    const runtime = new FakeYouTubeLiveChatRuntime();
    const service = new YouTubeLiveChatIntakeControlService(new FakeYouTubeLiveChatRepository(), runtime);

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
    const repository = new FakeYouTubeLiveChatRepository();
    const runtime = new FakeYouTubeLiveChatRuntime();
    const service = new YouTubeLiveChatIntakeControlService(repository, runtime);

    repository.actor = null;
    await expect(service.getStatus({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "youtube_live_chat_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.start({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "youtube_live_chat_forbidden"
    });
  });
});

describe("YouTube live chat intake control routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerYouTubeLiveChatIntakeControlRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime: new FakeYouTubeLiveChatRuntime()
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube-live-chat"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("starts and stops through authenticated owner routes", async () => {
    const server = Fastify();
    const runtime = new FakeYouTubeLiveChatRuntime();
    const service = new YouTubeLiveChatIntakeControlService(new FakeYouTubeLiveChatRepository(), runtime);

    registerYouTubeLiveChatIntakeControlRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime,
      createService: () => service
    });

    const startResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-live-chat/start"
    });
    const secondStartResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-live-chat/start"
    });
    const stopResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-live-chat/stop"
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.json()).toMatchObject({
      ok: true,
      status: {
        state: "connected"
      }
    });
    expect(startResponse.body).not.toContain("UCG9tjGfhqaVpDpo8QDvPorA");
    expect(startResponse.body).not.toContain("live-chat-1");
    expect(startResponse.body).not.toContain("activeLiveChatId");
    expect(startResponse.body).not.toContain("youtube-author-channel-id");
    expect(startResponse.body).not.toContain("provider-youtube-message-id");
    expect(startResponse.body).not.toContain("private youtube message body");
    expect(startResponse.body).not.toContain("raw youtube provider error");
    expect(startResponse.body).not.toContain("channelId");
    expect(startResponse.body).not.toContain("lastError");
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
        throw new Error("secret-youtube-refresh-token-value exploded");
      }),
      start: vi.fn(),
      stop: vi.fn()
    };

    registerYouTubeLiveChatIntakeControlRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      runtime: new FakeYouTubeLiveChatRuntime(),
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube-live-chat"
    });
    const serialized = response.body;

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_live_chat_unavailable"
    });
    expect(serialized).not.toContain("secret-youtube-refresh-token-value");
  });
});
