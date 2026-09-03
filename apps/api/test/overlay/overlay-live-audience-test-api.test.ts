import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OverlayRuntime,
  registerOverlayRoutes
} from "../../src/overlay/index.js";
import { registerOverlayTestRoutes } from "../../src/overlay/overlay-test.route.js";
import { StreamerChatRuntime } from "../../src/streamer-chat/index.js";

const servers: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

const createServer = ({ tokenValid = true }: { tokenValid?: boolean } = {}) => {
  const server = Fastify();
  const broadcastMessage = vi.fn();
  const recordFakeLocalStreamerChatMessage = vi.fn((event: {
    payload: Record<string, unknown>;
  }) => ({ ...event.payload, visibleOnOverlayByDefault: true }));

  registerOverlayTestRoutes(server, {
    fakeLocalModerationRuntime: {
      isAuthorMuted: () => null
    },
    overlayRuntime: {
      broadcastMessage,
      getActiveConnectionCount: () => 3
    },
    recordFakeLocalStreamerChatMessage,
    requireStreamerChatModerationPermission: async () => ({ ok: true }),
    requireUrlAccessTokenForRequest: async () => tokenValid
      ? {
        ok: true,
        requiresLogin: true,
        session: { user: { id: "auth-owner" }, session: { userId: "auth-owner" } },
        user: {
          id: "owner-user",
          displayName: "Owner",
          profileVisibility: "private",
          avatarUrl: null
        }
      }
      : { ok: false, statusCode: 403, reason: "invalid_token" },
    validateUrlAccessToken: async () => tokenValid
      ? { valid: true, requiresLogin: true }
      : { valid: false, requiresLogin: true, reason: "invalid_token" }
  } as unknown as Parameters<typeof registerOverlayTestRoutes>[1]);
  servers.push(server);

  return { broadcastMessage, recordFakeLocalStreamerChatMessage, server };
};

describe("POST /overlay/live-audience/test", () => {
  it("emits one matching chat message and one exact top-bar event", async () => {
    const { broadcastMessage, recordFakeLocalStreamerChatMessage, server } = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/overlay/live-audience/test",
      payload: {
        accessToken: "a".repeat(24),
        actorName: "CyneViewer",
        actionLabel: "followed the safehouse signal",
        avatarUrl: "https://static-cdn.jtvnw.net/example.png",
        kind: "follow",
        message: "Real public Twitch chat text.",
        parts: [
          { type: "text", text: "Real public Twitch chat " },
          {
            type: "emote",
            id: "25",
            name: "Kappa",
            imageUrl: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0"
          }
        ],
        platform: "twitch",
        priority: "normal"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, queued: 2 });
    expect(recordFakeLocalStreamerChatMessage).toHaveBeenCalledTimes(1);
    expect(broadcastMessage).toHaveBeenCalledTimes(2);
    expect(broadcastMessage.mock.calls[0]?.[0]).toMatchObject({
      type: "overlay.fake-chat.message.received",
      payload: {
        authorName: "CyneViewer",
        avatarUrl: "https://static-cdn.jtvnw.net/example.png",
        message: "Real public Twitch chat text.",
        parts: expect.arrayContaining([
          expect.objectContaining({ type: "emote", id: "25", name: "Kappa" })
        ])
      }
    });
    expect(broadcastMessage.mock.calls[1]?.[0]).toMatchObject({
      type: "overlay.top-bar-notification.queued",
      payload: {
        actorName: "CyneViewer",
        actionLabel: "followed the safehouse signal",
        avatarUrl: "https://static-cdn.jtvnw.net/example.png",
        kind: "follow",
        platform: "twitch"
      }
    });
  });

  it("rejects an invalid control token without broadcasting", async () => {
    const { broadcastMessage, server } = createServer({ tokenValid: false });
    const response = await server.inject({
      method: "POST",
      url: "/overlay/live-audience/test",
      payload: {
        accessToken: "a".repeat(24),
        actorName: "CyneViewer",
        actionLabel: "followed",
        kind: "follow",
        message: "Hello",
        platform: "twitch",
        priority: "normal"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ ok: false, reason: "invalid_token" });
    expect(broadcastMessage).not.toHaveBeenCalled();
  });
});

