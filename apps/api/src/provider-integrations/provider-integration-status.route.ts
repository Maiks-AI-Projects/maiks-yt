import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { ProviderIntegrationStatusService } from "./provider-integration-status.service.js";
import { createProviderIntegrationStatusRepository } from "./provider-integration-status-store.service.js";

type ProviderIntegrationStatusAuthSession = {
  user: {
    id: string;
  };
} | null;

type ProviderIntegrationStatusRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ProviderIntegrationStatusAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ProviderIntegrationStatusService, "getStatus">;
};

export const registerProviderIntegrationStatusRoutes = (
  server: FastifyInstance,
  dependencies: ProviderIntegrationStatusRouteDependencies
): void => {
  const getService = (): Pick<ProviderIntegrationStatusService, "getStatus"> =>
    dependencies.createService?.()
    ?? new ProviderIntegrationStatusService(
      createProviderIntegrationStatusRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ProviderIntegrationStatusAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Provider integration status authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/provider-integrations/status", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "provider_integrations_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getStatus({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Provider integration status lookup failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "provider_integrations_unavailable"
      };
    }
  });
};
