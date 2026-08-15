export type SteamCatalogSearchItem = {
  appId: number;
  title: string;
  artworkUrl: string | null;
};

export type SteamCatalogSearchFailureState =
  | "invalid_query"
  | "rate_limited"
  | "malformed_response"
  | "network_failure"
  | "provider_unavailable";

export type SteamCatalogSearchResult =
  | {
    ok: true;
    provider: "steam";
    items: readonly SteamCatalogSearchItem[];
  }
  | {
    ok: false;
    provider: "steam";
    state: SteamCatalogSearchFailureState;
    message: string;
  };

export type SteamCatalogSearchFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;