describe("GET /overlay/state", () => {
  it("keeps overlay tokens token-only for OBS overlay reads", async () => {
    const server = Fastify();
    const requireUrlAccessTokenForRequest = vi.fn(async () => {
      throw new Error("control token helper should not guard overlay:connect reads");
    });
    const validateUrlAccessToken = vi.fn(async () => ({
      valid: true,
      requiresLogin: false
    }));

    registerOverlayRoutes(server, {
      fakeLocalModerationRuntime: {
        isAuthorMuted: () => null
      },
      overlayRuntime: new OverlayRuntime(),
      recordFakeLocalStreamerChatMessage: () => null,
      requireStreamerChatModerationPermission: async () => ({ ok: true }),
      requireUrlAccessTokenForRequest,
      streamerChatRuntime: new StreamerChatRuntime({ maxHistory: 10 }),
      validateUrlAccessToken
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: `/overlay/state?accessToken=${"a".repeat(24)}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      snapshot: {
        scene: "default",
        layout: "standard"
      }
    });
    expect(validateUrlAccessToken).toHaveBeenCalledWith({
      token: "a".repeat(24),
      surface: "overlay",
      scope: "overlay:connect"
    });
    expect(requireUrlAccessTokenForRequest).not.toHaveBeenCalled();
  });
});

describe("production overlay route registration", () => {
  it("omits fake and unsupported product mutation routes while retaining real overlay controls", async () => {
    const originalNodeEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const server = Fastify();
      const overlayRuntime = new OverlayRuntime();
      const streamerChatRuntime = new StreamerChatRuntime({ maxHistory: 10 });
      const setActiveGoal = vi.spyOn(overlayRuntime, "setActiveGoal");
      const setSponsorVisible = vi.spyOn(overlayRuntime, "setSponsorVisible");

      streamerChatRuntime.appendMessage({
        id: "before-emergency-clear",
        authorKind: "human",
        authorName: "Test chatter",
        createdAt: "2026-09-03T00:00:00.000Z",
        message: "This must leave the presentation buffer.",
        source: "youtube",
        visibleOnOverlayByDefault: true
      });

      registerOverlayRoutes(server, {
        fakeLocalModerationRuntime: {
          isAuthorMuted: () => null
        },
        overlayRuntime,
        recordFakeLocalStreamerChatMessage: () => null,
        requireStreamerChatModerationPermission: async () => ({ ok: true }),
        requireUrlAccessTokenForRequest: async () => ({
          ok: true,
          requiresLogin: true,
          session: { user: { id: "auth-owner" }, session: { userId: "auth-owner" } },
          user: {
            id: "owner-user",
            displayName: "Owner",
            profileVisibility: "private",
            avatarUrl: null
          }
        }),
        streamerChatRuntime,
        validateUrlAccessToken: async () => ({ valid: true, requiresLogin: false })
      });
      servers.push(server);

      for (const url of [
        "/overlay/chat/test",
        "/overlay/live-audience/test",
        "/overlay/top-bar/test",
        "/overlay/notification/test",
        "/overlay/redeem/test",
        "/overlay/goal",
        "/overlay/sponsor/visibility"
      ]) {
        const response = await server.inject({ method: "POST", url, payload: {} });
        expect(response.statusCode).toBe(404);
      }
      expect(setActiveGoal).not.toHaveBeenCalled();
      expect(setSponsorVisible).not.toHaveBeenCalled();

      const stateResponse = await server.inject({
        method: "GET",
        url: `/overlay/state?accessToken=${"a".repeat(24)}`
      });
      expect(stateResponse.statusCode).toBe(200);

      const token = "a".repeat(24);
      const retainedMutationResponses = await Promise.all([
        server.inject({
          method: "POST",
          url: "/overlay/top-bar/enabled",
          payload: { accessToken: token, enabled: false }
        }),
        server.inject({
          method: "POST",
          url: "/overlay/chat/visibility",
          payload: { accessToken: token, visible: false }
        }),
        server.inject({
          method: "POST",
          url: "/overlay/chat/order",
          payload: { accessToken: token, newestOnTop: false }
        }),
        server.inject({
          method: "POST",
          url: "/overlay/center/settings",
          payload: {
            accessToken: token,
            enabled: true,
            onscreenMs: 4_000,
            fadeOutMs: 700,
            restMs: 1_500
          }
        }),
        server.inject({
          method: "POST",
          url: "/overlay/emergency-clean-mode",
          payload: { accessToken: token, enabled: true }
        }),
        server.inject({
          method: "POST",
          url: "/overlay/presentation-state",
          payload: {
            accessToken: token,
            scene: "default",
            layout: "camera-left",
            theme: "default"
          }
        })
      ]);
      expect(retainedMutationResponses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200, 200, 200]);
      expect(streamerChatRuntime.listAllMessages()).toEqual([]);

      const scenesResponse = await server.inject({
        method: "GET",
        url: `/overlay/scenes?accessToken=${token}`
      });
      expect(scenesResponse.statusCode).toBe(200);
      expect(scenesResponse.json()).toMatchObject({ ok: true });

      const statusResponse = await server.inject({
        method: "GET",
        url: `/overlay/status?accessToken=${token}`
      });
      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json()).toMatchObject({
        ok: true,
        activeGoal: null,
        centerEnabled: true,
        chatNewestOnTop: false,
        chatVisible: false,
        emergencyCleanModeEnabled: true,
        presentationState: {
          scene: "default",
          layout: "camera-left",
          theme: "default"
        },
        sponsorVisible: true,
        topBarEnabled: false
      });
    } finally {
      if (originalNodeEnvironment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnvironment;
      }
    }
  });
});

describe("GET /overlay/status", () => {
  it("uses the request-aware control gate before returning overlay control status", async () => {
    const server = Fastify();
    const requireUrlAccessTokenForRequest = vi.fn(async () => ({
      ok: false as const,
      statusCode: 401 as const,
      reason: "not_authenticated"
    }));

    registerOverlayRoutes(server, {
      fakeLocalModerationRuntime: {
        isAuthorMuted: () => null
      },
      overlayRuntime: new OverlayRuntime(),
      recordFakeLocalStreamerChatMessage: () => null,
      requireStreamerChatModerationPermission: async () => ({ ok: true }),
      requireUrlAccessTokenForRequest,
      streamerChatRuntime: new StreamerChatRuntime({ maxHistory: 10 }),
      validateUrlAccessToken: async () => ({ valid: false, requiresLogin: false })
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: `/overlay/status?accessToken=${"a".repeat(24)}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(requireUrlAccessTokenForRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        token: "a".repeat(24),
        surface: "control-panel",
        scope: "control:open"
      })
    );
  });
});

describe("GET /overlay/scenes", () => {
  it("rejects a valid control token when no authenticated session is present", async () => {
    const server = Fastify();
    const requireUrlAccessTokenForRequest = vi.fn(async () => ({
      ok: false as const,
      statusCode: 401 as const,
      reason: "not_authenticated"
    }));
    const validateUrlAccessToken = vi.fn(async () => {
      throw new Error("overlay token helper should not guard control scene reads");
    });

    registerOverlayRoutes(server, {
      fakeLocalModerationRuntime: {
        isAuthorMuted: () => null
      },
      overlayRuntime: new OverlayRuntime(),
      recordFakeLocalStreamerChatMessage: () => null,
      requireStreamerChatModerationPermission: async () => ({ ok: true }),
      requireUrlAccessTokenForRequest,
      streamerChatRuntime: new StreamerChatRuntime({ maxHistory: 10 }),
      validateUrlAccessToken
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: `/overlay/scenes?accessToken=${"a".repeat(24)}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(requireUrlAccessTokenForRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        token: "a".repeat(24),
        surface: "control-panel",
        scope: "control:open"
      })
    );
    expect(validateUrlAccessToken).not.toHaveBeenCalled();
  });
});
