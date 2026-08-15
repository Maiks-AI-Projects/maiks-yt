import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { createGameCatalogRepository } from "./game-catalog-store.service.js";
import { GameCatalogService } from "./game-catalog.service.js";

type GameCatalogAuthSession = { user: { id: string } } | null;

type GameCatalogRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<GameCatalogAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<GameCatalogService, "search">;
};

const querySchema = z.object({
  q: z.string().max(100)
});

export const registerGameCatalogRoutes = (
  server: FastifyInstance,
  dependencies: GameCatalogRouteDependencies
): void => {
  server.get<{ Querystring: { q?: string } }>("/admin/games/catalog/search", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");

    let session: GameCatalogAuthSession;
    try {
      session = await dependencies.getAuthSession(request);
    } catch {
      server.log.warn("Game catalog authentication failed.");
      reply.code(503);
      return { ok: false, reason: "game_catalog_unavailable" };
    }

    if (!session) {
      reply.code(401);
      return { ok: false, reason: "not_authenticated" };
    }

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, reason: "game_catalog_invalid_query" };
    }

    try {
      const service = dependencies.createService?.()
        ?? new GameCatalogService(createGameCatalogRepository(dependencies.getDatabasePool()));
      const result = await service.search({
        authUserId: session.user.id,
        query: parsed.data.q
      });

      if (!result.ok) {
        reply.code(result.reason === "game_catalog_invalid_query"
          ? 400
          : result.reason === "game_library_admin_forbidden"
            ? 403
            : 404);
      }

      return result;
    } catch {
      server.log.warn("Game catalog search failed.");
      reply.code(503);
      return { ok: false, reason: "game_catalog_unavailable" };
    }
  });
};
