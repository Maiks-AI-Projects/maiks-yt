import { getSteamGameLibraryConfig } from "./steam-game-library.config.js";
import { createSteamGameLibraryPreviewFailure } from "./steam-game-library.rules.js";
import {
  projectSteamStoreAppTitle,
  projectSteamWishlistResponse
} from "./steam-wishlist.rules.js";
import type {
  SteamWishlistItemPreview,
  SteamWishlistPreviewInput,
  SteamWishlistPreviewResult
} from "./steam-wishlist.types.js";

const steamWishlistEndpoint = "https://api.steampowered.com/IWishlistService/GetWishlist/v1/";
const steamStoreAppEndpoint = "https://store.steampowered.com/api/appdetails";

const parseJson = async (response: Response): Promise<unknown | null> => {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
};

const fetchStoreTitle = async (input: {
  appId: number;
  fetchStoreApp: NonNullable<SteamWishlistPreviewInput["fetchStoreApp"]>;
  signal: AbortSignal;
}): Promise<string | null> => {
  const requestUrl = new URL(steamStoreAppEndpoint);
  requestUrl.searchParams.set("appids", String(input.appId));
  requestUrl.searchParams.set("l", "english");

  try {
    const response = await input.fetchStoreApp(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: input.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = await parseJson(response);
    return payload === null ? null : projectSteamStoreAppTitle(input.appId, payload);
  } catch {
    return null;
  }
};

const addStoreTitles = async (input: {
  items: readonly SteamWishlistItemPreview[];
  fetchStoreApp: NonNullable<SteamWishlistPreviewInput["fetchStoreApp"]>;
  signal: AbortSignal;
}): Promise<readonly SteamWishlistItemPreview[]> => {
  const titledItems: SteamWishlistItemPreview[] = [];

  for (const item of input.items) {
    titledItems.push({
      ...item,
      title: await fetchStoreTitle({
        appId: item.appId,
        fetchStoreApp: input.fetchStoreApp,
        signal: input.signal
      })
    });
  }

  return titledItems;
};

export const fetchSteamWishlistPreview = async (
  input: SteamWishlistPreviewInput
): Promise<SteamWishlistPreviewResult> => {
  const config = getSteamGameLibraryConfig(input.env);

  if (!config.ok) {
    return createSteamGameLibraryPreviewFailure(
      config.state === "missing" ? "missing_config" : "invalid_config"
    );
  }

  const requestUrl = new URL(steamWishlistEndpoint);
  requestUrl.searchParams.set("key", config.apiKey);
  requestUrl.searchParams.set("steamid", config.ownerId);
  requestUrl.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000);

  try {
    const response = await (input.fetchWishlist ?? fetch)(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
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
    const result = payload === null
      ? createSteamGameLibraryPreviewFailure("malformed_response")
      : projectSteamWishlistResponse(payload);

    if (!result.ok || result.items.length === 0) {
      return result;
    }

    return {
      ...result,
      items: await addStoreTitles({
        items: result.items,
        fetchStoreApp: input.fetchStoreApp ?? fetch,
        signal: controller.signal
      })
    };
  } catch {
    return createSteamGameLibraryPreviewFailure("network_failure");
  } finally {
    clearTimeout(timeout);
  }
};
