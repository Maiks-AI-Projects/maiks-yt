import { describe, expect, it, vi } from "vitest";

import { projectSteamPopularityResponse } from "./steam-popularity.rules.js";
import { fetchSteamPopularity } from "./steam-popularity.service.js";

describe("Steam popularity", () => {
  it("projects a safe current-player count", () => {
    expect(projectSteamPopularityResponse(526870, {
      response: { player_count: 12345, result: 1 }
    })).toEqual({ ok: true, appId: 526870, playerCount: 12345 });
  });

  it("rejects malformed counts and invalid app ids", () => {
    expect(projectSteamPopularityResponse(0, {})).toMatchObject({
      ok: false,
      state: "invalid_app_id"
    });
    expect(projectSteamPopularityResponse(526870, {
      response: { player_count: -1, result: 1 }
    })).toMatchObject({ ok: false, state: "malformed_response" });
  });

  it("calls only the bounded current-player endpoint", async () => {
    const requestedUrls: string[] = [];
    const fetchPopularity = vi.fn(async (input: string | URL) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({
        response: { player_count: 321, result: 1 }
      }), { status: 200 });
    });

    await expect(fetchSteamPopularity({ appId: 526870, fetchPopularity }))
      .resolves.toEqual({ ok: true, appId: 526870, playerCount: 321 });

    const requestUrl = new URL(requestedUrls[0] ?? "https://invalid.example");
    expect(requestUrl.origin).toBe("https://api.steampowered.com");
    expect(requestUrl.pathname).toBe("/ISteamUserStats/GetNumberOfCurrentPlayers/v1/");
    expect(requestUrl.searchParams.get("appid")).toBe("526870");
  });

  it("fails closed without provider details", async () => {
    await expect(fetchSteamPopularity({
      appId: 526870,
      fetchPopularity: async () => { throw new Error("secret provider detail"); }
    })).resolves.toEqual({ ok: false, appId: 526870, state: "network_failure" });
  });
});
