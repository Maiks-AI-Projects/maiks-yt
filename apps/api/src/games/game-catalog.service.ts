import {
  buildSteamCatalogCandidate,
  canManageGameLibrary,
  isValidGameCatalogSearchQuery,
  normalizeGameCatalogSearchQuery
} from "@maiks-yt/domain/games";
import { searchSteamCatalog } from "@maiks-yt/integrations";

import { normalizeGameLibraryPermissions } from "./game-library.service.js";
import type {
  GameCatalogRepository,
  GameCatalogSearchServiceResult,
  GameCatalogServiceOptions
} from "./game-catalog.types.js";

export class GameCatalogService {
  public constructor(
    private readonly repository: GameCatalogRepository,
    private readonly options: GameCatalogServiceOptions = {}
  ) {}

  public async search(input: {
    authUserId: string;
    query: string;
  }): Promise<GameCatalogSearchServiceResult> {
    const query = normalizeGameCatalogSearchQuery({ query: input.query });

    if (!isValidGameCatalogSearchQuery(query)) {
      return { ok: false, reason: "game_catalog_invalid_query" };
    }

    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return { ok: false, reason: "game_library_admin_user_unlinked" };
    }

    if (!canManageGameLibrary(normalizeGameLibraryPermissions(actor.rolePermissionValues))) {
      return { ok: false, reason: "game_library_admin_forbidden" };
    }

    const providerResult = await searchSteamCatalog({
      query: query.query,
      ...(this.options.fetchSteamSearch
        ? { fetchSearch: this.options.fetchSteamSearch }
        : {})
    });

    if (providerResult.ok) {
      const candidates = providerResult.items
        .map((item) => buildSteamCatalogCandidate({
          appId: item.appId,
          title: item.title,
          artworkUrl: item.artworkUrl
        }))
        .filter((candidate) => candidate !== null);

      await this.repository.cacheCandidates(candidates);

      return {
        ok: true,
        query: query.query,
        providerState: "ready",
        cacheOnly: false,
        results: await this.repository.searchCached(query.query)
      };
    }

    return {
      ok: true,
      query: query.query,
      providerState: providerResult.state === "invalid_query"
        ? "malformed_response"
        : providerResult.state,
      cacheOnly: true,
      results: await this.repository.searchCached(query.query)
    };
  }
}
