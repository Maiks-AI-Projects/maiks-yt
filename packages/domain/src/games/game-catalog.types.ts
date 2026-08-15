export const gameCatalogProviders = ["steam", "twitch", "igdb", "other"] as const;
export type GameCatalogProvider = typeof gameCatalogProviders[number];

export const gameCatalogMatchStates = ["discovered", "owner-confirmed"] as const;
export type GameCatalogMatchState = typeof gameCatalogMatchStates[number];

export type GameCatalogSearchQuery = {
  query: string;
};

export type GameCatalogCandidate = {
  provider: GameCatalogProvider;
  providerGameId: string;
  title: string;
  storeUrl: string | null;
  artworkUrl: string | null;
  popularityScore: number | null;
};

export type GameCatalogSearchResult = {
  catalogGameId: string;
  title: string;
  matchState: GameCatalogMatchState;
  provider: GameCatalogProvider;
  providerGameId: string;
  storeUrl: string | null;
  artworkUrl: string | null;
  popularityScore: number | null;
  popularityUpdatedAt: string | null;
  lastRefreshedAt: string;
  stale: boolean;
};
