import { normalizeSteamStoreTitle } from "./steam-wishlist.rules.js";
import type {
  SteamCatalogSearchFailureState,
  SteamCatalogSearchItem,
  SteamCatalogSearchResult
} from "./steam-catalog-search.types.js";

const steamArtworkHosts = new Set([
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "store.akamai.steamstatic.com"
]);

const failureMessages: Record<SteamCatalogSearchFailureState, string> = {
  invalid_query: "Enter at least two characters to search Steam.",
  rate_limited: "Steam temporarily rate-limited game search.",
  malformed_response: "Steam returned an unexpected game-search response.",
  network_failure: "Steam game search could not be reached.",
  provider_unavailable: "Steam game search is temporarily unavailable."
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const projectArtworkUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 1024) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && steamArtworkHosts.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const createSteamCatalogSearchFailure = (
  state: SteamCatalogSearchFailureState
): Extract<SteamCatalogSearchResult, { ok: false }> => ({
  ok: false,
  provider: "steam",
  state,
  message: failureMessages[state]
});

export const projectSteamCatalogSearchResponse = (
  payload: unknown
): SteamCatalogSearchResult => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return createSteamCatalogSearchFailure("malformed_response");
  }

  const items: SteamCatalogSearchItem[] = [];
  const appIds = new Set<number>();

  for (const rawItem of payload.items.slice(0, 20)) {
    if (!isRecord(rawItem) || rawItem.type !== "app") {
      continue;
    }

    const appId = rawItem.id;
    const title = normalizeSteamStoreTitle(rawItem.name);

    if (
      typeof appId !== "number"
      || !Number.isSafeInteger(appId)
      || appId <= 0
      || !title
      || appIds.has(appId)
    ) {
      return createSteamCatalogSearchFailure("malformed_response");
    }

    appIds.add(appId);
    items.push({
      appId,
      title,
      artworkUrl: projectArtworkUrl(rawItem.tiny_image)
    });
  }

  return {
    ok: true,
    provider: "steam",
    items
  };
};
