import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { LocalAgentServerConfig } from "./local-agent-auth.service.js";
import { LocalAgentAdminStatusService } from "./local-agent-admin-status.service.js";
import { createLocalAgentAdminStatusRepository } from "./local-agent-admin-status-store.service.js";
import type { LocalAgentRuntimeService } from "./local-agent-runtime.service.js";

type LocalAgentAdminStatusAuthSession = {
  user: {
    id: string;
  };
} | null;

type LocalAgentAdminStatusRouteDependencies = {
  config: LocalAgentServerConfig;
  getAuthSession: (request: FastifyRequest) => Promise<LocalAgentAdminStatusAuthSession>;
  getDatabasePool: () => DatabasePool;
  runtime: Pick<LocalAgentRuntimeService, "getStatus">;
  createService?: () => Pick<LocalAgentAdminStatusService, "getStatus">;
};

export const registerLocalAgentAdminStatusRoutes = (
  server: FastifyInstance,
  dependencies: LocalAgentAdminStatusRouteDependencies
): void => {
  const getService = (): Pick<LocalAgentAdminStatusService, "getStatus"> =>
    dependencies.createService?.()
    ?? new LocalAgentAdminStatusService(
      createLocalAgentAdminStatusRepository(dependencies.getDatabasePool()),
      {
        config: dependencies.config,
        getRuntimeStatus: () => dependencies.runtime.getStatus()
      }
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<LocalAgentAdminStatusAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);
      if (!session) {
        reply.code(401);
        return null;
      }
      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Local-agent status authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/local-agent/status", async (request, reply) => {
    const session = await getSession(request, reply);
    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "local_agent_status_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getStatus({ authUserId: session.user.id });
      if (!result.ok) {
        reply.code(403);
      }
      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Local-agent status lookup failed.");
      reply.code(503);
      return { ok: false, reason: "local_agent_status_unavailable" };
    }
  });
};
