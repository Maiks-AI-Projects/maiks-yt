import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { GameLibraryService } from "./game-library.service.js";
import { createGameLibraryRepository } from "./game-library-store.service.js";
import type {
  GameLibraryAdminMutationResult,
  GameLibraryUpdateInput
} from "./game-library.types.js";

type GameLibraryAuthSession = {
  user: {
    id: string;
  };
} | null;

type GameLibraryRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<GameLibraryAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<GameLibraryService,
    | "listGames"
    | "createGame"
    | "updateGame"
    | "listPublicGames"
    | "createSuggestion"
    | "reviewSuggestion"
  >;
};

const gameIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const gamePayloadSchema = z.object({
  title: z.string().trim().min(1).max(191),
  slug: z.string().trim().min(1).max(191).nullable().optional(),
  platformLabel: z.string().trim().max(120).nullable().optional(),
  storeProvider: z.string().trim().max(80).nullable().optional(),
  storeUrl: z.string().trim().max(1024).nullable().optional(),
  ownershipStatus: z.enum(["owned", "not-owned", "borrowed", "subscription-access", "gifted", "unknown"]),
  interestStatus: z.enum(["interested", "maybe-later", "currently-playing", "completed", "paused", "not-a-fit"]),
  streamFitNote: z.string().trim().max(500).nullable().optional(),
  contentWarnings: z.string().trim().max(2000).nullable().optional(),
  categoryLabel: z.string().trim().max(120).nullable().optional(),
  visibility: z.enum(["private", "public"]),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional()
}).strict();

const gameUpdatePayloadSchema = gamePayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_game_field_required"
);

const gameSuggestionPayloadSchema = z.object({
  title: z.string().trim().min(1).max(191),
  platformLabel: z.string().trim().max(120).nullable().optional(),
  storeUrl: z.string().trim().max(1024).nullable().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  suggestedByName: z.string().trim().max(191).nullable().optional()
}).strict();

const gameSuggestionReviewPayloadSchema = z.object({
  status: z.enum(["accepted", "maybe-later", "rejected", "duplicate", "already-played"]),
  reviewerNote: z.string().trim().max(1000).nullable().optional(),
  linkedGameId: z.string().trim().min(1).max(36).nullable().optional()
}).strict();

const sendAdminMutationResult = (
  result: GameLibraryAdminMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "game_library_admin_user_unlinked"
    || result.reason === "game_library_admin_forbidden"
    ? 403
    : result.reason === "game_library_invalid_input"
      ? 400
      : result.reason === "game_library_slug_conflict"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

export const registerGameLibraryRoutes = (
  server: FastifyInstance,
  dependencies: GameLibraryRouteDependencies
): void => {
  const getService = (): Pick<GameLibraryService,
    | "listGames"
    | "createGame"
    | "updateGame"
    | "listPublicGames"
    | "createSuggestion"
    | "reviewSuggestion"
  > =>
    dependencies.createService?.()
    ?? new GameLibraryService(createGameLibraryRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<GameLibraryAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Game library admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/games", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "game_library_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listGames({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Game library admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "game_library_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/games/suggestions/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "game_library_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = gameIdParamsSchema.safeParse(request.params);
    const parsedBody = gameSuggestionReviewPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "game_suggestion_invalid_input"
      };
    }

    try {
      const result = await getService().reviewSuggestion({
        authUserId: session.user.id,
        suggestionId: parsedParams.data.id,
        review: parsedBody.data
      });

      if (!result.ok) {
        reply.code(result.reason === "game_suggestion_invalid_input"
          ? 400
          : result.reason === "game_suggestion_not_found"
            ? 404
            : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Game suggestion review failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "game_library_admin_unavailable"
      };
    }
  });

  server.post("/admin/games", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "game_library_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = gamePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "game_library_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().createGame({
        authUserId: session.user.id,
        game: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Game library admin create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "game_library_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/games/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "game_library_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = gameIdParamsSchema.safeParse(request.params);
    const parsedBody = gameUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "game_library_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().updateGame({
        authUserId: session.user.id,
        gameId: parsedParams.data.id,
        game: parsedBody.data as GameLibraryUpdateInput
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Game library admin update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "game_library_admin_unavailable"
      };
    }
  });

  server.get("/games", async (_request, reply) => {
    try {
      return await getService().listPublicGames();
    } catch (error) {
      server.log.warn({ err: error }, "Game library public list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "game_library_unavailable"
      };
    }
  });

  server.post("/games/suggestions", async (request, reply) => {
    const parsedBody = gameSuggestionPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "game_suggestion_invalid_input"
      };
    }

    try {
      const result = await getService().createSuggestion(parsedBody.data);

      if (!result.ok) {
        reply.code(400);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Game suggestion create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "game_library_unavailable"
      };
    }
  });
};
