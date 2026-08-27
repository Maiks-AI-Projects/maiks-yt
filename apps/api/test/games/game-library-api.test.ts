import type {
  GameLibraryAdminEntry,
  GameLibrarySource,
  GameScheduleAssociationSummary,
  GameSuggestionReviewInput,
  GameSuggestionSource,
  PublicGameSuggestionInput
} from "@maiks-yt/domain/games";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerGameLibraryRoutes } from "../../src/games/game-library.route.js";
import { GameLibraryService } from "../../src/games/game-library.service.js";
import { createGameLibraryRepository } from "../../src/games/game-library-store.service.js";
import type {
  GameLibraryAdminActor,
  GameLibraryCreateInput,
  GameLibraryRepository,
  GameLibraryUpdateInput
} from "../../src/games/game-library.types.js";

const createGame = (
  id: string,
  overrides: Partial<GameLibrarySource> = {}
): GameLibrarySource => ({
  id,
  slug: id,
  title: `Game ${id}`,
  platformLabel: "Steam",
  storeProvider: "steam",
  storeUrl: "https://example.com/game",
  ownershipStatus: "owned",
  interestStatus: "interested",
  streamFitNote: "Good fit.",
  contentWarnings: null,
  categoryLabel: "Automation",
  visibility: "private",
  sortOrder: 0,
  createdByUserId: "domain-user",
  updatedByUserId: "domain-user",
  createdAt: "2026-07-09T20:00:00.000Z",
  updatedAt: "2026-07-09T20:00:00.000Z",
  ...overrides
});

const createSuggestion = (
  id: string,
  overrides: Partial<GameSuggestionSource> = {}
): GameSuggestionSource => ({
  id,
  title: `Suggestion ${id}`,
  platformLabel: "PC",
  storeUrl: "https://example.com/suggested-game",
  reason: "Looks good for stream.",
  tags: ["automation"],
  suggestedByUserId: null,
  suggestedByName: "Viewer",
  status: "pending",
  linkedGameId: null,
  reviewerUserId: null,
  reviewerNote: null,
  reviewedAt: null,
  isPublic: false,
  createdAt: "2026-07-09T20:00:00.000Z",
  updatedAt: "2026-07-09T20:00:00.000Z",
  ...overrides
});

const createScheduleAssociation = (
  scheduleEntryId: string,
  overrides: Partial<GameScheduleAssociationSummary> = {}
): GameScheduleAssociationSummary => ({
  scheduleEntryId,
  title: `Stream ${scheduleEntryId}`,
  startsAt: "2026-08-27T20:00:00.000Z",
  endsAt: null,
  channelKey: "main",
  visibility: "private",
  status: "planned",
  relationship: "planned",
  publicNote: null,
  sortOrder: 0,
  ...overrides
});

class FakeGameLibraryRepository implements GameLibraryRepository {
  public actor: GameLibraryAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly games = new Map<string, GameLibrarySource>();
  public readonly suggestions = new Map<string, GameSuggestionSource>();
  public readonly scheduleAssociations = new Map<string, readonly GameScheduleAssociationSummary[]>();

  public async resolveActor(): Promise<GameLibraryAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listGames(): Promise<readonly GameLibrarySource[]> {
    return [...this.games.values()].map((game) => structuredClone(game));
  }

  public async listGameScheduleAssociations(
    gameIds: readonly string[]
  ): Promise<ReadonlyMap<string, readonly GameScheduleAssociationSummary[]>> {
    const associationsByGameId = new Map<string, readonly GameScheduleAssociationSummary[]>();

    for (const gameId of gameIds) {
      associationsByGameId.set(
        gameId,
        (this.scheduleAssociations.get(gameId) ?? []).map((association) => structuredClone(association))
      );
    }

    return associationsByGameId;
  }

  public async listSuggestions(): Promise<readonly GameSuggestionSource[]> {
    return [...this.suggestions.values()].map((suggestion) => structuredClone(suggestion));
  }

