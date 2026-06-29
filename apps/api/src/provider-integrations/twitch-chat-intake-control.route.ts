import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createTwitchChatIntakeControlRepository } from "./twitch-chat-intake-control-store.service.js";
import { TwitchChatIntakeControlService } from "./twitch-chat-intake-control.service.js";
import type { TwitchChatIntakeRuntime } from "./twitch-chat-intake-control.types.js";

type TwitchChatIntakeAuthSession = {
  user: {
    id: string;
  };
} | null;

type TwitchChatIntakeControlRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<TwitchChatIntakeAuthSession>;
  getDatabasePool: () => DatabasePool;
  runtime: TwitchChatIntakeRuntime;
  createService?: () => Pick<TwitchChatIntakeControlService, "getStatus" | "start" | "stop">;
};

export const registerTwitchChatIntakeControlRoutes = (
  server: FastifyInstance,
  dependencies: TwitchChatIntakeControlRouteDependencies
): void => {
  const getService = (): Pick<TwitchChatIntakeControlService, "getStatus" | "start" | "stop"> =>
    dependencies.createService?.()
    ?? new TwitchChatIntakeControlService(
      createTwitchChatIntakeControlRepository(dependencies.getDatabasePool()),
      dependencies.runtime
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<TwitchChatIntakeAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Twitch chat intake authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (service: Pick<TwitchChatIntakeControlService, "getStatus" | "start" | "stop">, authUserId: string) => Promise<unknown>
  ): Promise<unknown> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "twitch_chat_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (typeof result === "object" && result !== null && "ok" in result && result.ok === false) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Twitch chat intake control failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "twitch_chat_unavailable"
      };
    }
  };

  server.get("/admin/provider-integrations/twitch-chat", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.getStatus({ authUserId }))
  );

  server.post("/admin/provider-integrations/twitch-chat/start", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.start({ authUserId }))
  );

  server.post("/admin/provider-integrations/twitch-chat/stop", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.stop({ authUserId }))
  );
};
