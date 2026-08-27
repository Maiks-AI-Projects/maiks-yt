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

const createStatusRuntime = () => ({
  getStatus: vi.fn(() => ({
    channelName: "maiksmc",
    connectedAt: null,
    lastError: null,
    lastMessageAt: null,
    recentMessages: [],
    state: "stopped"
  })),
  start: vi.fn(() => ({
    channelName: "maiksmc",
    connectedAt: "2026-08-27T00:00:00.000Z",
    lastError: null,
    lastMessageAt: null,
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
  const twitchRuntime = createStatusRuntime();
  const discordRuntime = createStatusRuntime();
  const youtubeRuntime = createStatusRuntime();

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
        state: "stopped"
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

    expect(discordRuntime.start).not.toHaveBeenCalled();
    expect(twitchRuntime.start).not.toHaveBeenCalled();
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
