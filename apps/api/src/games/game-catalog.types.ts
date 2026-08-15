import type {
  GameCatalogCandidate,
  GameCatalogSearchResult
} from "@maiks-yt/domain/games";
import type { SteamCatalogSearchFetch } from "@maiks-yt/integrations";

import type { GameLibraryAdminActor } from "./game-library.types.js";

export interface GameCatalogRepository {
  resolveActor(authUserId: string): Promise<GameLibraryAdminActor | null>;
  searchCached(query: string): Promise<readonly GameCatalogSearchResult[]>;
  cacheCandidates(candidates: readonly GameCatalogCandidate[]): Promise<void>;
}

export type GameCatalogSearchServiceResult =
  | {
    ok: true;
    query: string;
    providerState: "ready" | "rate_limited" | "malformed_response" | "network_failure" | "provider_unavailable";
    cacheOnly: boolean;
    results: readonly GameCatalogSearchResult[];
  }
  | {
    ok: false;
    reason:
      | "game_catalog_invalid_query"
      | "game_library_admin_user_unlinked"
      | "game_library_admin_forbidden";
  };

export type GameCatalogServiceOptions = {
  fetchSteamSearch?: SteamCatalogSearchFetch;
};
