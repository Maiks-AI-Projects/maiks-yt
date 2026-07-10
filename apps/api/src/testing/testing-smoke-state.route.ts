import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createTestingSmokeStateRepository } from "./testing-smoke-state-store.service.js";
import { TestingSmokeStateService } from "./testing-smoke-state.service.js";

type TestingSmokeStateAuthSession = {
  user: {
    id: string;
  };
} | null;

type TestingSmokeStateRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<TestingSmokeStateAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<TestingSmokeStateService, "getState">;
};

export const registerTestingSmokeStateRoutes = (
  server: FastifyInstance,
  dependencies: TestingSmokeStateRouteDependencies
): void => {
  const getService = (): Pick<TestingSmokeStateService, "getState"> =>
    dependencies.createService?.()
    ?? new TestingSmokeStateService(createTestingSmokeStateRepository(dependencies.getDatabasePool()));

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<TestingSmokeStateAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Testing smoke state authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/testing/smoke-state", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "testing_smoke_state_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getState({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Testing smoke state lookup failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "testing_smoke_state_unavailable"
      };
    }
  });
};