  public async getGame(id: string): Promise<GameLibrarySource | null> {
    const game = this.games.get(id);
    return game ? structuredClone(game) : null;
  }

  public async createGame(input: GameLibraryCreateInput & {
    slug: string;
    actorUserId: string;
  }): Promise<GameLibrarySource> {
    if ([...this.games.values()].some((game) => game.slug === input.slug)) {
      throw new Error("game_library_slug_conflict");
    }

    const game = createGame(`game-${this.games.size + 1}`, {
      slug: input.slug,
      title: input.title,
      platformLabel: input.platformLabel ?? null,
      storeProvider: input.storeProvider ?? null,
      storeUrl: input.storeUrl ?? null,
      ownershipStatus: input.ownershipStatus,
      interestStatus: input.interestStatus,
      streamFitNote: input.streamFitNote ?? null,
      contentWarnings: input.contentWarnings ?? null,
      categoryLabel: input.categoryLabel ?? null,
      visibility: input.visibility,
      sortOrder: input.sortOrder ?? 0,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId
    });
    this.games.set(game.id, game);

    return structuredClone(game);
  }

  public async updateGame(id: string, input: GameLibraryUpdateInput & {
    slug?: string;
    actorUserId: string;
  }): Promise<GameLibrarySource | "not-found" | "slug-conflict"> {
    const existing = this.games.get(id);

    if (!existing) {
      return "not-found";
    }

    if (input.slug && [...this.games.values()].some((game) => game.id !== id && game.slug === input.slug)) {
      return "slug-conflict";
    }

    const next = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.platformLabel !== undefined ? { platformLabel: input.platformLabel?.trim() || null } : {}),
      ...(input.storeProvider !== undefined ? { storeProvider: input.storeProvider?.trim() || null } : {}),
      ...(input.storeUrl !== undefined ? { storeUrl: input.storeUrl?.trim() || null } : {}),
      ...(input.ownershipStatus !== undefined ? { ownershipStatus: input.ownershipStatus } : {}),
      ...(input.interestStatus !== undefined ? { interestStatus: input.interestStatus } : {}),
      ...(input.streamFitNote !== undefined ? { streamFitNote: input.streamFitNote?.trim() || null } : {}),
      ...(input.contentWarnings !== undefined ? { contentWarnings: input.contentWarnings?.trim() || null } : {}),
      ...(input.categoryLabel !== undefined ? { categoryLabel: input.categoryLabel?.trim() || null } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedByUserId: input.actorUserId,
      updatedAt: "2026-07-09T21:00:00.000Z"
    } satisfies GameLibrarySource;
    this.games.set(id, next);

    return structuredClone(next);
  }

  public async listPublicGames(): Promise<readonly GameLibrarySource[]> {
    return [...this.games.values()]
      .filter((game) => game.visibility === "public")
      .map((game) => structuredClone(game));
  }

  public async createSuggestion(input: PublicGameSuggestionInput): Promise<GameSuggestionSource> {
    const suggestion = createSuggestion(`suggestion-${this.suggestions.size + 1}`, {
      title: input.title,
      platformLabel: input.platformLabel ?? null,
      storeUrl: input.storeUrl ?? null,
      reason: input.reason ?? null,
      tags: input.tags ?? [],
      suggestedByName: input.suggestedByName ?? null
    });
    this.suggestions.set(suggestion.id, suggestion);
    return structuredClone(suggestion);
  }

  public async reviewSuggestion(id: string, input: GameSuggestionReviewInput & {
    reviewerUserId: string;
  }): Promise<GameSuggestionSource | "not-found" | "invalid-game"> {
    const suggestion = this.suggestions.get(id);

    if (!suggestion) {
      return "not-found";
    }

    if (input.linkedGameId && !this.games.has(input.linkedGameId)) {
      return "invalid-game";
    }

    const next = {
      ...suggestion,
      status: input.status,
      linkedGameId: input.linkedGameId ?? null,
      reviewerUserId: input.reviewerUserId,
      reviewerNote: input.reviewerNote ?? null,
      reviewedAt: "2026-07-09T21:00:00.000Z",
      updatedAt: "2026-07-09T21:00:00.000Z"
    } satisfies GameSuggestionSource;
    this.suggestions.set(id, next);
    return structuredClone(next);
  }
}

