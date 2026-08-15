export type SteamPopularityFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export type SteamPopularityResult =
  | {
    ok: true;
    appId: number;
    playerCount: number;
  }
  | {
    ok: false;
    appId: number;
    state: "invalid_app_id" | "provider_unavailable" | "malformed_response" | "network_failure";
  };
