import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createAdminOverviewActivityRepository } from "./admin-overview-activity-store.service.js";
import { AdminOverviewActivityService } from "./admin-overview-activity.service.js";

type AdminOverviewAuthSession = {
  user: {
    id: string;
  };
} | null;

type AdminOverviewRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<AdminOverviewAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<AdminOverviewActivityService, "getActivity">;
};

export const registerAdminOverviewActivityRoutes = (
  server: FastifyInstance,
  dependencies: AdminOverviewRouteDependencies
): void => {
  const getService = (): Pick<AdminOverviewActivityService, "getActivity"> =>
    dependencies.createService?.()
    ?? new AdminOverviewActivityService(
      createAdminOverviewActivityRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<AdminOverviewAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Admin overview authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/overview/activity", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "admin_overview_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getActivity({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Admin overview activity lookup failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "admin_overview_unavailable"
      };
    }
  });
};
