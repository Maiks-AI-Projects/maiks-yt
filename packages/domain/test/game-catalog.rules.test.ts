import { describe, expect, it } from "vitest";

import {
  buildSteamCatalogCandidate,
  gameCatalogRefreshMaxAgeMs,
  isGameCatalogResultStale,
  isValidGameCatalogSearchQuery,
  normalizeGameCatalogSearchQuery
} from "../src/games/game-catalog.rules.js";

describe("game catalog rules", () => {
  it("normalizes bounded explicit search queries", () => {
    const normalized = normalizeGameCatalogSearchQuery({ query: "  Sat\u0000isfactory   " });

    expect(normalized).toEqual({ query: "Sat isfactory" });
    expect(isValidGameCatalogSearchQuery(normalized)).toBe(true);
    expect(isValidGameCatalogSearchQuery({ query: "S" })).toBe(false);
  });

  it("projects safe Steam candidates and rejects unsafe artwork hosts", () => {
    expect(buildSteamCatalogCandidate({
      appId: 526870,
      title: " Satisfactory ",
      artworkUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/header.jpg"
    })).toEqual({
      provider: "steam",
      providerGameId: "526870",
      title: "Satisfactory",
      storeUrl: "https://store.steampowered.com/app/526870/",
      artworkUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/header.jpg",
      popularityScore: null
    });
    expect(buildSteamCatalogCandidate({
      appId: 526870,
      title: "Satisfactory",
      artworkUrl: "https://example.com/tracker.png"
    })).toMatchObject({ artworkUrl: null });
    expect(buildSteamCatalogCandidate({
      appId: 526870,
      title: "Satisfactory",
      popularityScore: 12345
    })).toMatchObject({ popularityScore: 12345 });
    expect(buildSteamCatalogCandidate({ appId: 0, title: "Invalid" })).toBeNull();
  });

  it("keeps cached records usable while identifying stale provider metadata", () => {
    const now = Date.parse("2026-08-15T12:00:00.000Z");

    expect(isGameCatalogResultStale(
      new Date(now - gameCatalogRefreshMaxAgeMs + 1).toISOString(),
      now
    )).toBe(false);
    expect(isGameCatalogResultStale(
      new Date(now - gameCatalogRefreshMaxAgeMs - 1).toISOString(),
      now
    )).toBe(true);
  });
});