describe("GameLibraryService", () => {
  it("allows owner wildcard and typed game library permission", async () => {
    const repository = new FakeGameLibraryRepository();
    const service = new GameLibraryService(repository);

    await expect(service.listGames({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true,
      suggestions: []
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["game-library:manage"])]
    };

    await expect(service.createGame({
      authUserId: "auth-user",
      game: {
        title: "Satisfactory",
        ownershipStatus: "owned",
        interestStatus: "currently-playing",
        visibility: "public"
      }
    })).resolves.toMatchObject({
      ok: true,
      game: {
        slug: "satisfactory",
        visibility: "public"
      }
    });
  });

  it("adds only relevant planned or live schedule summaries to admin games", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.games.set("game-1", createGame("game-1"));
    repository.scheduleAssociations.set("game-1", [
      createScheduleAssociation("past-planned", {
        startsAt: "2026-08-26T20:00:00.000Z"
      }),
      createScheduleAssociation("future-later", {
        title: "Future later",
        startsAt: "2026-08-29T20:00:00.000Z",
        sortOrder: 1
      }),
      createScheduleAssociation("future-first", {
        title: "Future first",
        startsAt: "2026-08-28T20:00:00.000Z",
        relationship: "current"
      }),
      createScheduleAssociation("live-now", {
        title: "Live now",
        startsAt: "2026-08-27T10:00:00.000Z",
        status: "live",
        relationship: "current"
      }),
      createScheduleAssociation("ending-future", {
        title: "Ending future",
        startsAt: "2026-08-26T20:00:00.000Z",
        endsAt: "2026-08-27T13:00:00.000Z"
      })
    ]);
    const service = new GameLibraryService(repository, () => new Date("2026-08-27T12:00:00.000Z"));

    const result = await service.listGames({ authUserId: "auth-user" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.games[0]?.scheduleAssociations.map((association) => association.scheduleEntryId)).toEqual([
      "live-now",
      "future-first",
      "future-later"
    ]);
    expect(result.games[0]).not.toHaveProperty("createdByUserId");
    expect(result.games[0]).not.toHaveProperty("updatedByUserId");
  });

  it("accepts public game suggestions as private pending records", async () => {
    const repository = new FakeGameLibraryRepository();
    const service = new GameLibraryService(repository);

    await expect(service.createSuggestion({
      title: "Factorio",
      platformLabel: "PC",
      reason: "Automation classic.",
      tags: ["automation"],
      suggestedByName: "Viewer"
    })).resolves.toMatchObject({
      ok: true,
      suggestion: {
        title: "Factorio",
        status: "pending",
        isPublic: false
      }
    });

    await expect(service.createSuggestion({
      title: "",
      tags: []
    })).resolves.toEqual({
      ok: false,
      reason: "game_suggestion_invalid_input"
    });
  });

  it("allows owners to review suggestions", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.suggestions.set("suggestion-1", createSuggestion("suggestion-1"));
    repository.games.set("game-1", createGame("game-1"));
    const service = new GameLibraryService(repository);

    await expect(service.reviewSuggestion({
      authUserId: "auth-user",
      suggestionId: "suggestion-1",
      review: {
        status: "accepted",
        reviewerNote: "Added to library.",
        linkedGameId: "game-1"
      }
    })).resolves.toMatchObject({
      ok: true,
      suggestion: {
        status: "accepted",
        linkedGameId: "game-1",
        reviewerUserId: "domain-user"
      }
    });
  });

  it("denies unlinked and normal linked users", async () => {
    const repository = new FakeGameLibraryRepository();
    const service = new GameLibraryService(repository);

    repository.actor = null;
    await expect(service.listGames({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "game_library_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["page-creator:manage"]]
    };

    await expect(service.createGame({
      authUserId: "auth-user",
      game: {
        title: "Nope",
        ownershipStatus: "owned",
        interestStatus: "interested",
        visibility: "private"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "game_library_admin_forbidden"
    });
  });

  it("rejects invalid input and duplicate slugs", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.games.set("existing", createGame("existing", { slug: "satisfactory" }));
    const service = new GameLibraryService(repository);

    await expect(service.createGame({
      authUserId: "auth-user",
      game: {
        title: "",
        ownershipStatus: "owned",
        interestStatus: "interested",
        visibility: "private"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "game_library_invalid_input"
    });

    await expect(service.createGame({
      authUserId: "auth-user",
      game: {
        title: "Satisfactory",
        slug: "satisfactory",
        ownershipStatus: "owned",
        interestStatus: "currently-playing",
        visibility: "public"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "game_library_slug_conflict"
    });
  });

  it("updates games and lists only public curated records publicly", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.games.set("private", createGame("private", { visibility: "private" }));
    repository.games.set("public", createGame("public", { visibility: "public" }));
    const service = new GameLibraryService(repository);

    await expect(service.updateGame({
      authUserId: "auth-user",
      gameId: "private",
      game: {
        visibility: "public",
        interestStatus: "maybe-later"
      }
    })).resolves.toMatchObject({
      ok: true,
      game: {
        visibility: "public",
        interestStatus: "maybe-later"
      }
    });

    await expect(service.listPublicGames()).resolves.toMatchObject({
      ok: true,
      games: [
        {
          slug: "private"
        },
        {
          slug: "public"
        }
      ]
    });
  });
});

describe("game library store boundaries", () => {
  it("reads schedule summaries from existing link and schedule tables without audit identities", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const repository = createGameLibraryRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });

        return [[{
          gameId: "game-1",
          scheduleEntryId: "stream-1",
          title: "Upcoming stream",
          startsAt: new Date("2026-08-28T20:00:00.000Z"),
          endsAt: null,
          channelKey: "main",
          visibility: "private",
          status: "planned",
          relationship: "planned",
          publicNote: null,
          sortOrder: 0
        }], []];
      }
    } as never);

    await expect(repository.listGameScheduleAssociations(
      ["game-1", "game-1", "game-2"],
      new Date("2026-08-27T12:00:00.000Z")
    )).resolves.toEqual(new Map([
      ["game-1", [
        {
          scheduleEntryId: "stream-1",
          title: "Upcoming stream",
          startsAt: "2026-08-28T20:00:00.000Z",
          endsAt: null,
          channelKey: "main",
          visibility: "private",
          status: "planned",
          relationship: "planned",
          publicNote: null,
          sortOrder: 0
        }
      ]]
    ]));
    expect(calls[0]?.sql).toContain("FROM game_schedule_links");
    expect(calls[0]?.sql).toContain("INNER JOIN stream_schedule_entries");
    expect(calls[0]?.sql).toContain("game_schedule_links.relationship IN ('planned', 'current')");
    expect(calls[0]?.sql).toContain("stream_schedule_entries.status IN ('planned', 'live')");
    expect(calls[0]?.sql).toContain("stream_schedule_entries.starts_at >= ?");
    expect(calls[0]?.sql).toContain("ORDER BY stream_schedule_entries.starts_at, game_schedule_links.sort_order, stream_schedule_entries.title");
    expect(calls[0]?.sql).not.toContain("created_by_user_id");
    expect(calls[0]?.sql).not.toContain("updated_by_user_id");
    expect(calls[0]?.parameters).toEqual(["game-1", "game-2", new Date("2026-08-27T12:00:00.000Z")]);
  });
});

