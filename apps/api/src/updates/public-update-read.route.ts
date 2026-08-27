import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { PublicUpdateReadService } from "./public-update-read.service.js";
import { createPublicUpdateReadRepository } from "./public-update-read-store.service.js";
import type {
  PublicUpdateDetailResult,
  PublicUpdateListResult
} from "./public-update-read.types.js";

type PublicUpdateReadRouteDependencies = {
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<PublicUpdateReadService, "listUpdates" | "getUpdate">;
  getNodeEnv?: () => string | undefined;
};

const updateSlugParamsSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,190}$/)
}).strict();

const sendDetailResult = (
  result: PublicUpdateDetailResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  reply.code(404);
  return result;
};

export const registerPublicUpdateReadRoutes = (
  server: FastifyInstance,
  dependencies: PublicUpdateReadRouteDependencies
): void => {
  const publishExampleRecords = (): boolean =>
    (dependencies.getNodeEnv?.() ?? process.env.NODE_ENV) !== "production";
  const getService = (): Pick<PublicUpdateReadService, "listUpdates" | "getUpdate"> =>
    dependencies.createService?.()
    ?? new PublicUpdateReadService(
      createPublicUpdateReadRepository(dependencies.getDatabasePool())
    );

  server.get("/updates", async (_request, reply): Promise<PublicUpdateListResult | {
    ok: false;
    reason: "updates_unavailable";
  }> => {
    try {
      const result = await getService().listUpdates();

      return publishExampleRecords()
        ? result
        : {
          ...result,
          updates: result.updates.filter((update) => !update.isExample)
        };
    } catch (error) {
      server.log.warn({ err: error }, "Public update list failed.");
      reply.code(503);
      return { ok: false, reason: "updates_unavailable" };
    }
  });

  server.get<{ Params: { slug: string } }>("/updates/:slug", async (request, reply) => {
    const parsedParams = updateSlugParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return { ok: false, reason: "invalid_update_slug" };
    }

    try {
      const result = await getService().getUpdate(parsedParams.data.slug);

      if (result.ok && result.update.isExample && !publishExampleRecords()) {
        return sendDetailResult({ ok: false, reason: "update_not_found" }, reply);
      }

      return sendDetailResult(result, reply);
    } catch (error) {
      server.log.warn({ err: error }, "Public update detail failed.");
      reply.code(503);
      return { ok: false, reason: "updates_unavailable" };
    }
  });
};
