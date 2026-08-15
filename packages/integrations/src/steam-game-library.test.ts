import { describe, expect, it, vi } from "vitest";

import {
  getSteamGameLibraryConnectionStatus,
  projectSteamOwnedGamesResponse
} from "./steam-game-library.rules.js";
import { fetchSteamOwnedGamesPreview } from "./steam-game-library.service.js";

const apiKey = "0123456789abcdef0123456789abcdef";
const ownerId = "76561198000000000";

describe("Steam game library projection", () => {
  it("projects only sanitized preview fields and safe icon URLs", () => {
    const result = projectSteamOwnedGamesResponse({
      response: {
        game_count: 2,
        games: [{
          appid: 440,
          name: "  Team   Fortress 2 ",
          playtime_forever: 120,
          playtime_2weeks: 15,
          img_icon_url: "0123456789abcdef0123456789abcdef01234567",
          secret_extra: "must-not-survive"
        }, {
          appid: 570,
          name: "Dota 2",
          playtime_forever: 60,
          img_icon_url: "not-a-safe-hash"
        }]
      },
      raw_secret: "must-not-survive"
    });

    expect(result).toEqual({
      ok: true,
      provider: "steam",
      state: "ready",
      readOnly: true,
      gameCount: 2,
      games: [{
        appId: 570,
        title: "Dota 2",
        iconUrl: null,
        playtimeMinutes: 60,
        recentPlaytimeMinutes: null
      }, {
        appId: 440,
        title: "Team Fortress 2",
        iconUrl: "https://media.steampowered.com/steamcommunity/public/images/apps/440/0123456789abcdef0123456789abcdef01234567.jpg",
        playtimeMinutes: 120,
        recentPlaytimeMinutes: 15
      }]
    });
    expect(JSON.stringify(result)).not.toContain("secret_extra");
    expect(JSON.stringify(result)).not.toContain("raw_secret");
  });

  it("maps private and malformed response shapes to safe typed states", () => {
    expect(projectSteamOwnedGamesResponse({ response: {} })).toMatchObject({
      ok: false,
      state: "private_library"
    });
    expect(projectSteamOwnedGamesResponse({ response: { game_count: "2", games: [] } })).toMatchObject({
      ok: false,
      state: "malformed_response"
    });
    expect(projectSteamOwnedGamesResponse({ response: {
      game_count: 1,
      games: [{ appid: 440, name: "TF2", playtime_forever: -1 }]
    } })).toMatchObject({
      ok: false,
      state: "malformed_response"
    });
  });
});

describe("Steam game library configuration and fetch", () => {
  it("reports missing and invalid server configuration without exposing values", () => {
    expect(getSteamGameLibraryConnectionStatus({})).toMatchObject({
      ok: true,
      state: "missing",
      configured: false,
      readOnly: true
    });

    const invalidStatus = getSteamGameLibraryConnectionStatus({
      STEAM_WEB_API_KEY: "not-a-real-key",
      STEAM_OWNER_ID: "owner-secret"
    });

    expect(invalidStatus).toMatchObject({
      ok: true,
      state: "invalid",
      configured: false
    });
    expect(JSON.stringify(invalidStatus)).not.toContain("not-a-real-key");
    expect(JSON.stringify(invalidStatus)).not.toContain("owner-secret");
  });

  it("fails closed before any network request when server configuration is missing or invalid", async () => {
    const fetchOwnedGames = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(fetchSteamOwnedGamesPreview({
      env: {},
      fetchOwnedGames
    })).resolves.toMatchObject({ ok: false, state: "missing_config" });
    await expect(fetchSteamOwnedGamesPreview({
      env: {
        STEAM_WEB_API_KEY: "invalid",
        STEAM_OWNER_ID: "invalid"
      },
      fetchOwnedGames
    })).resolves.toMatchObject({ ok: false, state: "invalid_config" });
    expect(fetchOwnedGames).not.toHaveBeenCalled();
  });

  it("uses the public HTTPS API host with app info and played free games", async () => {
    const fetchOwnedGames = vi.fn(async (input: string | URL) => {
      const url = new URL(input);

      expect(url.origin).toBe("https://api.steampowered.com");
      expect(url.pathname).toBe("/IPlayerService/GetOwnedGames/v0001/");
      expect(url.searchParams.get("key")).toBe(apiKey);
      expect(url.searchParams.get("steamid")).toBe(ownerId);
      expect(url.searchParams.get("include_appinfo")).toBe("true");
      expect(url.searchParams.get("include_played_free_games")).toBe("true");

      return new Response(JSON.stringify({
        response: {
          game_count: 1,
          games: [{
            appid: 440,
            name: "Team Fortress 2",
            playtime_forever: 120
          }]
        }
      }), { status: 200 });
    });

    await expect(fetchSteamOwnedGamesPreview({
      env: {
        STEAM_WEB_API_KEY: apiKey,
        STEAM_OWNER_ID: ownerId
      },
      fetchOwnedGames
    })).resolves.toMatchObject({
      ok: true,
      state: "ready",
      gameCount: 1
    });
    expect(fetchOwnedGames).toHaveBeenCalledOnce();
  });

  it("maps invalid credentials, rate limits, private details, and network failures safely", async () => {
    const env = {
      STEAM_WEB_API_KEY: apiKey,
      STEAM_OWNER_ID: ownerId
    };

    await expect(fetchSteamOwnedGamesPreview({
      env,
      fetchOwnedGames: async () => new Response(null, { status: 403 })
    })).resolves.toMatchObject({ ok: false, state: "invalid_credentials" });
    await expect(fetchSteamOwnedGamesPreview({
      env,
      fetchOwnedGames: async () => new Response(null, { status: 429 })
    })).resolves.toMatchObject({ ok: false, state: "rate_limited" });
    await expect(fetchSteamOwnedGamesPreview({
      env,
      fetchOwnedGames: async () => new Response(JSON.stringify({ response: {} }), { status: 200 })
    })).resolves.toMatchObject({ ok: false, state: "private_library" });

    const networkResult = await fetchSteamOwnedGamesPreview({
      env,
      fetchOwnedGames: async () => {
        throw new Error(`request failed for key=${apiKey}&steamid=${ownerId}`);
      }
    });

    expect(networkResult).toMatchObject({ ok: false, state: "network_failure" });
    expect(JSON.stringify(networkResult)).not.toContain(apiKey);
    expect(JSON.stringify(networkResult)).not.toContain(ownerId);
    expect(JSON.stringify(networkResult)).not.toContain("request failed");
  });
});
