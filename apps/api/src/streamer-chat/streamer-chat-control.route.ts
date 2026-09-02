import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type {
  DiscordChatIntakeRuntime,
  TwitchChatIntakeRuntime,
  YouTubeLiveChatIntakeRuntime
} from "../provider-integrations/index.js";
import type { RequireUrlAccessTokenForRequest } from "../url-access-token-request-access.service.js";
import { createRequireStreamerChatControlAccess } from "./streamer-chat-control-access.service.js";
import type { StreamerChatLiveSocket, StreamerChatRuntime } from "./index.js";
import {
  projectDiscordStreamerChatStatus,
  projectTwitchStreamerChatStatus,
  projectYouTubeStreamerChatStatus
} from "./streamer-chat-status-projection.service.js";

const streamerChatAccessRequestSchema = z.object({
  accessToken: z.string().min(24)
});

export const registerStreamerChatControlRoutes = (
  server: FastifyInstance,
  dependencies: {
    discordChatIntakeRuntime: DiscordChatIntakeRuntime;
    getDatabasePool: () => DatabasePool;
    requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest;
    streamerChatRuntime: StreamerChatRuntime;
    twitchChatIntakeRuntime: TwitchChatIntakeRuntime;
    youtubeLiveChatIntakeRuntime: YouTubeLiveChatIntakeRuntime;
  }
): void => {
  const requireControlChatAccess = createRequireStreamerChatControlAccess({
    getDatabasePool: dependencies.getDatabasePool,
    requireUrlAccessTokenForRequest: dependencies.requireUrlAccessTokenForRequest
  });

  server.get("/streamer-chat/messages", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    const snapshot = dependencies.streamerChatRuntime.createSnapshot();

    return {
      ok: true,
      source: "mixed",
      messages: snapshot.payload.messages,
      checkedAt: snapshot.payload.sentAt,
      revision: snapshot.revision,
      sessionId: snapshot.sessionId
    };
  });

  server.get("/streamer-chat/twitch-status", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: projectTwitchStreamerChatStatus(dependencies.twitchChatIntakeRuntime.getStatus()),
      checkedAt: new Date().toISOString()
    };
  });

  server.post("/streamer-chat/twitch-reconnect", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: projectTwitchStreamerChatStatus(dependencies.twitchChatIntakeRuntime.start()),
      checkedAt: new Date().toISOString()
    };
  });

  server.get("/streamer-chat/discord-status", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: projectDiscordStreamerChatStatus(dependencies.discordChatIntakeRuntime.getStatus()),
      checkedAt: new Date().toISOString()
    };
  });

  server.post("/streamer-chat/discord-reconnect", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: projectDiscordStreamerChatStatus(dependencies.discordChatIntakeRuntime.start()),
      checkedAt: new Date().toISOString()
    };
  });

  server.get("/streamer-chat/youtube-status", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: projectYouTubeStreamerChatStatus(dependencies.youtubeLiveChatIntakeRuntime.getStatus()),
      checkedAt: new Date().toISOString()
    };
  });

  server.post("/streamer-chat/youtube-reconnect", async (request, reply) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: projectYouTubeStreamerChatStatus(
        dependencies.youtubeLiveChatIntakeRuntime.start({ resetQuotaBlock: true })
      ),
      checkedAt: new Date().toISOString()
    };
  });

  server.get("/streamer-chat/live", { websocket: true }, async (socket: StreamerChatLiveSocket, request) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      socket.close(1008, "invalid_request");
      return;
    }

    const access = await requireControlChatAccess(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      socket.close(1008, "control_panel_access_denied");
      return;
    }

    dependencies.streamerChatRuntime.registerLiveClient(randomUUID(), socket);
  });
};
