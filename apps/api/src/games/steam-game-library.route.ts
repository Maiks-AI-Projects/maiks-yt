import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { SteamGameLibraryService } from "./steam-game-library.service.js";
import { createSteamGameLibraryRepository } from "./steam-game-library-store.service.js";
import type {
  SteamGameLibraryServicePreviewResult,
  SteamGameLibraryStatusResult,
  SteamWishlistServicePreviewResult
} from "./steam-game-library.types.js";

type SteamGameLibraryAuthSession = {
  user: {
    id: string;
  };
} | null;

type SteamGameLibraryRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<SteamGameLibraryAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<SteamGameLibraryService, "getConnectionStatus" | "previewLibrary" | "previewWishlist">;
};

const isAccessFailure = (
  result: SteamGameLibraryStatusResult | SteamGameLibraryServicePreviewResult | SteamWishlistServicePreviewResult
): result is Extract<typeof result, { reason: string }> =>
  !result.ok && "reason" in result;

export const registerSteamGameLibraryRoutes = (
  server: FastifyInstance,
  dependencies: SteamGameLibraryRouteDependencies
): void => {
  const getService = (): Pick<SteamGameLibraryService, "getConnectionStatus" | "previewLibrary" | "previewWishlist"> =>
    dependencies.createService?.()
    ?? new SteamGameLibraryService(
      createSteamGameLibraryRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<SteamGameLibraryAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch {
      server.log.warn("Steam game library authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/games/steam/status", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "steam_game_library_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getConnectionStatus({ authUserId: session.user.id });

      if (isAccessFailure(result)) {
        reply.code(403);
      }

      return result;
    } catch {
      server.log.warn("Steam game library status failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "steam_game_library_unavailable"
      };
    }
  });

  server.get("/admin/games/steam/preview", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "steam_game_library_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().previewLibrary({ authUserId: session.user.id });

      if (isAccessFailure(result)) {
        reply.code(403);
      }

      return result;
    } catch {
      server.log.warn("Steam game library preview failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "steam_game_library_unavailable"
      };
    }
  });

  server.get("/admin/games/steam/wishlist", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "steam_game_library_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().previewWishlist({ authUserId: session.user.id });

      if (isAccessFailure(result)) {
        reply.code(403);
      }

      return result;
    } catch {
      server.log.warn("Steam wishlist preview failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "steam_game_library_unavailable"
      };
    }
  });
};
