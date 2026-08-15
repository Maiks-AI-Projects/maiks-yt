import {
  createSteamCatalogSearchFailure,
  projectSteamCatalogSearchResponse
} from "./steam-catalog-search.rules.js";
import type {
  SteamCatalogSearchFetch,
  SteamCatalogSearchResult
} from "./steam-catalog-search.types.js";

const steamCatalogSearchEndpoint = "https://store.steampowered.com/api/storesearch/";

export const searchSteamCatalog = async (input: {
  query: string;
  fetchSearch?: SteamCatalogSearchFetch;
  timeoutMs?: number;
}): Promise<SteamCatalogSearchResult> => {
  const query = input.query.trim();

  if (query.length < 2 || query.length > 100) {
    return createSteamCatalogSearchFailure("invalid_query");
  }

  const requestUrl = new URL(steamCatalogSearchEndpoint);
  requestUrl.searchParams.set("term", query);
  requestUrl.searchParams.set("l", "english");
  requestUrl.searchParams.set("cc", "nl");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8_000);

  try {
    const response = await (input.fetchSearch ?? fetch)(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal
    });

    if (response.status === 429) {
      return createSteamCatalogSearchFailure("rate_limited");
    }

    if (!response.ok) {
      return createSteamCatalogSearchFailure("provider_unavailable");
    }

    try {
      return projectSteamCatalogSearchResponse(await response.json() as unknown);
    } catch {
      return createSteamCatalogSearchFailure("malformed_response");
    }
  } catch {
    return createSteamCatalogSearchFailure("network_failure");
  } finally {
    clearTimeout(timeout);
  }
};
