import type {
  SteamGameLibraryConnectionStatus,
  SteamGameLibraryEnvironment,
  SteamGameLibraryPreviewFailureState,
  SteamGameLibraryPreviewResult,
  SteamOwnedGamePreview
} from "./steam-game-library.types.js";
import { getSteamGameLibraryConfig } from "./steam-game-library.config.js";
const steamIconHashPattern = /^[a-f0-9]{40}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isSafeInteger(value)
  && value >= 0;

const normalizeTitle = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ");

  return normalized.length > 0 && normalized.length <= 300 ? normalized : null;
};

const projectIconUrl = (appId: number, value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const iconHash = value.trim();

  return steamIconHashPattern.test(iconHash)
    ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${iconHash}.jpg`
    : null;
};

const previewFailureMessages: Record<SteamGameLibraryPreviewFailureState, string> = {
  missing_config: "Steam library discovery is not configured on the server.",
  invalid_config: "Steam library discovery configuration is invalid.",
  private_library: "Steam did not expose owned-game details for this account. Check the Steam game-details privacy setting.",
  invalid_credentials: "Steam rejected the configured library credentials.",
  rate_limited: "Steam temporarily rate-limited the library preview request. Try again later.",
  malformed_response: "Steam returned an unexpected library response.",
  network_failure: "Steam could not be reached for a library preview.",
  provider_unavailable: "Steam library discovery is temporarily unavailable."
};

export const createSteamGameLibraryPreviewFailure = (
  state: SteamGameLibraryPreviewFailureState
): Extract<SteamGameLibraryPreviewResult, { ok: false }> => ({
  ok: false,
  provider: "steam",
  state,
  readOnly: true,
  message: previewFailureMessages[state]
});

export const getSteamGameLibraryConnectionStatus = (
  env: SteamGameLibraryEnvironment
): SteamGameLibraryConnectionStatus => {
  const config = getSteamGameLibraryConfig(env);

  if (config.ok) {
    return {
      ok: true,
      provider: "steam",
      state: "configured",
      configured: true,
      readOnly: true,
      detail: "Steam library discovery is configured for read-only previews."
    };
  }

  return {
    ok: true,
    provider: "steam",
    state: config.state,
    configured: false,
    readOnly: true,
    detail: config.state === "missing"
      ? "Steam library discovery is not configured on the server."
      : "Steam library discovery configuration is invalid."
  };
};

export const projectSteamOwnedGamesResponse = (
  payload: unknown
): SteamGameLibraryPreviewResult => {
  if (!isRecord(payload) || !isRecord(payload.response)) {
    return createSteamGameLibraryPreviewFailure("malformed_response");
  }

  const response = payload.response;

  if (!("game_count" in response) && !("games" in response)) {
    return createSteamGameLibraryPreviewFailure("private_library");
  }

  if (!isSafeNonNegativeInteger(response.game_count)) {
    return createSteamGameLibraryPreviewFailure("malformed_response");
  }

  if (response.games === undefined && response.game_count === 0) {
    return {
      ok: true,
      provider: "steam",
      state: "ready",
      readOnly: true,
      gameCount: 0,
      games: []
    };
  }

  if (!Array.isArray(response.games)) {
    return createSteamGameLibraryPreviewFailure("malformed_response");
  }

  const games: SteamOwnedGamePreview[] = [];
  const appIds = new Set<number>();

  for (const rawGame of response.games) {
    if (!isRecord(rawGame)) {
      return createSteamGameLibraryPreviewFailure("malformed_response");
    }

    const appId = rawGame.appid;
    const title = normalizeTitle(rawGame.name);
    const playtimeMinutes = rawGame.playtime_forever;
    const recentPlaytimeMinutes = rawGame.playtime_2weeks;

    if (
      !isSafeNonNegativeInteger(appId)
      || appId === 0
      || !title
      || !isSafeNonNegativeInteger(playtimeMinutes)
      || (recentPlaytimeMinutes !== undefined && !isSafeNonNegativeInteger(recentPlaytimeMinutes))
      || appIds.has(appId)
    ) {
      return createSteamGameLibraryPreviewFailure("malformed_response");
    }

    appIds.add(appId);
    games.push({
      appId,
      title,
      iconUrl: projectIconUrl(appId, rawGame.img_icon_url),
      playtimeMinutes,
      recentPlaytimeMinutes: recentPlaytimeMinutes ?? null
    });
  }

  if (response.game_count !== games.length) {
    return createSteamGameLibraryPreviewFailure("malformed_response");
  }

  return {
    ok: true,
    provider: "steam",
    state: "ready",
    readOnly: true,
    gameCount: games.length,
    games: games.sort((left, right) => left.title.localeCompare(right.title))
  };
};
