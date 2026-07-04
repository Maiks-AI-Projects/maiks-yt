import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createYouTubeLiveChatIntakeControlRepository } from "./youtube-live-chat-intake-control-store.service.js";
import { YouTubeLiveChatIntakeControlService } from "./youtube-live-chat-intake-control.service.js";
import type { YouTubeLiveChatIntakeRuntime } from "./youtube-live-chat-intake-control.types.js";

type YouTubeLiveChatIntakeAuthSession = {
  user: {
    id: string;
  };
} | null;

type YouTubeLiveChatIntakeControlRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<YouTubeLiveChatIntakeAuthSession>;
  getDatabasePool: () => DatabasePool;
  runtime: YouTubeLiveChatIntakeRuntime;
  createService?: () => Pick<YouTubeLiveChatIntakeControlService, "getStatus" | "start" | "stop">;
};

export const registerYouTubeLiveChatIntakeControlRoutes = (
  server: FastifyInstance,
  dependencies: YouTubeLiveChatIntakeControlRouteDependencies
): void => {
  const getService = (): Pick<YouTubeLiveChatIntakeControlService, "getStatus" | "start" | "stop"> =>
    dependencies.createService?.()
    ?? new YouTubeLiveChatIntakeControlService(
      createYouTubeLiveChatIntakeControlRepository(dependencies.getDatabasePool()),
      dependencies.runtime
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<YouTubeLiveChatIntakeAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube live chat intake authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (service: Pick<YouTubeLiveChatIntakeControlService, "getStatus" | "start" | "stop">, authUserId: string) => Promise<unknown>
  ): Promise<unknown> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "youtube_live_chat_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (typeof result === "object" && result !== null && "ok" in result && result.ok === false) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube live chat intake control failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "youtube_live_chat_unavailable"
      };
    }
  };

  server.get("/admin/provider-integrations/youtube-live-chat", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.getStatus({ authUserId }))
  );

  server.post("/admin/provider-integrations/youtube-live-chat/start", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.start({ authUserId }))
  );

  server.post("/admin/provider-integrations/youtube-live-chat/stop", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.stop({ authUserId }))
  );
};
