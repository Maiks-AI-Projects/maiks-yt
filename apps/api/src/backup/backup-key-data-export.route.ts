import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createBackupKeyDataExportRepository } from "./backup-key-data-export-store.service.js";
import { BackupKeyDataExportService } from "./backup-key-data-export.service.js";

type BackupKeyDataExportAuthSession = {
  user: {
    id: string;
  };
} | null;

type BackupKeyDataExportRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<BackupKeyDataExportAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<BackupKeyDataExportService, "buildExport">;
};

const getSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: BackupKeyDataExportRouteDependencies,
  server: FastifyInstance
): Promise<BackupKeyDataExportAuthSession> => {
  try {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return null;
    }

    return session;
  } catch (error) {
    server.log.warn({ err: error }, "Backup key-data export authentication failed.");
    reply.code(503);
    return null;
  }
};

export const registerBackupKeyDataExportRoutes = (
  server: FastifyInstance,
  dependencies: BackupKeyDataExportRouteDependencies
): void => {
  const getService = (): Pick<BackupKeyDataExportService, "buildExport"> =>
    dependencies.createService?.()
    ?? new BackupKeyDataExportService(createBackupKeyDataExportRepository(dependencies.getDatabasePool()));

  server.get("/admin/backup/key-data-export", async (request, reply) => {
    const session = await getSession(request, reply, dependencies, server);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "backup_key_data_export_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().buildExport({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
        return result;
      }

      const filenameDate = result.generatedAt.slice(0, 10);

      reply
        .header("content-type", "application/json; charset=utf-8")
        .header("content-disposition", `attachment; filename="maiks-yt-key-data-export-${filenameDate}.json"`)
        .header("x-maiks-key-data-export-generated-at", result.generatedAt)
        .header("x-maiks-key-data-export-sections", String(result.sections.length));

      return JSON.stringify(result, null, 2);
    } catch (error) {
      server.log.warn({ err: error }, "Backup key-data export failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "backup_key_data_export_unavailable"
      };
    }
  });
};
