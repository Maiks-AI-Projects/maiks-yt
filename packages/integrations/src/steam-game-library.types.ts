export type SteamGameLibraryEnvironment = Record<string, string | undefined>;

export type SteamGameLibraryConnectionState = "configured" | "missing" | "invalid";

export type SteamGameLibraryConnectionStatus = {
  ok: true;
  provider: "steam";
  state: SteamGameLibraryConnectionState;
  configured: boolean;
  readOnly: true;
  detail: string;
};

export type SteamOwnedGamePreview = {
  appId: number;
  title: string;
  iconUrl: string | null;
  playtimeMinutes: number;
  recentPlaytimeMinutes: number | null;
};

export type SteamGameLibraryPreviewFailureState =
  | "missing_config"
  | "invalid_config"
  | "private_library"
  | "invalid_credentials"
  | "rate_limited"
  | "malformed_response"
  | "network_failure"
  | "provider_unavailable";

export type SteamGameLibraryPreviewResult =
  | {
    ok: true;
    provider: "steam";
    state: "ready";
    readOnly: true;
    gameCount: number;
    games: readonly SteamOwnedGamePreview[];
  }
  | {
    ok: false;
    provider: "steam";
    state: SteamGameLibraryPreviewFailureState;
    readOnly: true;
    message: string;
  };

export type SteamOwnedGamesFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export type SteamWishlistFetch = SteamOwnedGamesFetch;

export type SteamStoreAppFetch = SteamOwnedGamesFetch;
