import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { ProjectReadService } from "./project-read.service.js";
import { createProjectReadRepository } from "./project-read-store.service.js";
import type { ProjectDetailResult, ProjectListResult } from "./project-read.types.js";

type ProjectReadRouteDependencies = {
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ProjectReadService, "listProjects" | "getProject">;
};

const projectSlugParamsSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,190}$/)
}).strict();

const sendProjectDetailResult = (
  result: ProjectDetailResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  reply.code(404);
  return result;
};

export const registerProjectReadRoutes = (
  server: FastifyInstance,
  dependencies: ProjectReadRouteDependencies
): void => {
  const getService = (): Pick<ProjectReadService, "listProjects" | "getProject"> =>
    dependencies.createService?.()
    ?? new ProjectReadService(createProjectReadRepository(dependencies.getDatabasePool()));

  server.get("/projects", async (_request, reply): Promise<ProjectListResult | {
    ok: false;
    reason: "projects_unavailable";
  }> => {
    try {
      const service = getService();

      return await service.listProjects();
    } catch (error) {
      server.log.warn({ err: error }, "Project list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "projects_unavailable"
      };
    }
  });

  server.get<{ Params: { slug: string } }>("/projects/:slug", async (request, reply) => {
    const parsedParams = projectSlugParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_project_slug"
      };
    }

    try {
      const service = getService();

      return sendProjectDetailResult(
        await service.getProject(parsedParams.data.slug),
        reply
      );
    } catch (error) {
      server.log.warn({ err: error }, "Project detail failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "projects_unavailable"
      };
    }
  });
};
