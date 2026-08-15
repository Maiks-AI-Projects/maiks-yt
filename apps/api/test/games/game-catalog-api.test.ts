import type {
  GameCatalogCandidate,
  GameCatalogSearchResult
} from "@maiks-yt/domain/games";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerGameCatalogRoutes } from "../../src/games/game-catalog.route.js";
import { GameCatalogService } from "../../src/games/game-catalog.service.js";
import type { GameCatalogRepository } from "../../src/games/game-catalog.types.js";

class FakeGameCatalogRepository implements GameCatalogRepository {
  public actor = {
    domainUserId: "domain-owner",
    rolePermissionValues: [["*"]]
  } as { domainUserId: string; rolePermissionValues: readonly unknown[] } | null;
  public readonly candidates = new Map<string, GameCatalogCandidate>();

  public async resolveActor() {
    return this.actor;
  }

  public async searchCached(query: string): Promise<readonly GameCatalogSearchResult[]> {
    return [...this.candidates.values()]
      .filter((candidate) => candidate.title.toLowerCase().includes(query.toLowerCase()))
      .map((candidate, index) => ({
        catalogGameId: `catalog-${index + 1}`,
        title: candidate.title,
        matchState: "discovered",
        provider: candidate.provider,
        providerGameId: candidate.providerGameId,
        storeUrl: candidate.storeUrl,
        artworkUrl: candidate.artworkUrl,
        popularityScore: candidate.popularityScore,
        popularityUpdatedAt: candidate.popularityScore === null
          ? null
          : "2026-08-15T12:00:00.000Z",
        lastRefreshedAt: "2026-08-15T12:00:00.000Z",
        stale: false
      }));
  }

  public async cacheCandidates(candidates: readonly GameCatalogCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      this.candidates.set(`${candidate.provider}:${candidate.providerGameId}`, candidate);
    }
  }
}

const createServer = (input: {
  session?: { user: { id: string } } | null;
  repository?: FakeGameCatalogRepository;
  fetchSteamSearch?: typeof fetch;
} = {}) => {
  const server = Fastify();
  const repository = input.repository ?? new FakeGameCatalogRepository();
  const service = new GameCatalogService(repository, {
    fetchSteamSearch: input.fetchSteamSearch ?? (async () => new Response(JSON.stringify({
      items: [{
        id: 526870,
        type: "app",
        name: "Satisfactory",
        tiny_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/header.jpg"
      }]
    }), { status: 200 }))
  });

  registerGameCatalogRoutes(server, {
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

describe("game catalog API", () => {
  it("requires authentication and a bounded query", async () => {
    const signedOut = createServer({ session: null });
    const unauthenticated = await signedOut.server.inject({
      method: "GET",
      url: "/admin/games/catalog/search?q=Satisfactory"
    });

    expect(unauthenticated.statusCode).toBe(401);
    await signedOut.server.close();

    const signedIn = createServer();
    const invalid = await signedIn.server.inject({
      method: "GET",
      url: "/admin/games/catalog/search?q=S"
    });

    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ ok: false, reason: "game_catalog_invalid_query" });
    await signedIn.server.close();
  });

  it("denies accounts without game-library permission", async () => {
    const repository = new FakeGameCatalogRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["projects:manage"])]
    };
    const { server } = createServer({ repository });
    const response = await server.inject({
      method: "GET",
      url: "/admin/games/catalog/search?q=Satisfactory"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ ok: false, reason: "game_library_admin_forbidden" });
    await server.close();
  });

  it("caches explicit Steam search results and returns safe catalog fields", async () => {
    const { server, repository } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/admin/games/catalog/search?q=Satisfactory"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json()).toMatchObject({
      ok: true,
      query: "Satisfactory",
      providerState: "ready",
      cacheOnly: false,
      results: [{
        title: "Satisfactory",
        provider: "steam",
        providerGameId: "526870",
        storeUrl: "https://store.steampowered.com/app/526870/"
      }]
    });
    expect(repository.candidates.size).toBe(1);
    await server.close();
  });

  it("returns stale local matches when Steam search is unavailable", async () => {
    const repository = new FakeGameCatalogRepository();
    await repository.cacheCandidates([{
      provider: "steam",
      providerGameId: "526870",
      title: "Satisfactory",
      storeUrl: "https://store.steampowered.com/app/526870/",
      artworkUrl: null,
      popularityScore: null
    }]);
    const { server } = createServer({
      repository,
      fetchSteamSearch: async () => {
        throw new Error("Steam is unavailable");
      }
    });
    const response = await server.inject({
      method: "GET",
      url: "/admin/games/catalog/search?q=Satisfactory"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      providerState: "network_failure",
      cacheOnly: true,
      results: [{ title: "Satisfactory" }]
    });
    await server.close();
  });
});
