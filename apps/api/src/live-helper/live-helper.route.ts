import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { LiveHelperDashboardService } from "./live-helper.service.js";
import { createLiveHelperDashboardRepository } from "./live-helper-store.service.js";

type LiveHelperAuthSession = {
  user: {
    id: string;
  };
} | null;

type LiveHelperRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<LiveHelperAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<LiveHelperDashboardService, "getDashboard">;
};

export const registerLiveHelperDashboardRoutes = (
  server: FastifyInstance,
  dependencies: LiveHelperRouteDependencies
): void => {
  const getService = (): Pick<LiveHelperDashboardService, "getDashboard"> =>
    dependencies.createService?.()
    ?? new LiveHelperDashboardService(createLiveHelperDashboardRepository(dependencies.getDatabasePool()));

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<LiveHelperAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Live helper authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/live-helper", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "live_helper_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getDashboard({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Live helper dashboard failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "live_helper_unavailable"
      };
    }
  });
};
