import {
  isValidSteamAppId,
  projectSteamPopularityResponse
} from "./steam-popularity.rules.js";
import type {
  SteamPopularityFetch,
  SteamPopularityResult
} from "./steam-popularity.types.js";

export const fetchSteamPopularity = async (input: {
  appId: number;
  fetchPopularity?: SteamPopularityFetch;
  timeoutMs?: number;
}): Promise<SteamPopularityResult> => {
  if (!isValidSteamAppId(input.appId)) {
    return { ok: false, appId: input.appId, state: "invalid_app_id" };
  }

  const fetchPopularity = input.fetchPopularity ?? fetch;

  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/"
    );
    url.searchParams.set("appid", String(input.appId));

    const response = await fetchPopularity(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(input.timeoutMs ?? 5_000)
    });

    if (!response.ok) {
      return { ok: false, appId: input.appId, state: "provider_unavailable" };
    }

    try {
      return projectSteamPopularityResponse(input.appId, await response.json() as unknown);
    } catch {
      return { ok: false, appId: input.appId, state: "malformed_response" };
    }
  } catch {
    return { ok: false, appId: input.appId, state: "network_failure" };
  }
};
