import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthSessionSnapshot } from "../account/index.js";
import { SessionAdminService } from "./session-admin.service.js";
import { createSessionAdminRepository } from "./session-admin-store.service.js";

type SessionAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<SessionAdminService, "listSessions" | "revokeSession" | "revokeOtherSessions">;
};

const sessionParamsSchema = z.object({
  id: z.string().trim().min(1).max(36)
}).strict();

export const registerSessionAdminRoutes = (
  server: FastifyInstance,
  dependencies: SessionAdminRouteDependencies
): void => {
  const getService = (): Pick<SessionAdminService, "listSessions" | "revokeSession" | "revokeOtherSessions"> =>
    dependencies.createService?.()
    ?? new SessionAdminService(createSessionAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<AuthSessionSnapshot> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Session admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/sessions", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "session_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listSessions({
        authUserId: session.user.id,
        currentSessionId: session.session.id ?? null
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Session admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "session_admin_unavailable"
      };
    }
  });

  server.post("/admin/sessions/:id/revoke", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "session_admin_unavailable" : "not_authenticated"
      };
    }

    const params = sessionParamsSchema.safeParse(request.params);

    if (!params.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "session_admin_invalid_input"
      };
    }

    try {
      const result = await getService().revokeSession({
        authUserId: session.user.id,
        id: params.data.id
      });

      if (!result.ok) {
        reply.code(result.reason === "session_admin_not_found" ? 404 : result.reason === "session_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Session admin revoke failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "session_admin_unavailable"
      };
    }
  });

  server.post("/admin/sessions/revoke-others", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "session_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().revokeOtherSessions({
        authUserId: session.user.id,
        currentSessionId: session.session.id ?? null
      });

      if (!result.ok) {
        reply.code(result.reason === "session_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Session admin revoke others failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "session_admin_unavailable"
      };
    }
  });
};
