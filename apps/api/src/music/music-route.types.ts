import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyRequest } from "fastify";

import type { MusicService } from "./music.service.js";
import type { MusicAuthSession } from "./music.types.js";
import type { MusicAudioUploadService } from "./music-audio-upload.service.js";
import type { MusicYouTubeAudioLibraryImportService } from "./music-youtube-audio-library-import.service.js";

export type MusicRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<MusicAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<MusicService,
    | "listPublicCatalog"
    | "createAnonymousRequest"
    | "getTopTracks"
    | "replaceTopTracks"
    | "listAdmin"
    | "createProviderPolicy"
    | "updateProviderPolicy"
    | "createTrack"
    | "updateTrack"
    | "createTrackSource"
    | "updateTrackSource"
    | "createLicenseSnapshot"
    | "updateLicenseSnapshot"
    | "createPlaylist"
    | "updatePlaylist"
    | "replacePlaylistTracks"
    | "createBlacklistEntry"
    | "revokeBlacklistEntry"
    | "resolveReviewQueueItem"
    | "appendPlayHistory"
  >;
  createImportService?: () => Pick<MusicYouTubeAudioLibraryImportService, "dryRun" | "apply">;
  createAudioUploadService?: () => Pick<MusicAudioUploadService, "upload">;
};
