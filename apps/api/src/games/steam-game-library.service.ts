import { buildSteamCatalogCandidate, canManageGameLibrary } from "@maiks-yt/domain/games";
import {
  fetchSteamOwnedGamesPreview,
  fetchSteamWishlistPreview,
  getSteamGameLibraryConnectionStatus
} from "@maiks-yt/integrations";

import { normalizeGameLibraryPermissions } from "./game-library.service.js";
import type {
  SteamGameLibraryAccessFailure,
  SteamGameLibraryRepository,
  SteamGameLibraryServiceOptions,
  SteamGameLibraryServicePreviewResult,
  SteamGameLibraryStatusResult,
  SteamWishlistServicePreviewResult
} from "./steam-game-library.types.js";

export class SteamGameLibraryService {
  public constructor(
    private readonly repository: SteamGameLibraryRepository,
    private readonly options: SteamGameLibraryServiceOptions = {}
  ) {}

  public async getConnectionStatus(input: {
    authUserId: string;
  }): Promise<SteamGameLibraryStatusResult> {
    const accessFailure = await this.getAccessFailure(input.authUserId);

    return accessFailure
      ?? getSteamGameLibraryConnectionStatus(this.options.env ?? process.env);
  }

  public async previewLibrary(input: {
    authUserId: string;
  }): Promise<SteamGameLibraryServicePreviewResult> {
    const accessFailure = await this.getAccessFailure(input.authUserId);

    if (accessFailure) {
      return accessFailure;
    }

    const result = await fetchSteamOwnedGamesPreview({
      env: this.options.env ?? process.env,
      ...(this.options.fetchOwnedGames
        ? { fetchOwnedGames: this.options.fetchOwnedGames }
        : {})
    });

    if (result.ok) {
      await this.repository.cacheCandidates(result.games
        .map((game) => buildSteamCatalogCandidate({
          appId: game.appId,
          title: game.title,
          artworkUrl: game.iconUrl
        }))
        .filter((candidate) => candidate !== null));
    }

    return result;
  }

  public async previewWishlist(input: {
    authUserId: string;
  }): Promise<SteamWishlistServicePreviewResult> {
    const accessFailure = await this.getAccessFailure(input.authUserId);

    if (accessFailure) {
      return accessFailure;
    }

    const result = await fetchSteamWishlistPreview({
      env: this.options.env ?? process.env,
      ...(this.options.fetchWishlist
        ? { fetchWishlist: this.options.fetchWishlist }
        : {}),
      ...(this.options.fetchStoreApp
        ? { fetchStoreApp: this.options.fetchStoreApp }
        : {})
    });

    if (result.ok) {
      await this.repository.cacheCandidates(result.items
        .map((item) => buildSteamCatalogCandidate({
          appId: item.appId,
          title: item.title ?? `Steam App ${item.appId}`
        }))
        .filter((candidate) => candidate !== null));
    }

    return result;
  }

  private async getAccessFailure(
    authUserId: string
  ): Promise<SteamGameLibraryAccessFailure | null> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "game_library_admin_user_unlinked"
      };
    }

    if (!canManageGameLibrary(normalizeGameLibraryPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "game_library_admin_forbidden"
      };
    }

    return null;
  }
}
