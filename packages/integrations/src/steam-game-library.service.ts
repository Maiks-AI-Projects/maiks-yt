import {
  createSteamGameLibraryPreviewFailure,
  projectSteamOwnedGamesResponse
} from "./steam-game-library.rules.js";
import { getSteamGameLibraryConfig } from "./steam-game-library.config.js";
import type {
  SteamGameLibraryEnvironment,
  SteamGameLibraryPreviewResult,
  SteamOwnedGamesFetch
} from "./steam-game-library.types.js";

const steamOwnedGamesEndpoint = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";

const parseJson = async (response: Response): Promise<unknown | null> => {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
};

export const fetchSteamOwnedGamesPreview = async (input: {
  env: SteamGameLibraryEnvironment;
  fetchOwnedGames?: SteamOwnedGamesFetch;
  timeoutMs?: number;
}): Promise<SteamGameLibraryPreviewResult> => {
  const config = getSteamGameLibraryConfig(input.env);

  if (!config.ok) {
    return createSteamGameLibraryPreviewFailure(
      config.state === "missing" ? "missing_config" : "invalid_config"
    );
  }

  const requestUrl = new URL(steamOwnedGamesEndpoint);
  requestUrl.searchParams.set("key", config.apiKey);
  requestUrl.searchParams.set("steamid", config.ownerId);
  requestUrl.searchParams.set("include_appinfo", "true");
  requestUrl.searchParams.set("include_played_free_games", "true");
  requestUrl.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000);

  try {
    const response = await (input.fetchOwnedGames ?? fetch)(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      redirect: "error",
      signal: controller.signal
    });

    if (response.status === 401 || response.status === 403) {
      return createSteamGameLibraryPreviewFailure("invalid_credentials");
    }

    if (response.status === 429) {
      return createSteamGameLibraryPreviewFailure("rate_limited");
    }

    if (!response.ok) {
      return createSteamGameLibraryPreviewFailure("provider_unavailable");
    }

    const payload = await parseJson(response);

    return payload === null
      ? createSteamGameLibraryPreviewFailure("malformed_response")
      : projectSteamOwnedGamesResponse(payload);
  } catch {
    return createSteamGameLibraryPreviewFailure("network_failure");
  } finally {
    clearTimeout(timeout);
  }
};
