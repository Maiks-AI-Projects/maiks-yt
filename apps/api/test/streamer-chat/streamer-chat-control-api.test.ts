import fastifyWebsocket from "@fastify/websocket";
import type { StreamerChatMessage } from "@maiks-yt/events";
import Fastify from "fastify";
import WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerStreamerChatControlRoutes,
  StreamerChatRuntime
} from "../../src/streamer-chat/index.js";
import type { RequireUrlAccessTokenForRequest } from "../../src/url-access-token-request-access.service.js";

const validAccessToken = "test-control-access-token-123456";

const createMessage = (): StreamerChatMessage => ({
  id: "message-1",
  authorKind: "human",
  authorName: "Viewer",
  createdAt: "2026-08-27T00:00:00.000Z",
  message: "Hello from chat.",
  source: "twitch",
  visibleOnOverlayByDefault: false
});

const createTwitchStatusRuntime = () => ({
  getStatus: vi.fn(() => ({
    channelName: "maiksmc",
    channelNames: ["maiksmc", "maiksplays"],
    connectedAt: null,
    disconnectsInWindow: 4,
    lastDisconnectAt: "2026-08-27T00:01:00.000Z",
    lastError: "Authorization: Bearer secret-twitch-value failed for broadcasterId=987654321 payload={raw}",
    lastMessageAt: "2026-08-27T00:02:00.000Z",
    nextReconnectAt: "2026-08-27T00:03:00.000Z",
    recentMessages: [{
      id: "twitch-recent-1",
      authorKind: "human",
      authorName: "Recent Twitch Viewer",
      channelName: "maiksmc",
      createdAt: "2026-08-27T00:02:00.000Z",
      message: "raw recent twitch message",
      providerMessageId: "provider-twitch-message-1",
      source: "twitch",
      userId: "twitch-user-1",
      userName: "recentviewer",
      visibleOnOverlayByDefault: false
    }],
    reconnectSuppressed: false,
    state: "stopped"
  })),
  start: vi.fn(() => ({
    channelName: "maiksmc",
    channelNames: ["maiksmc", "maiksplays"],
    connectedAt: "2026-08-27T00:00:00.000Z",
    disconnectsInWindow: 0,
    lastDisconnectAt: null,
    lastError: null,
    lastMessageAt: "2026-08-27T00:02:00.000Z",
    nextReconnectAt: null,
    recentMessages: [],
    reconnectSuppressed: false,
    state: "connected"
  }))
});

const createDiscordStatusRuntime = () => ({
  getStatus: vi.fn(() => ({
    channelIds: ["123456789012345678", "234567890123456789"],
    connectedAt: null,
    disconnectsInWindow: 10,
    guildId: "345678901234567890",
    lastDisconnectAt: "2026-08-27T00:04:00.000Z",
    lastError: "Discord raw failure for guildId=345678901234567890 channelId=123456789012345678 token=secret-discord-value",
    lastMessageAt: "2026-08-27T00:05:00.000Z",
    nextReconnectAt: "2026-08-27T00:06:00.000Z",
    recentMessages: [{
      id: "discord-recent-1",
      authorKind: "human",
      authorName: "Discord Viewer",
      channelId: "123456789012345678",
      channelName: "general",
      createdAt: "2026-08-27T00:05:00.000Z",
      guildId: "345678901234567890",
      message: "raw recent discord message",
      providerMessageId: "provider-discord-message-1",
      source: "discord",
      userId: "discord-user-1",
      visibleOnOverlayByDefault: false
    }],
    reconnectSuppressed: true,
    state: "stopped"
  })),
  start: vi.fn(() => ({
    channelIds: ["123456789012345678", "234567890123456789"],
    connectedAt: "2026-08-27T00:07:00.000Z",
    disconnectsInWindow: 0,
    guildId: "345678901234567890",
    lastDisconnectAt: null,
    lastError: null,
    lastMessageAt: "2026-08-27T00:05:00.000Z",
    nextReconnectAt: null,
    recentMessages: [],
    reconnectSuppressed: false,
    state: "connected"
  }))
});

