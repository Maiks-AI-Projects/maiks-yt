import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createDiscordChatIntakeControlRepository } from "./discord-chat-intake-control-store.service.js";
import { DiscordChatIntakeControlService } from "./discord-chat-intake-control.service.js";
import type { DiscordChatIntakeRuntime } from "./discord-chat-intake-control.types.js";

type DiscordChatIntakeAuthSession = {
  user: {
    id: string;
  };
} | null;

type DiscordChatIntakeControlRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<DiscordChatIntakeAuthSession>;
  getDatabasePool: () => DatabasePool;
  runtime: DiscordChatIntakeRuntime;
  createService?: () => Pick<DiscordChatIntakeControlService, "getStatus" | "start" | "stop">;
};

export const registerDiscordChatIntakeControlRoutes = (
  server: FastifyInstance,
  dependencies: DiscordChatIntakeControlRouteDependencies
): void => {
  const getService = (): Pick<DiscordChatIntakeControlService, "getStatus" | "start" | "stop"> =>
    dependencies.createService?.()
    ?? new DiscordChatIntakeControlService(
      createDiscordChatIntakeControlRepository(dependencies.getDatabasePool()),
      dependencies.runtime
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<DiscordChatIntakeAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Discord chat intake authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (service: Pick<DiscordChatIntakeControlService, "getStatus" | "start" | "stop">, authUserId: string) => Promise<unknown>
  ): Promise<unknown> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "discord_chat_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (typeof result === "object" && result !== null && "ok" in result && result.ok === false) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Discord chat intake control failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "discord_chat_unavailable"
      };
    }
  };

  server.get("/admin/provider-integrations/discord-chat", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.getStatus({ authUserId }))
  );

  server.post("/admin/provider-integrations/discord-chat/start", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.start({ authUserId }))
  );

  server.post("/admin/provider-integrations/discord-chat/stop", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.stop({ authUserId }))
  );
};
