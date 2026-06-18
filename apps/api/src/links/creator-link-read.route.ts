import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance } from "fastify";

import { CreatorLinkReadService } from "./creator-link-read.service.js";
import { createCreatorLinkReadRepository } from "./creator-link-read-store.service.js";
import type { CreatorLinkListResult } from "./creator-link-read.types.js";

type CreatorLinkReadRouteDependencies = {
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<CreatorLinkReadService, "listLinks">;
};

export const registerCreatorLinkReadRoutes = (
  server: FastifyInstance,
  dependencies: CreatorLinkReadRouteDependencies
): void => {
  const getService = (): Pick<CreatorLinkReadService, "listLinks"> =>
    dependencies.createService?.()
    ?? new CreatorLinkReadService(createCreatorLinkReadRepository(dependencies.getDatabasePool()));

  server.get("/links", async (_request, reply): Promise<CreatorLinkListResult | {
    ok: false;
    reason: "creator_links_unavailable";
  }> => {
    try {
      const service = getService();

      return await service.listLinks();
    } catch (error) {
      server.log.warn({ err: error }, "Creator link list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "creator_links_unavailable"
      };
    }
  });
};
