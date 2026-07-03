import { randomUUID } from "node:crypto";

import type { UrlAccessSurface } from "@maiks-yt/domain/security";
import type { DiscordChatIntakeRuntime, TwitchChatIntakeRuntime } from "../provider-integrations/index.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { StreamerChatLiveSocket, StreamerChatRuntime } from "./index.js";

const streamerChatAccessRequestSchema = z.object({
  accessToken: z.string().min(24)
});

type UrlAccessTokenValidation = {
  valid: boolean;
  requiresLogin: boolean;
  reason?: string;
};

type ValidateUrlAccessToken = (input: {
  scope: string;
  surface: UrlAccessSurface;
  token: string;
}) => Promise<UrlAccessTokenValidation>;

export const registerStreamerChatControlRoutes = (
  server: FastifyInstance,
  dependencies: {
    discordChatIntakeRuntime: DiscordChatIntakeRuntime;
    streamerChatRuntime: StreamerChatRuntime;
    twitchChatIntakeRuntime: TwitchChatIntakeRuntime;
    validateUrlAccessToken: ValidateUrlAccessToken;
  }
): void => {
  const validateControlPanelAccess = async (
    accessToken: string
  ): Promise<UrlAccessTokenValidation> =>
    dependencies.validateUrlAccessToken({
      token: accessToken,
      surface: "control-panel",
      scope: "control:open"
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

    const tokenValidation = await validateControlPanelAccess(parsedRequest.data.accessToken);

    if (!tokenValidation.valid) {
      reply.code(403);
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

    const tokenValidation = await validateControlPanelAccess(parsedRequest.data.accessToken);

    if (!tokenValidation.valid) {
      reply.code(403);
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

    const tokenValidation = await validateControlPanelAccess(parsedRequest.data.accessToken);

    if (!tokenValidation.valid) {
      reply.code(403);
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

    const tokenValidation = await validateControlPanelAccess(parsedRequest.data.accessToken);

    if (!tokenValidation.valid) {
      reply.code(403);
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

    const tokenValidation = await validateControlPanelAccess(parsedRequest.data.accessToken);

    if (!tokenValidation.valid) {
      reply.code(403);
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

  server.get("/streamer-chat/live", { websocket: true }, async (socket: StreamerChatLiveSocket, request) => {
    const parsedRequest = streamerChatAccessRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      socket.close(1008, "invalid_request");
      return;
    }

    const tokenValidation = await validateControlPanelAccess(parsedRequest.data.accessToken);

    if (!tokenValidation.valid) {
      socket.close(1008, tokenValidation.reason ?? "control_panel_access_denied");
      return;
    }

    dependencies.streamerChatRuntime.registerLiveClient(randomUUID(), socket);
  });
};
