import {
  buildGameLibraryAdminEntry,
  buildGameSuggestionAdminEntry,
  buildPublicGameLibraryEntry,
  canManageGameLibrary,
  createGameSlugFromTitle,
  isValidGameLibraryAdminInput,
  isValidGameSuggestionReviewInput,
  isValidPublicGameSuggestionInput,
  normalizeGameSuggestionReviewInput,
  normalizeGameSlug,
  normalizePublicGameSuggestionInput,
  type GameLibraryAdminInput,
  type GameLibraryAdminUpdateInput,
  type GameLibrarySource,
  type GameSuggestionReviewInput,
  type PublicGameSuggestionInput
} from "@maiks-yt/domain/games";

import type {
  GameLibraryAdminActor,
  GameLibraryAdminListResult,
  GameLibraryAdminMutationResult,
  GameLibraryRepository,
  GameLibraryUpdateInput,
  GameSuggestionReviewResult,
  PublicGameSuggestionCreateResult,
  PublicGameLibraryListResult
} from "./game-library.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeGameLibraryPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const normalizeOptionalText = (value: string | null | undefined): string | null | undefined =>
  value === undefined ? undefined : value?.trim() || null;

const normalizeSortOrder = (value: number | undefined): number =>
  value ?? 0;

const normalizeInput = (
  input: GameLibraryAdminInput
): GameLibraryAdminInput & { slug: string } | "invalid" => {
  const rawSlug = input.slug?.trim() || createGameSlugFromTitle(input.title);
  const slug = normalizeGameSlug(rawSlug);

  if (!slug.ok) {
    return "invalid";
  }

  const game = {
    title: input.title.trim(),
    slug: slug.slug,
    platformLabel: normalizeOptionalText(input.platformLabel),
    storeProvider: normalizeOptionalText(input.storeProvider),
    storeUrl: normalizeOptionalText(input.storeUrl),
    ownershipStatus: input.ownershipStatus,
    interestStatus: input.interestStatus,
    streamFitNote: normalizeOptionalText(input.streamFitNote),
    contentWarnings: normalizeOptionalText(input.contentWarnings),
    categoryLabel: normalizeOptionalText(input.categoryLabel),
    visibility: input.visibility,
    sortOrder: normalizeSortOrder(input.sortOrder)
  };

  return isValidGameLibraryAdminInput(game) ? game : "invalid";
};

const mergeDefinedUpdate = (
  existing: GameLibraryAdminInput,
  update: GameLibraryAdminUpdateInput
): GameLibraryAdminInput => {
  const next = { ...existing };

  for (const [key, value] of Object.entries(update) as Array<[keyof GameLibraryUpdateInput, GameLibraryUpdateInput[keyof GameLibraryUpdateInput]]>) {
    if (value !== undefined) {
      Object.assign(next, { [key]: value });
    }
  }

  return next;
};

export class GameLibraryService {
  public constructor(
    private readonly repository: GameLibraryRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async listGames(input: { authUserId: string }): Promise<GameLibraryAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const now = this.now();
    const games = await this.repository.listGames();
    const scheduleAssociationsByGameId = await this.repository.listGameScheduleAssociations(
      games.map((game) => game.id),
      now
    );

    return {
      ok: true,
      games: games.map((game) => buildGameLibraryAdminEntry(
        game,
        scheduleAssociationsByGameId.get(game.id) ?? [],
        now
      )),
      suggestions: (await this.repository.listSuggestions()).map(buildGameSuggestionAdminEntry)
    };
  }

  public async createGame(input: {
    authUserId: string;
    game: GameLibraryAdminInput;
  }): Promise<GameLibraryAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const game = normalizeInput(input.game);

    if (game === "invalid") {
      return {
        ok: false,
        reason: "game_library_invalid_input"
      };
    }

