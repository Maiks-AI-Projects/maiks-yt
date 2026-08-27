import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyRequest } from "fastify";
import type { UrlAccessSurface } from "@maiks-yt/domain/security";

import type { MusicPlaybackService } from "./music-playback.service.js";
import type { MusicService } from "./music.service.js";
import type { MusicAuthSession } from "./music.types.js";
import type { MusicAudioUploadService } from "./music-audio-upload.service.js";
import type { MusicYouTubeAudioLibraryImportService } from "./music-youtube-audio-library-import.service.js";
import type { MusicLocalAgentRuntime } from "./music-local-agent-playback.service.js";

export type MusicRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<MusicAuthSession>;
  getDatabasePool: () => DatabasePool;
  validateUrlAccessTokenForRequest?: (input: {
    scope: string;
    surface: UrlAccessSurface;
    token: string;
  }) => Promise<{ valid: boolean; requiresLogin: boolean; reason?: string }>;
  validateLocalAgentAuthorizationForRequest?: (authorization: string | undefined) => boolean;
  localAgentRuntime?: MusicLocalAgentRuntime;
  publicApiBaseUrl?: string;
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
  createPlaybackService?: () => MusicPlaybackService;
  createImportService?: () => Pick<MusicYouTubeAudioLibraryImportService, "dryRun" | "apply">;
  createAudioUploadService?: () => Pick<MusicAudioUploadService, "upload">;
};
