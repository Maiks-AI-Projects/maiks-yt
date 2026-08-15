import { describe, expect, it, vi } from "vitest";

import {
  projectSteamStoreAppTitle,
  projectSteamWishlistResponse
} from "./steam-wishlist.rules.js";
import { fetchSteamWishlistPreview } from "./steam-wishlist.service.js";

const apiKey = "0123456789abcdef0123456789abcdef";
const ownerId = "76561198000000000";
const env = {
  STEAM_WEB_API_KEY: apiKey,
  STEAM_OWNER_ID: ownerId
};

describe("Steam wishlist projection", () => {
  it("projects only safe wishlist fields in priority order", () => {
    const result = projectSteamWishlistResponse({
      response: {
        items: [{
          appid: 570,
          priority: 2,
          date_added: 1_700_000_000,
          secret_note: "must-not-survive"
        }, {
          appid: 440,
          priority: 1,
          date_added: 1_600_000_000
        }]
      },
      raw_secret: "must-not-survive"
    });

    expect(result).toEqual({
      ok: true,
      provider: "steam",
      state: "ready",
      readOnly: true,
      itemCount: 2,
      items: [{
        appId: 440,
        title: null,
        priority: 1,
        dateAddedAt: "2020-09-13T12:26:40.000Z",
        storeUrl: "https://store.steampowered.com/app/440/"
      }, {
        appId: 570,
        title: null,
        priority: 2,
        dateAddedAt: "2023-11-14T22:13:20.000Z",
        storeUrl: "https://store.steampowered.com/app/570/"
      }]
    });
    expect(JSON.stringify(result)).not.toContain("secret_note");
    expect(JSON.stringify(result)).not.toContain("raw_secret");
  });

  it("rejects malformed and duplicate wishlist rows", () => {
    expect(projectSteamWishlistResponse({ response: {} })).toMatchObject({
      ok: false,
      state: "malformed_response"
    });
    expect(projectSteamWishlistResponse({ response: {
      items: [{ appid: 440, priority: -1, date_added: 1_600_000_000 }]
    } })).toMatchObject({ ok: false, state: "malformed_response" });
    expect(projectSteamWishlistResponse({ response: {
      items: [
        { appid: 440, priority: 1, date_added: 1_600_000_000 },
        { appid: 440, priority: 2, date_added: 1_700_000_000 }
      ]
    } })).toMatchObject({ ok: false, state: "malformed_response" });
  });

  it("sanitizes best-effort Steam Store titles", () => {
    expect(projectSteamStoreAppTitle(440, {
      "440": {
        success: true,
        data: { name: "  Team\u0000 Fortress   2 ", ignored: "secret" }
      }
    })).toBe("Team Fortress 2");
    expect(projectSteamStoreAppTitle(440, {
      "440": { success: false, data: { name: "not available" } }
    })).toBeNull();
  });
});

describe("Steam wishlist fetch", () => {
  it("uses the read-only Wishlist service and enriches titles without exposing credentials", async () => {
    const fetchWishlist = vi.fn(async (input: string | URL) => {
      const url = new URL(input);

      expect(url.origin).toBe("https://api.steampowered.com");
      expect(url.pathname).toBe("/IWishlistService/GetWishlist/v1/");
      expect(url.searchParams.get("key")).toBe(apiKey);
      expect(url.searchParams.get("steamid")).toBe(ownerId);

      return new Response(JSON.stringify({
        response: {
          items: [{ appid: 440, priority: 1, date_added: 1_600_000_000 }]
        }
      }), { status: 200 });
    });
    const fetchStoreApp = vi.fn(async (input: string | URL) => {
      const url = new URL(input);

      expect(url.origin).toBe("https://store.steampowered.com");
      expect(url.pathname).toBe("/api/appdetails");
      expect(url.searchParams.get("appids")).toBe("440");

      return new Response(JSON.stringify({
        "440": { success: true, data: { name: "Team Fortress 2" } }
      }), { status: 200 });
    });

    const result = await fetchSteamWishlistPreview({
      env,
      fetchWishlist,
      fetchStoreApp
    });

    expect(result).toMatchObject({
      ok: true,
      itemCount: 1,
      items: [{ appId: 440, title: "Team Fortress 2" }]
    });
    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect(JSON.stringify(result)).not.toContain(ownerId);
  });

  it("keeps wishlist rows usable when optional Store title lookup fails", async () => {
    const result = await fetchSteamWishlistPreview({
      env,
      fetchWishlist: async () => new Response(JSON.stringify({
        response: {
          items: [{ appid: 440, priority: 1, date_added: 1_600_000_000 }]
        }
      }), { status: 200 }),
      fetchStoreApp: async () => {
        throw new Error("store metadata unavailable");
      }
    });

    expect(result).toMatchObject({
      ok: true,
      items: [{
        appId: 440,
        title: null,
        storeUrl: "https://store.steampowered.com/app/440/"
      }]
    });
  });

  it("maps provider and network failures to safe states", async () => {
    await expect(fetchSteamWishlistPreview({
      env,
      fetchWishlist: async () => new Response(null, { status: 403 })
    })).resolves.toMatchObject({ ok: false, state: "invalid_credentials" });
    await expect(fetchSteamWishlistPreview({
      env,
      fetchWishlist: async () => new Response(null, { status: 429 })
    })).resolves.toMatchObject({ ok: false, state: "rate_limited" });

    const result = await fetchSteamWishlistPreview({
      env,
      fetchWishlist: async () => {
        throw new Error(`failed key=${apiKey}&steamid=${ownerId}`);
      }
    });

    expect(result).toMatchObject({ ok: false, state: "network_failure" });
    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect(JSON.stringify(result)).not.toContain(ownerId);
  });
});