describe("game library routes", () => {
  it("requires authentication for admin routes and exposes public games without auth", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.games.set("public", createGame("public", { visibility: "public" }));
    const service = new GameLibraryService(repository);
    const server = Fastify();

    registerGameLibraryRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("not used");
      },
      createService: () => service
    });

    const adminResponse = await server.inject({
      method: "GET",
      url: "/admin/games"
    });
    expect(adminResponse.statusCode).toBe(401);

    const publicResponse = await server.inject({
      method: "GET",
      url: "/games"
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json()).toMatchObject({
      ok: true,
      games: [
        {
          slug: "public"
        }
      ]
    });
    await server.close();
  });

  it("returns sanitized admin game schedule summaries without raw creator updater ids", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.games.set("game-1", createGame("game-1"));
    repository.scheduleAssociations.set("game-1", [
      createScheduleAssociation("stream-1", {
        title: "Zomboid test stream",
        startsAt: "2026-08-28T20:00:00.000Z",
        publicNote: "Main plan."
      })
    ]);
    const service = new GameLibraryService(repository, () => new Date("2026-08-27T12:00:00.000Z"));
    const server = Fastify();

    registerGameLibraryRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("not used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/games"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ ok: true; games: readonly GameLibraryAdminEntry[] }>();
    expect(payload.games[0]).toMatchObject({
      id: "game-1",
      scheduleAssociations: [
        {
          scheduleEntryId: "stream-1",
          title: "Zomboid test stream",
          startsAt: "2026-08-28T20:00:00.000Z",
          status: "planned",
          relationship: "planned",
          publicNote: "Main plan."
        }
      ]
    });
    expect(payload.games[0]).not.toHaveProperty("createdByUserId");
    expect(payload.games[0]).not.toHaveProperty("updatedByUserId");
    await server.close();
  });

  it("maps create and update responses", async () => {
    const repository = new FakeGameLibraryRepository();
    const service = new GameLibraryService(repository);
    const server = Fastify();

    registerGameLibraryRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("not used");
      },
      createService: () => service
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/admin/games",
      payload: {
        title: "Minecraft",
        ownershipStatus: "owned",
        interestStatus: "interested",
        visibility: "private"
      }
    });
    expect(createResponse.statusCode).toBe(200);
    const gameId = createResponse.json<{ game: GameLibraryAdminEntry }>().game.id;

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/admin/games/${gameId}`,
      payload: {
        visibility: "public",
        sortOrder: 5
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      ok: true,
      game: {
        visibility: "public",
        sortOrder: 5
      }
    });
    await server.close();
  });

  it("accepts public suggestions and protects suggestion review", async () => {
    const repository = new FakeGameLibraryRepository();
    repository.games.set("game-1", createGame("game-1"));
    const service = new GameLibraryService(repository);
    const publicServer = Fastify();

    registerGameLibraryRoutes(publicServer, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("not used");
      },
      createService: () => service
    });

    const suggestionResponse = await publicServer.inject({
      method: "POST",
      url: "/games/suggestions",
      payload: {
        title: "Factorio",
        platformLabel: "PC",
        reason: "Automation classic.",
        tags: ["automation"],
        suggestedByName: "Viewer"
      }
    });
    expect(suggestionResponse.statusCode).toBe(200);
    expect(suggestionResponse.json()).toMatchObject({
      ok: true,
      suggestion: {
        title: "Factorio",
        status: "pending",
        isPublic: false
      }
    });
    const suggestionId = suggestionResponse.json<{ suggestion: GameSuggestionSource }>().suggestion.id;

    const unauthenticatedReviewResponse = await publicServer.inject({
      method: "PATCH",
      url: `/admin/games/suggestions/${suggestionId}`,
      payload: {
        status: "accepted"
      }
    });
    expect(unauthenticatedReviewResponse.statusCode).toBe(401);
    await publicServer.close();

    const adminServer = Fastify();
    registerGameLibraryRoutes(adminServer, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("not used");
      },
      createService: () => service
    });

    const reviewResponse = await adminServer.inject({
      method: "PATCH",
      url: `/admin/games/suggestions/${suggestionId}`,
      payload: {
        status: "accepted",
        reviewerNote: "Added to the list.",
        linkedGameId: "game-1"
      }
    });
    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewResponse.json()).toMatchObject({
      ok: true,
      suggestion: {
        status: "accepted",
        linkedGameId: "game-1",
        reviewerUserId: "domain-user"
      }
    });
    await adminServer.close();
  });
});
