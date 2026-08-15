import { describe, expect, it, vi } from "vitest";

import { projectSteamCatalogSearchResponse } from "./steam-catalog-search.rules.js";
import { searchSteamCatalog } from "./steam-catalog-search.service.js";

describe("Steam catalog search", () => {
  it("projects sanitized app results and allowlisted artwork URLs", () => {
    const result = projectSteamCatalogSearchResponse({
      total: 2,
      items: [{
        id: 526870,
        type: "app",
        name: " Satisfactory ",
        tiny_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/header.jpg",
        secret: "discard"
      }, {
        id: 1,
        type: "bundle",
        name: "Ignored bundle"
      }]
    });

    expect(result).toEqual({
      ok: true,
      provider: "steam",
      items: [{
        appId: 526870,
        title: "Satisfactory",
        artworkUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/header.jpg"
      }]
    });
    expect(JSON.stringify(result)).not.toContain("discard");
  });

  it("calls only the bounded Steam Store search endpoint", async () => {
    const fetchSearch = vi.fn(async (input: string | URL) => {
      const url = new URL(input);

      expect(url.origin).toBe("https://store.steampowered.com");
      expect(url.pathname).toBe("/api/storesearch/");
      expect(url.searchParams.get("term")).toBe("Satisfactory");
      expect(url.searchParams.get("cc")).toBe("nl");

      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });

    await expect(searchSteamCatalog({ query: "Satisfactory", fetchSearch })).resolves.toEqual({
      ok: true,
      provider: "steam",
      items: []
    });
    expect(fetchSearch).toHaveBeenCalledOnce();
  });

  it("fails safely for short queries, rate limits, and network errors", async () => {
    const fetchSearch = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(searchSteamCatalog({ query: "S", fetchSearch })).resolves.toMatchObject({
      ok: false,
      state: "invalid_query"
    });
    expect(fetchSearch).not.toHaveBeenCalled();
    await expect(searchSteamCatalog({
      query: "Satisfactory",
      fetchSearch: async () => new Response(null, { status: 429 })
    })).resolves.toMatchObject({ ok: false, state: "rate_limited" });
    await expect(searchSteamCatalog({
      query: "Satisfactory",
      fetchSearch: async () => {
        throw new Error("provider URL and internals");
      }
    })).resolves.toEqual({
      ok: false,
      provider: "steam",
      state: "network_failure",
      message: "Steam game search could not be reached."
    });
  });
});