const createYouTubeStatusRuntime = () => ({
  getStatus: vi.fn(() => ({
    activeLiveChatId: "active-live-chat-1",
    channelId: "UC1234567890123456789012",
    channelName: "MaiksMC",
    connectedAt: null,
    lastError: "YouTube raw polling failure for liveChatId=active-live-chat-1 channelId=UC1234567890123456789012 secret-youtube-value",
    lastMessageAt: "2026-08-27T00:08:00.000Z",
    nextPollAt: "2026-08-27T00:09:00.000Z",
    recentMessages: [{
      id: "youtube-recent-1",
      authorChannelId: "UC-author-123456789",
      authorKind: "human",
      authorName: "YouTube Viewer",
      channelName: "MaiksMC",
      createdAt: "2026-08-27T00:08:00.000Z",
      message: "raw recent youtube message",
      providerMessageId: "provider-youtube-message-1",
      source: "youtube",
      visibleOnOverlayByDefault: false
    }],
    state: "waiting"
  })),
  start: vi.fn(() => ({
    activeLiveChatId: "active-live-chat-1",
    channelId: "UC1234567890123456789012",
    channelName: "MaiksMC",
    connectedAt: "2026-08-27T00:10:00.000Z",
    lastError: null,
    lastMessageAt: "2026-08-27T00:08:00.000Z",
    nextPollAt: "2026-08-27T00:11:00.000Z",
    recentMessages: [],
    state: "connected"
  }))
});

const createAccessResult = (statusCode: 401 | 403 = 401): Awaited<ReturnType<RequireUrlAccessTokenForRequest>> =>
  statusCode === 401
    ? { ok: false, statusCode: 401, reason: "not_authenticated" }
    : { ok: false, statusCode: 403, reason: "token_not_valid_for_scope" };

const createSuccessfulAccessResult = (): Awaited<ReturnType<RequireUrlAccessTokenForRequest>> => ({
  ok: true,
  requiresLogin: true,
  session: { user: { id: "auth-owner" }, session: { userId: "auth-owner" } },
  user: {
    id: "owner-user",
    displayName: "Owner",
    profileVisibility: "private",
    avatarUrl: null
  }
});

const createTokenOnlyAccessResult = (): Awaited<ReturnType<RequireUrlAccessTokenForRequest>> => ({
  ok: true,
  requiresLogin: false,
  session: null,
  user: null
});

const createDatabasePool = (rolePermissionValues: readonly unknown[] = [["*"]]) => ({
  execute: vi.fn(async () => [
    rolePermissionValues.map((permissions) => ({
      permissions
    }))
  ])
});

const servers: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

const createServer = async (
  requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest,
  rolePermissionValues: readonly unknown[] = [["*"]]
) => {
  const server = Fastify();
  const databasePool = createDatabasePool(rolePermissionValues);
  const streamerChatRuntime = new StreamerChatRuntime({ maxHistory: 10 });
  const twitchRuntime = createTwitchStatusRuntime();
  const discordRuntime = createDiscordStatusRuntime();
  const youtubeRuntime = createYouTubeStatusRuntime();

  await server.register(fastifyWebsocket);
  registerStreamerChatControlRoutes(server, {
    discordChatIntakeRuntime: discordRuntime as never,
    getDatabasePool: () => databasePool as never,
    requireUrlAccessTokenForRequest,
    streamerChatRuntime,
    twitchChatIntakeRuntime: twitchRuntime as never,
    youtubeLiveChatIntakeRuntime: youtubeRuntime as never
  });
  await server.ready();
  servers.push(server);

  return {
    databasePool,
    discordRuntime,
    server,
    streamerChatRuntime,
    twitchRuntime,
    youtubeRuntime
  };
};

