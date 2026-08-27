import { randomUUID } from "node:crypto";

import type {
  DiscordChatIntakeRuntime,
  TwitchChatIntakeRuntime,
  YouTubeLiveChatIntakeRuntime
} from "../provider-integrations/index.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { RequireUrlAccessTokenForRequest } from "../url-access-token-request-access.service.js";
import type { StreamerChatLiveSocket, StreamerChatRuntime } from "./index.js";

const streamerChatAccessRequestSchema = z.object({
  accessToken: z.string().min(24)
});

type UrlAccessTokenRequestAccess = Awaited<ReturnType<RequireUrlAccessTokenForRequest>>;

export const registerStreamerChatControlRoutes = (
  server: FastifyInstance,
  dependencies: {
    discordChatIntakeRuntime: DiscordChatIntakeRuntime;
    requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest;
    streamerChatRuntime: StreamerChatRuntime;
    twitchChatIntakeRuntime: TwitchChatIntakeRuntime;
    youtubeLiveChatIntakeRuntime: YouTubeLiveChatIntakeRuntime;
  }
): void => {
  const validateControlPanelAccess = async (
    request: Parameters<RequireUrlAccessTokenForRequest>[0],
    accessToken: string
  ): Promise<UrlAccessTokenRequestAccess> =>
    dependencies.requireUrlAccessTokenForRequest(request, {
      deniedReason: "control_panel_access_denied",
      token: accessToken,
      surface: "control-panel",
      scope: "control:open",
      userUnlinkedReason: "control_panel_user_unlinked"
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      source: "mixed",
      messages: dependencies.streamerChatRuntime.listVisibleMessages(),
      checkedAt: new Date().toISOString()
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: dependencies.twitchChatIntakeRuntime.getStatus(),
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: dependencies.twitchChatIntakeRuntime.start(),
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: dependencies.discordChatIntakeRuntime.getStatus(),
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: dependencies.discordChatIntakeRuntime.start(),
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: dependencies.youtubeLiveChatIntakeRuntime.getStatus(),
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

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      reply.code(tokenValidation.statusCode);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: dependencies.youtubeLiveChatIntakeRuntime.start(),
      checkedAt: new Date().toISOString()
    };
  });

  server.get("/streamer-chat/live", { websocket: true }, async (socket: StreamerChatLiveSocket, request) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      socket.close(1008, "invalid_request");
      return;
    }

    const tokenValidation = await validateControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      socket.close(1008, "control_panel_access_denied");
      return;
    }

    dependencies.streamerChatRuntime.registerLiveClient(randomUUID(), socket);
  });
};
