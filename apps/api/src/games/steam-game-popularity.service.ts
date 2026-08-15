import type { GameCatalogCandidate } from "@maiks-yt/domain/games";
import {
  fetchSteamPopularity,
  type SteamPopularityFetch
} from "@maiks-yt/integrations";

const steamPopularityConcurrency = 4;

export const enrichSteamCandidatesWithPopularity = async (
  candidates: readonly GameCatalogCandidate[],
  fetchPopularity?: SteamPopularityFetch
): Promise<readonly GameCatalogCandidate[]> => {
  const enriched = [...candidates];

  for (let start = 0; start < enriched.length; start += steamPopularityConcurrency) {
    const batch = enriched.slice(start, start + steamPopularityConcurrency);
    const results = await Promise.all(batch.map(async (candidate) => {
      const appId = Number(candidate.providerGameId);
      const popularity = await fetchSteamPopularity({
        appId,
        ...(fetchPopularity ? { fetchPopularity } : {})
      });

      return popularity.ok
        ? { ...candidate, popularityScore: popularity.playerCount }
        : candidate;
    }));

    enriched.splice(start, batch.length, ...results);
  }

  return enriched;
};