    try {
      return {
        ok: true,
        game: await this.createAdminEntry(await this.repository.createGame({
          ...game,
          actorUserId: actor.domainUserId
        }))
      };
    } catch (error) {
      if (error instanceof Error && error.message === "game_library_slug_conflict") {
        return {
          ok: false,
          reason: "game_library_slug_conflict"
        };
      }

      throw error;
    }
  }

  public async updateGame(input: {
    authUserId: string;
    gameId: string;
    game: GameLibraryAdminUpdateInput;
  }): Promise<GameLibraryAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (Object.keys(input.game).length === 0) {
      return {
        ok: false,
        reason: "game_library_invalid_input"
      };
    }

    const existing = await this.repository.getGame(input.gameId);

    if (!existing) {
      return {
        ok: false,
        reason: "game_library_not_found"
      };
    }

    const merged = mergeDefinedUpdate({
      title: existing.title,
      slug: existing.slug,
      platformLabel: existing.platformLabel,
      storeProvider: existing.storeProvider,
      storeUrl: existing.storeUrl,
      ownershipStatus: existing.ownershipStatus,
      interestStatus: existing.interestStatus,
      streamFitNote: existing.streamFitNote,
      contentWarnings: existing.contentWarnings,
      categoryLabel: existing.categoryLabel,
      visibility: existing.visibility,
      sortOrder: existing.sortOrder
    }, input.game);
    const game = normalizeInput(merged);

    if (game === "invalid") {
      return {
        ok: false,
        reason: "game_library_invalid_input"
      };
    }

    const repositoryUpdate = {
      ...input.game,
      actorUserId: actor.domainUserId
    } as GameLibraryUpdateInput & {
      slug?: string;
      actorUserId: string;
    };

    if (input.game.slug !== undefined || input.game.title !== undefined) {
      repositoryUpdate.slug = game.slug;
    }

    const result = await this.repository.updateGame(input.gameId, repositoryUpdate);

    if (result === "not-found") {
      return {
        ok: false,
        reason: "game_library_not_found"
      };
    }

    if (result === "slug-conflict") {
      return {
        ok: false,
        reason: "game_library_slug_conflict"
      };
    }

    return {
      ok: true,
      game: await this.createAdminEntry(result)
    };
  }

  public async listPublicGames(): Promise<PublicGameLibraryListResult> {
    return {
      ok: true,
      games: (await this.repository.listPublicGames())
        .map(buildPublicGameLibraryEntry)
        .filter((game): game is NonNullable<typeof game> => game !== null)
    };
  }

  public async createSuggestion(input: PublicGameSuggestionInput): Promise<PublicGameSuggestionCreateResult> {
    const suggestion = normalizePublicGameSuggestionInput(input);

    if (!isValidPublicGameSuggestionInput(suggestion)) {
      return {
        ok: false,
        reason: "game_suggestion_invalid_input"
      };
    }

    await this.repository.createSuggestion(suggestion);

    return {
      ok: true,
      accepted: true
    };
  }

  public async reviewSuggestion(input: {
    authUserId: string;
    suggestionId: string;
    review: GameSuggestionReviewInput;
  }): Promise<GameSuggestionReviewResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const review = normalizeGameSuggestionReviewInput(input.review);

    if (!isValidGameSuggestionReviewInput(review)) {
      return {
        ok: false,
        reason: "game_suggestion_invalid_input"
      };
    }

    const result = await this.repository.reviewSuggestion(input.suggestionId, {
      ...review,
      reviewerUserId: actor.domainUserId
    });

    return result === "not-found"
      ? {
        ok: false,
        reason: "game_suggestion_not_found"
      }
      : result === "invalid-game"
        ? {
          ok: false,
          reason: "game_suggestion_invalid_input"
        }
        : {
          ok: true,
          suggestion: buildGameSuggestionAdminEntry(result)
        };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "game_library_admin_user_unlinked" | "game_library_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "game_library_admin_user_unlinked"
      };
    }

    if (!this.canManage(actor)) {
      return {
        ok: false,
        reason: "game_library_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }

  private canManage(actor: GameLibraryAdminActor): boolean {
    return canManageGameLibrary(normalizeGameLibraryPermissions(actor.rolePermissionValues));
  }

  private async createAdminEntry(game: GameLibrarySource) {
    const now = this.now();
    const scheduleAssociationsByGameId = await this.repository.listGameScheduleAssociations([game.id], now);

    return buildGameLibraryAdminEntry(
      game,
      scheduleAssociationsByGameId.get(game.id) ?? [],
      now
    );
  }
}
