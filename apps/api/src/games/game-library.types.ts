import type {
  GameLibraryAdminInput,
  GameLibraryAdminUpdateInput,
  GameLibrarySource,
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
    games: readonly GameLibrarySource[];
  }
  | {
    ok: false;
    reason: "game_library_admin_user_unlinked" | "game_library_admin_forbidden";
  };

export type GameLibraryAdminMutationResult =
  | {
    ok: true;
    game: GameLibrarySource;
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

export interface GameLibraryRepository {
  resolveActor(authUserId: string): Promise<GameLibraryAdminActor | null>;
  listGames(): Promise<readonly GameLibrarySource[]>;
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
}