describe("streamer chat control API", () => {
  it("rejects a valid control token when its target requires login but no session is linked", async () => {
    const requireUrlAccessTokenForRequest = vi.fn(async () => createAccessResult());
    const { server } = await createServer(requireUrlAccessTokenForRequest);

    const response = await server.inject({
      method: "GET",
      url: `/streamer-chat/messages?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(requireUrlAccessTokenForRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        surface: "control-panel",
        scope: "control:open",
        token: validAccessToken
      })
    );
  });

  it("rejects a valid token-only control token because private chat requires a signed-in linked user", async () => {
    const requireUrlAccessTokenForRequest = vi.fn(async () => createTokenOnlyAccessResult());
    const { databasePool, server } = await createServer(requireUrlAccessTokenForRequest);

    const response = await server.inject({
      method: "GET",
      url: `/streamer-chat/messages?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(databasePool.execute).not.toHaveBeenCalled();
  });

  it("returns private chat messages with a valid control token and signed-in linked owner wildcard", async () => {
    const { server, streamerChatRuntime } = await createServer(async () => createSuccessfulAccessResult());
    streamerChatRuntime.appendMessage(createMessage());

    const response = await server.inject({
      method: "GET",
      url: `/streamer-chat/messages?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      source: "mixed",
      revision: 1,
      sessionId: expect.any(String),
      messages: [
        {
          id: "message-1",
          message: "Hello from chat."
        }
      ]
    });
  });

  it("returns minimal safe provider status projections for the private chat PWA", async () => {
    const { server } = await createServer(async () => createSuccessfulAccessResult());

    const twitchResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/twitch-status?accessToken=${validAccessToken}`
    });
    const discordResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/discord-status?accessToken=${validAccessToken}`
    });
    const youtubeResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/youtube-status?accessToken=${validAccessToken}`
    });
    const bodies = [
      twitchResponse.json(),
      discordResponse.json(),
      youtubeResponse.json()
    ];
    const serialized = JSON.stringify(bodies);

    expect(twitchResponse.statusCode).toBe(200);
    expect(twitchResponse.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: expect.any(String),
      status: {
        provider: "twitch",
        state: "stopped",
        targetLabel: "#maiksmc + #maiksplays",
        lastMessageAt: "2026-08-27T00:02:00.000Z",
        nextRetryAt: "2026-08-27T00:03:00.000Z",
        reconnectSuppressed: false,
        issue: {
          code: "twitch_runtime_problem",
          copy: "Twitch chat intake needs attention. Open provider admin for details."
        }
      }
    });
    expect(discordResponse.statusCode).toBe(200);
    expect(discordResponse.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: expect.any(String),
      status: {
        provider: "discord",
        state: "stopped",
        targetLabel: "2 selected channels",
        lastMessageAt: "2026-08-27T00:05:00.000Z",
        nextRetryAt: "2026-08-27T00:06:00.000Z",
        reconnectSuppressed: true,
        issue: {
          code: "discord_reconnect_suppressed",
          copy: "Auto reconnect is paused after repeated disconnects. Open provider admin or retry manually."
        }
      }
    });
    expect(youtubeResponse.statusCode).toBe(200);
    expect(youtubeResponse.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: expect.any(String),
      status: {
        provider: "youtube",
        state: "waiting",
        targetLabel: "MaiksMC",
        lastMessageAt: "2026-08-27T00:08:00.000Z",
        nextPollAt: "2026-08-27T00:09:00.000Z",
        reconnectSuppressed: false,
        issue: {
          code: "youtube_runtime_problem",
          copy: "YouTube live-chat polling needs attention. Open provider admin for details."
        }
      }
    });
    expect(serialized).not.toContain("recentMessages");
    expect(serialized).not.toContain("lastError");
    expect(serialized).not.toContain("disconnectsInWindow");
    expect(serialized).not.toContain("lastDisconnectAt");
    expect(serialized).not.toContain("connectedAt");
    expect(serialized).not.toContain("channelIds");
    expect(serialized).not.toContain("guildId");
    expect(serialized).not.toContain("channelId");
    expect(serialized).not.toContain("activeLiveChatId");
    expect(serialized).not.toContain("raw recent");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("987654321");
    expect(serialized).not.toContain("123456789012345678");
    expect(serialized).not.toContain("UC1234567890123456789012");
    expect(serialized).not.toContain("active-live-chat-1");
  });

  it("returns minimal safe provider status projections after private PWA reconnect", async () => {
    const { discordRuntime, server, twitchRuntime, youtubeRuntime } = await createServer(
      async () => createSuccessfulAccessResult()
    );

    const twitchResponse = await server.inject({
      method: "POST",
      url: "/streamer-chat/twitch-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });
    const discordResponse = await server.inject({
      method: "POST",
      url: "/streamer-chat/discord-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });
    const youtubeResponse = await server.inject({
      method: "POST",
      url: "/streamer-chat/youtube-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });
    const bodies = [
      twitchResponse.json(),
      discordResponse.json(),
      youtubeResponse.json()
    ];
    const serialized = JSON.stringify(bodies);

    expect(twitchResponse.statusCode).toBe(200);
    expect(twitchResponse.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: expect.any(String),
      status: {
        provider: "twitch",
        state: "connected",
        targetLabel: "#maiksmc + #maiksplays",
        lastMessageAt: "2026-08-27T00:02:00.000Z",
        nextRetryAt: null,
        reconnectSuppressed: false,
        issue: null
      }
    });
    expect(discordResponse.statusCode).toBe(200);
    expect(discordResponse.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: expect.any(String),
      status: {
        provider: "discord",
        state: "connected",
        targetLabel: "2 selected channels",
        lastMessageAt: "2026-08-27T00:05:00.000Z",
        nextRetryAt: null,
        reconnectSuppressed: false,
        issue: null
      }
    });
    expect(youtubeResponse.statusCode).toBe(200);
    expect(youtubeResponse.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: expect.any(String),
      status: {
        provider: "youtube",
        state: "connected",
        targetLabel: "MaiksMC",
        lastMessageAt: "2026-08-27T00:08:00.000Z",
        nextPollAt: "2026-08-27T00:11:00.000Z",
        reconnectSuppressed: false,
        issue: null
      }
    });
    expect(serialized).not.toContain("recentMessages");
    expect(serialized).not.toContain("lastError");
    expect(serialized).not.toContain("disconnectsInWindow");
    expect(serialized).not.toContain("channelIds");
    expect(serialized).not.toContain("guildId");
    expect(serialized).not.toContain("channelId");
    expect(serialized).not.toContain("activeLiveChatId");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("123456789012345678");
    expect(serialized).not.toContain("UC1234567890123456789012");
    expect(discordRuntime.start).toHaveBeenCalledTimes(1);
    expect(twitchRuntime.start).toHaveBeenCalledTimes(1);
    expect(youtubeRuntime.start).toHaveBeenCalledTimes(1);
  });

  it("allows chat:view helpers to read messages, status, reconnect, and live websocket snapshots", async () => {
    const requireUrlAccessTokenForRequest = vi.fn(async () => createSuccessfulAccessResult());
    const { discordRuntime, server, streamerChatRuntime, twitchRuntime, youtubeRuntime } = await createServer(
      requireUrlAccessTokenForRequest,
      [["chat:view"]]
    );
    streamerChatRuntime.appendMessage(createMessage());

    const messagesResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/messages?accessToken=${validAccessToken}`
    });
    const statusResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/twitch-status?accessToken=${validAccessToken}`
    });
    const discordStatusResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/discord-status?accessToken=${validAccessToken}`
    });
    const youtubeStatusResponse = await server.inject({
      method: "GET",
      url: `/streamer-chat/youtube-status?accessToken=${validAccessToken}`
    });
    const reconnectResponse = await server.inject({
      method: "POST",
      url: "/streamer-chat/twitch-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });
    const discordReconnectResponse = await server.inject({
      method: "POST",
      url: "/streamer-chat/discord-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });
    const youtubeReconnectResponse = await server.inject({
      method: "POST",
      url: "/streamer-chat/youtube-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });
    const address = await server.listen({ host: "127.0.0.1", port: 0 });
    const socket = new WebSocket(`${address.replace("http://", "ws://")}/streamer-chat/live?accessToken=${validAccessToken}`);

    const initialSnapshot = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for websocket snapshot")), 2_000);
      socket.once("message", (rawMessage) => {
        clearTimeout(timeout);
        resolve(JSON.parse(rawMessage.toString()) as Record<string, unknown>);
      });
      socket.once("error", reject);
    });

    expect(messagesResponse.statusCode).toBe(200);
    expect(messagesResponse.json()).toMatchObject({
      ok: true,
      messages: [
        {
          id: "message-1"
        }
      ]
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "stopped"
      }
    });
    expect(discordStatusResponse.statusCode).toBe(200);
    expect(discordStatusResponse.json()).toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "stopped"
      }
    });
    expect(youtubeStatusResponse.statusCode).toBe(200);
    expect(youtubeStatusResponse.json()).toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "waiting"
      }
    });
    expect(reconnectResponse.statusCode).toBe(200);
    expect(reconnectResponse.json()).toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "connected"
      }
    });
    expect(discordReconnectResponse.statusCode).toBe(200);
    expect(discordReconnectResponse.json()).toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "connected"
      }
    });
    expect(youtubeReconnectResponse.statusCode).toBe(200);
    expect(youtubeReconnectResponse.json()).toMatchObject({
      ok: true,
      readOnly: true,
      status: {
        state: "connected"
      }
    });
    await expect(initialSnapshot).resolves.toMatchObject({
      type: "streamer-chat.snapshot",
      payload: {
        messages: [
          {
            id: "message-1"
          }
        ]
      }
    });
    expect(discordRuntime.start).toHaveBeenCalledTimes(1);
    expect(twitchRuntime.start).toHaveBeenCalledTimes(1);
    expect(youtubeRuntime.start).toHaveBeenCalledTimes(1);

    socket.close();
    await new Promise<void>((resolve) => socket.once("close", () => resolve()));
  });

  it("denies linked users without owner wildcard or chat:view and does not reconnect providers", async () => {
    const { discordRuntime, server, twitchRuntime, youtubeRuntime } = await createServer(
      async () => createSuccessfulAccessResult(),
      [["moderators:manage"]]
    );

    const privateRequests = [
      {
        method: "GET" as const,
        url: `/streamer-chat/messages?accessToken=${validAccessToken}`
      },
      {
        method: "GET" as const,
        url: `/streamer-chat/twitch-status?accessToken=${validAccessToken}`
      },
      {
        method: "POST" as const,
        url: "/streamer-chat/twitch-reconnect",
        payload: { accessToken: validAccessToken }
      },
      {
        method: "GET" as const,
        url: `/streamer-chat/discord-status?accessToken=${validAccessToken}`
      },
      {
        method: "POST" as const,
        url: "/streamer-chat/discord-reconnect",
        payload: { accessToken: validAccessToken }
      },
      {
        method: "GET" as const,
        url: `/streamer-chat/youtube-status?accessToken=${validAccessToken}`
      },
      {
        method: "POST" as const,
        url: "/streamer-chat/youtube-reconnect",
        payload: { accessToken: validAccessToken }
      }
    ];

    for (const privateRequest of privateRequests) {
      const response = await server.inject(privateRequest);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        ok: false,
        reason: "streamer_chat_forbidden"
      });
    }

    expect(discordRuntime.getStatus).not.toHaveBeenCalled();
    expect(discordRuntime.start).not.toHaveBeenCalled();
    expect(twitchRuntime.getStatus).not.toHaveBeenCalled();
    expect(twitchRuntime.start).not.toHaveBeenCalled();
    expect(youtubeRuntime.getStatus).not.toHaveBeenCalled();
    expect(youtubeRuntime.start).not.toHaveBeenCalled();
  });

  it("does not run reconnect when the control token is for the wrong surface or scope", async () => {
    const { server, twitchRuntime } = await createServer(async () => createAccessResult(403));

    const response = await server.inject({
      method: "POST",
      url: "/streamer-chat/twitch-reconnect",
      payload: {
        accessToken: validAccessToken
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "token_not_valid_for_scope"
    });
    expect(twitchRuntime.start).not.toHaveBeenCalled();
  });

  it("rejects websocket chat for linked users without chat authority", async () => {
    const { server } = await createServer(
      async () => createSuccessfulAccessResult(),
      [["moderators:manage"]]
    );
    const address = await server.listen({ host: "127.0.0.1", port: 0 });
    const socket = new WebSocket(`${address.replace("http://", "ws://")}/streamer-chat/live?accessToken=${validAccessToken}`);

    const closeEvent = new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for websocket close")), 2_000);
      socket.on("close", (code, reason) => {
        clearTimeout(timeout);
        resolve({ code, reason: reason.toString() });
      });
      socket.on("error", reject);
    });

    await expect(closeEvent).resolves.toEqual({
      code: 1008,
      reason: "control_panel_access_denied"
    });
  });

  it("rejects websocket chat with the same session boundary and a sanitized reason", async () => {
    const { server } = await createServer(async () => createAccessResult());
    const address = await server.listen({ host: "127.0.0.1", port: 0 });
    const socket = new WebSocket(`${address.replace("http://", "ws://")}/streamer-chat/live?accessToken=${validAccessToken}`);

    const closeEvent = new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for websocket close")), 2_000);
      socket.on("close", (code, reason) => {
        clearTimeout(timeout);
        resolve({ code, reason: reason.toString() });
      });
      socket.on("error", reject);
    });

    await expect(closeEvent).resolves.toEqual({
      code: 1008,
      reason: "control_panel_access_denied"
    });
  });

  it("keeps websocket chat open and sends its initial snapshot for a signed-in linked owner", async () => {
    const requireUrlAccessTokenForRequest = vi.fn(async () => createSuccessfulAccessResult());
    const { server, streamerChatRuntime } = await createServer(requireUrlAccessTokenForRequest);
    streamerChatRuntime.appendMessage(createMessage());
    const address = await server.listen({ host: "127.0.0.1", port: 0 });
    const socket = new WebSocket(`${address.replace("http://", "ws://")}/streamer-chat/live?accessToken=${validAccessToken}`);

    const initialSnapshot = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for websocket snapshot")), 2_000);
      socket.once("message", (rawMessage) => {
        clearTimeout(timeout);
        resolve(JSON.parse(rawMessage.toString()) as Record<string, unknown>);
      });
      socket.once("error", reject);
    });

    await expect(initialSnapshot).resolves.toMatchObject({
      type: "streamer-chat.snapshot",
      payload: {
        messages: [
          {
            id: "message-1",
            message: "Hello from chat."
          }
        ]
      }
    });
    expect(socket.readyState).toBe(WebSocket.OPEN);
    expect(requireUrlAccessTokenForRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        surface: "control-panel",
        scope: "control:open",
        token: validAccessToken
      })
    );

    socket.close();
    await new Promise<void>((resolve) => socket.once("close", () => resolve()));
  });
});
