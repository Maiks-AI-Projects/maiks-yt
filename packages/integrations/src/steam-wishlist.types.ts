import type {
  SteamGameLibraryEnvironment,
  SteamGameLibraryPreviewFailureState,
  SteamStoreAppFetch,
  SteamWishlistFetch
} from "./steam-game-library.types.js";

export type SteamWishlistItemPreview = {
  appId: number;
  title: string | null;
  priority: number;
  dateAddedAt: string;
  storeUrl: string;
};

export type SteamWishlistPreviewResult =
  | {
    ok: true;
    provider: "steam";
    state: "ready";
    readOnly: true;
    itemCount: number;
    items: readonly SteamWishlistItemPreview[];
  }
  | {
    ok: false;
    provider: "steam";
    state: SteamGameLibraryPreviewFailureState;
    readOnly: true;
    message: string;
  };

export type SteamWishlistPreviewInput = {
  env: SteamGameLibraryEnvironment;
  fetchWishlist?: SteamWishlistFetch;
  fetchStoreApp?: SteamStoreAppFetch;
  timeoutMs?: number;
};
