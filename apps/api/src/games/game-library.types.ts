import type {
  GameLibraryAdminInput,
  GameLibraryAdminEntry,
  GameLibraryAdminUpdateInput,
  GameScheduleAssociationSummary,
  GameSuggestionReviewInput,
  GameSuggestionSource,
  GameLibrarySource,
  PublicGameSuggestionInput,
  PublicGameLibraryEntry
} from "@maiks-yt/domain/games";

export type GameLibraryAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type GameLibraryCreateInput = GameLibraryAdminInput;
export type GameLibraryUpdateInput = GameLibraryAdminUpdateInput;

export type GameLibraryAdminListResult =
  | {
    ok: true;
    games: readonly GameLibraryAdminEntry[];
    suggestions: readonly GameSuggestionSource[];
  }
  | {
    ok: false;
    reason: "game_library_admin_user_unlinked" | "game_library_admin_forbidden";
  };

export type GameLibraryAdminMutationResult =
  | {
    ok: true;
    game: GameLibraryAdminEntry;
  }
  | {
    ok: false;
    reason:
      | "game_library_admin_user_unlinked"
      | "game_library_admin_forbidden"
      | "game_library_not_found"
      | "game_library_invalid_input"
      | "game_library_slug_conflict";
  };

export type PublicGameLibraryListResult = {
  ok: true;
  games: readonly PublicGameLibraryEntry[];
};

export type PublicGameSuggestionCreateResult =
  | {
    ok: true;
    suggestion: GameSuggestionSource;
  }
  | {
    ok: false;
    reason: "game_suggestion_invalid_input";
  };

export type GameSuggestionReviewResult =
  | {
    ok: true;
    suggestion: GameSuggestionSource;
  }
  | {
    ok: false;
    reason:
      | "game_library_admin_user_unlinked"
      | "game_library_admin_forbidden"
      | "game_suggestion_not_found"
      | "game_suggestion_invalid_input";
  };

export interface GameLibraryRepository {
  resolveActor(authUserId: string): Promise<GameLibraryAdminActor | null>;
  listGames(): Promise<readonly GameLibrarySource[]>;
  listGameScheduleAssociations(
    gameIds: readonly string[],
    now: Date
  ): Promise<ReadonlyMap<string, readonly GameScheduleAssociationSummary[]>>;
  listSuggestions(): Promise<readonly GameSuggestionSource[]>;
  getGame(id: string): Promise<GameLibrarySource | null>;
  createGame(input: GameLibraryCreateInput & {
    slug: string;
    actorUserId: string;
  }): Promise<GameLibrarySource>;
  updateGame(id: string, input: GameLibraryUpdateInput & {
    slug?: string;
    actorUserId: string;
  }): Promise<GameLibrarySource | "not-found" | "slug-conflict">;
  listPublicGames(): Promise<readonly GameLibrarySource[]>;
  createSuggestion(input: PublicGameSuggestionInput): Promise<GameSuggestionSource>;
  reviewSuggestion(id: string, input: GameSuggestionReviewInput & {
    reviewerUserId: string;
  }): Promise<GameSuggestionSource | "not-found" | "invalid-game">;
}
