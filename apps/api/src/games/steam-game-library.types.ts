import type {
  SteamGameLibraryConnectionStatus,
  SteamGameLibraryEnvironment,
  SteamGameLibraryPreviewResult,
  SteamOwnedGamesFetch,
  SteamStoreAppFetch,
  SteamWishlistFetch,
  SteamWishlistPreviewResult
} from "@maiks-yt/integrations";
import type { GameCatalogCandidate } from "@maiks-yt/domain/games";

export type SteamGameLibraryActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export interface SteamGameLibraryRepository {
  resolveActor(authUserId: string): Promise<SteamGameLibraryActor | null>;
  cacheCandidates(candidates: readonly GameCatalogCandidate[]): Promise<void>;
}

export type SteamGameLibraryAccessFailure = {
  ok: false;
  reason: "game_library_admin_user_unlinked" | "game_library_admin_forbidden";
};

export type SteamGameLibraryStatusResult =
  | SteamGameLibraryConnectionStatus
  | SteamGameLibraryAccessFailure;

export type SteamGameLibraryServicePreviewResult =
  | SteamGameLibraryPreviewResult
  | SteamGameLibraryAccessFailure;

export type SteamWishlistServicePreviewResult =
  | SteamWishlistPreviewResult
  | SteamGameLibraryAccessFailure;

export type SteamGameLibraryServiceOptions = {
  env?: SteamGameLibraryEnvironment;
  fetchOwnedGames?: SteamOwnedGamesFetch;
  fetchWishlist?: SteamWishlistFetch;
  fetchStoreApp?: SteamStoreAppFetch;
};
