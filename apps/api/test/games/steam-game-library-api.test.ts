import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerSteamGameLibraryRoutes } from "../../src/games/steam-game-library.route.js";
import { SteamGameLibraryService } from "../../src/games/steam-game-library.service.js";
import type {
  SteamGameLibraryActor,
  SteamGameLibraryRepository
} from "../../src/games/steam-game-library.types.js";

const apiKey = "0123456789abcdef0123456789abcdef";
const ownerId = "76561198000000000";

class FakeSteamGameLibraryRepository implements SteamGameLibraryRepository {
  public actor: SteamGameLibraryActor | null = {
    domainUserId: "domain-owner",
    rolePermissionValues: [["*"]]
  };
  public resolveCount = 0;
  public cachedCandidateCount = 0;

  public async resolveActor(): Promise<SteamGameLibraryActor | null> {
    this.resolveCount += 1;
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async cacheCandidates(candidates: readonly unknown[]): Promise<void> {
    this.cachedCandidateCount += candidates.length;
  }
}

const createServer = (input: {
  repository?: FakeSteamGameLibraryRepository;
  session?: { user: { id: string } } | null;
  fetchOwnedGames?: typeof fetch;
  fetchWishlist?: typeof fetch;
  fetchStoreApp?: typeof fetch;
} = {}) => {
  const server = Fastify();
  const repository = input.repository ?? new FakeSteamGameLibraryRepository();
  const service = new SteamGameLibraryService(repository, {
    env: {
      STEAM_WEB_API_KEY: apiKey,
      STEAM_OWNER_ID: ownerId
    },
    fetchOwnedGames: input.fetchOwnedGames ?? (async () => new Response(JSON.stringify({
      response: {
        game_count: 1,
        games: [{
          appid: 440,
          name: "Team Fortress 2",
          playtime_forever: 120,
          playtime_2weeks: 15
        }]
      }
    }), { status: 200 })),
    fetchWishlist: input.fetchWishlist ?? (async () => new Response(JSON.stringify({
      response: {
        items: [{ appid: 440, priority: 1, date_added: 1_600_000_000 }]
      }
    }), { status: 200 })),
    fetchStoreApp: input.fetchStoreApp ?? (async () => new Response(JSON.stringify({
      "440": { success: true, data: { name: "Team Fortress 2" } }
    }), { status: 200 }))
  });

  registerSteamGameLibraryRoutes(server, {
    getAuthSession: async () => "session" in input
      ? input.session ?? null
      : { user: { id: "auth-owner" } },
    getDatabasePool: () => {
      throw new Error("database should not be used by fake service");
    },
    createService: () => service
  });

  return { server, repository };
};

describe("Steam game library API", () => {
  it("requires authentication for connection status and preview", async () => {
    const { server } = createServer({ session: null });

    for (const url of [
      "/admin/games/steam/status",
      "/admin/games/steam/preview",
      "/admin/games/steam/wishlist"
    ]) {
      const response = await server.inject({ method: "GET", url });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ ok: false, reason: "not_authenticated" });
    }

    await server.close();
  });

  it("denies linked users without owner wildcard or game-library manage permission", async () => {
    const repository = new FakeSteamGameLibraryRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["projects:manage"])]
    };
    const { server } = createServer({ repository });

    for (const url of [
      "/admin/games/steam/status",
      "/admin/games/steam/preview",
      "/admin/games/steam/wishlist"
    ]) {
      const response = await server.inject({ method: "GET", url });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        ok: false,
        reason: "game_library_admin_forbidden"
      });
    }

    await server.close();
  });

  it("allows owner wildcard and returns a sanitized read-only preview", async () => {
    const { server } = createServer();
    const statusResponse = await server.inject({
      method: "GET",
      url: "/admin/games/steam/status"
    });
    const previewResponse = await server.inject({
      method: "GET",
      url: "/admin/games/steam/preview"
    });
    const wishlistResponse = await server.inject({
      method: "GET",
      url: "/admin/games/steam/wishlist"
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.headers["cache-control"]).toBe("private, no-store");
    expect(statusResponse.json()).toEqual({
      ok: true,
      provider: "steam",
      state: "configured",
      configured: true,
      readOnly: true,
      detail: "Steam library discovery is configured for read-only previews."
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.headers["cache-control"]).toBe("private, no-store");
    expect(previewResponse.json()).toEqual({
      ok: true,
      provider: "steam",
      state: "ready",
      readOnly: true,
      gameCount: 1,
      games: [{
        appId: 440,
        title: "Team Fortress 2",
        iconUrl: null,
        playtimeMinutes: 120,
        recentPlaytimeMinutes: 15
      }]
    });
    expect(previewResponse.body).not.toContain(apiKey);
    expect(previewResponse.body).not.toContain(ownerId);
    expect(wishlistResponse.statusCode).toBe(200);
    expect(wishlistResponse.headers["cache-control"]).toBe("private, no-store");
    expect(wishlistResponse.json()).toEqual({
      ok: true,
      provider: "steam",
      state: "ready",
      readOnly: true,
      itemCount: 1,
      items: [{
        appId: 440,
        title: "Team Fortress 2",
        priority: 1,
        dateAddedAt: "2020-09-13T12:26:40.000Z",
        storeUrl: "https://store.steampowered.com/app/440/"
      }]
    });
    expect(wishlistResponse.body).not.toContain(apiKey);
    expect(wishlistResponse.body).not.toContain(ownerId);
    await server.close();
  });

  it("allows the typed game-library permission", async () => {
    const repository = new FakeSteamGameLibraryRepository();
    repository.actor = {
      domainUserId: "domain-game-admin",
      rolePermissionValues: [JSON.stringify(["game-library:manage"])]
    };
    const { server } = createServer({ repository });
    const response = await server.inject({
      method: "GET",
      url: "/admin/games/steam/status"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, state: "configured" });
    await server.close();
  });

  it("returns safe provider failures without credentials, URLs, payloads, or stack details", async () => {
    const { server } = createServer({
      fetchOwnedGames: async () => {
        throw new Error(`fetch https://api.steampowered.com/?key=${apiKey}&steamid=${ownerId}`);
      }
    });
    const response = await server.inject({
      method: "GET",
      url: "/admin/games/steam/preview"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: false,
      provider: "steam",
      state: "network_failure",
      readOnly: true,
      message: "Steam could not be reached for a library preview."
    });
    expect(response.body).not.toContain(apiKey);
    expect(response.body).not.toContain(ownerId);
    expect(response.body).not.toContain("api.steampowered.com");
    expect(response.body).not.toContain("stack");
    await server.close();
  });

  it("keeps repeated preview calls read-only and independent", async () => {
    const fetchOwnedGames = vi.fn(async () => new Response(JSON.stringify({
      response: {
        game_count: 1,
        games: [{
          appid: 570,
          name: "Dota 2",
          playtime_forever: 30
        }]
      }
    }), { status: 200 }));
    const { server, repository } = createServer({ fetchOwnedGames });

    const first = await server.inject({
      method: "GET",
      url: "/admin/games/steam/preview"
    });
    const second = await server.inject({
      method: "GET",
      url: "/admin/games/steam/preview"
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toEqual(second.json());
    expect(fetchOwnedGames).toHaveBeenCalledTimes(2);
    expect(repository.resolveCount).toBe(2);
    await server.close();
  });
});
