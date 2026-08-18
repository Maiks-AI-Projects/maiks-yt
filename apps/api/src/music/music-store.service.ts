import type { DatabasePool } from "@maiks-yt/database";

import type { MusicRepository } from "./music.types.js";
import { createMusicActorRepository } from "./music-actor-store.service.js";
import { createMusicCatalogRepository } from "./music-catalog-store.service.js";
import { createMusicHistoryRepository } from "./music-history-store.service.js";
import { createMusicPlaylistRepository } from "./music-playlist-store.service.js";
import { createMusicProviderPolicyRepository } from "./music-provider-policy-store.service.js";
import { createMusicRequestsRepository } from "./music-requests-store.service.js";
import { createMusicReviewRepository } from "./music-review-store.service.js";
import { createMusicSelectableRepository } from "./music-selectable-store.service.js";

export const createMusicRepository = (pool: DatabasePool): MusicRepository => ({
  ...createMusicActorRepository(pool),
  ...createMusicSelectableRepository(pool),
  ...createMusicRequestsRepository(pool),
  ...createMusicProviderPolicyRepository(pool),
  ...createMusicCatalogRepository(pool),
  ...createMusicPlaylistRepository(pool),
  ...createMusicReviewRepository(pool),
  ...createMusicHistoryRepository(pool)
});
