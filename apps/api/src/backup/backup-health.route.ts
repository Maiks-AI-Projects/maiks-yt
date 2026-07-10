import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createBackupHealthRepository } from "./backup-health-store.service.js";
import { BackupHealthService } from "./backup-health.service.js";

type BackupHealthAuthSession = {
  user: {
    id: string;
  };
} | null;

type BackupHealthRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<BackupHealthAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<BackupHealthService, "getHealth">;
};

export const registerBackupHealthRoutes = (
  server: FastifyInstance,
  dependencies: BackupHealthRouteDependencies
): void => {
  const getService = (): Pick<BackupHealthService, "getHealth"> =>
    dependencies.createService?.()
    ?? new BackupHealthService(createBackupHealthRepository(dependencies.getDatabasePool()));

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<BackupHealthAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Backup health authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/backup/health", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "backup_health_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getHealth({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Backup health lookup failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "backup_health_unavailable"
      };
    }
  });
};
