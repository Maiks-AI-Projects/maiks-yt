import type {
  GameCatalogCandidate,
  GameCatalogSearchQuery
} from "./game-catalog.types.js";

export const gameCatalogSearchQueryMinLength = 2;
export const gameCatalogSearchQueryMaxLength = 100;
export const gameCatalogRefreshMaxAgeMs = 7 * 24 * 60 * 60 * 1_000;

const steamArtworkHosts = new Set([
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "store.akamai.steamstatic.com",
  "media.steampowered.com"
]);

const normalizeText = (value: string): string => value
  .trim()
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ");

export const normalizeGameCatalogTitle = (value: string): string =>
  normalizeText(value).slice(0, 191);

export const normalizeGameCatalogSearchQuery = (
  input: GameCatalogSearchQuery
): GameCatalogSearchQuery => ({
  query: normalizeText(input.query).slice(0, gameCatalogSearchQueryMaxLength)
});

export const isValidGameCatalogSearchQuery = (input: GameCatalogSearchQuery): boolean =>
  input.query.length >= gameCatalogSearchQueryMinLength
  && input.query.length <= gameCatalogSearchQueryMaxLength;

const normalizeSteamArtworkUrl = (value: unknown): string | null => {
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

export const buildSteamCatalogCandidate = (input: {
  appId: unknown;
  title: unknown;
  artworkUrl?: unknown;
}): GameCatalogCandidate | null => {
  if (
    typeof input.appId !== "number"
    || !Number.isSafeInteger(input.appId)
    || input.appId <= 0
    || typeof input.title !== "string"
  ) {
    return null;
  }

  const title = normalizeGameCatalogTitle(input.title);

  if (!title) {
    return null;
  }

  return {
    provider: "steam",
    providerGameId: String(input.appId),
    title,
    storeUrl: `https://store.steampowered.com/app/${input.appId}/`,
    artworkUrl: normalizeSteamArtworkUrl(input.artworkUrl)
  };
};

export const isGameCatalogResultStale = (
  lastRefreshedAt: string,
  now = Date.now()
): boolean => {
  const timestamp = Date.parse(lastRefreshedAt);
  return Number.isNaN(timestamp) || now - timestamp > gameCatalogRefreshMaxAgeMs;
};
