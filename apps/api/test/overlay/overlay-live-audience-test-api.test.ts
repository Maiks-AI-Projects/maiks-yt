import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerOverlayTestRoutes } from "../../src/overlay/overlay-test.route.js";

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
