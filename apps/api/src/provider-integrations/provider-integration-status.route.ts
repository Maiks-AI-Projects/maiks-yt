import type { DatabasePool } from "@maiks-yt/database";
import type { ProviderIntegrationRuntimeState } from "@maiks-yt/integrations";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { ProviderIntegrationStatusService } from "./provider-integration-status.service.js";
import { createProviderIntegrationStatusRepository } from "./provider-integration-status-store.service.js";
import type { ProviderIntegrationStatusFailureReason } from "./provider-integration-status.types.js";

type ProviderIntegrationStatusAuthSession = {
  user: {
    id: string;
  };
} | null;

type ProviderIntegrationStatusRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ProviderIntegrationStatusAuthSession>;
  getDatabasePool: () => DatabasePool;
  getRuntimeState?: () => ProviderIntegrationRuntimeState;
  createService?: () => Pick<ProviderIntegrationStatusService, "getStatus">;
};

const createFailureResponse = (reason: ProviderIntegrationStatusFailureReason) => ({
  ok: false as const,
  reason
});

export const registerProviderIntegrationStatusRoutes = (
  server: FastifyInstance,
  dependencies: ProviderIntegrationStatusRouteDependencies
): void => {
  let defaultService: Pick<ProviderIntegrationStatusService, "getStatus"> | null = null;

  const getService = (): Pick<ProviderIntegrationStatusService, "getStatus"> => {
    if (dependencies.createService) {
      return dependencies.createService();
    }

    defaultService ??= new ProviderIntegrationStatusService(
      createProviderIntegrationStatusRepository(dependencies.getDatabasePool()),
      dependencies.getRuntimeState
        ? {
          runtimeState: dependencies.getRuntimeState
        }
        : {}
    );

    return defaultService;
  };

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
      return createFailureResponse(
        reply.statusCode === 503 ? "provider_integrations_unavailable" : "not_authenticated"
      );
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
      return createFailureResponse("provider_integrations_unavailable");
    }
  });
};
