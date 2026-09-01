import type {
  IncompetechBulkManifest,
  IncompetechRejectedTrack,
  IncompetechValidatedTrack,
  YouTubeAudioLibraryBulkManifest,
  YouTubeAudioLibraryRejectedTrack,
  YouTubeAudioLibraryValidatedTrack
} from "@maiks-yt/domain/music";

export type MusicLibraryImportProvider = {
  providerKey: string;
  displayName: string;
  sourceLabel: string;
  policyUrl: string;
  termsUrl: string;
  notesPrivate: string;
  trackSlugPrefix: string;
  trackNotesPrivate: string;
};

export type MusicLibraryImportManifest =
  | YouTubeAudioLibraryBulkManifest
  | (IncompetechBulkManifest & { refreshMode: "full" });

export type MusicLibraryImportValidatedTrack =
  | YouTubeAudioLibraryValidatedTrack
  | IncompetechValidatedTrack;

export type MusicLibraryImportRejectedTrack =
  | YouTubeAudioLibraryRejectedTrack
  | IncompetechRejectedTrack;

export type MusicYouTubeAudioLibraryImportAction =
  | "create"
  | "update"
  | "unchanged"
  | "mark_unavailable"
  | "skip";

export type MusicYouTubeAudioLibraryImportItem = {
  externalId: string | null;
  title: string | null;
  action: MusicYouTubeAudioLibraryImportAction;
  reason: string | null;
};

export type MusicYouTubeAudioLibraryImportSummary = {
  received: number;
  accepted: number;
  rejected: number;
  created: number;
  updated: number;
  unchanged: number;
  markedUnavailable: number;
  licenseSnapshotsAppended: number;
};

export type MusicYouTubeAudioLibraryImportResult = {
  ok: true;
  mode: "dry-run" | "apply";
  summary: MusicYouTubeAudioLibraryImportSummary;
  items: readonly MusicYouTubeAudioLibraryImportItem[];
  rejectedTracks: readonly MusicLibraryImportRejectedTrack[];
};

export type MusicYouTubeAudioLibraryImportFailure = {
  ok: false;
  reason:
    | "music_admin_forbidden"
    | "music_admin_user_unlinked"
    | "music_import_invalid_manifest"
    | "music_import_incomplete_manifest"
    | "music_import_audio_unverified"
    | "music_import_stale_manifest"
    | "music_import_future_manifest";
};

export type MusicYouTubeAudioLibraryImportState = {
  providerPolicyId: string | null;
  sources: readonly {
    sourceId: string;
    trackId: string;
    externalId: string;
    title: string;
    artist: string;
    durationSeconds: number | null;
    reviewState: string;
    rightsState: string;
    liveSafe: boolean;
    vodSafe: boolean;
    explicitContent: boolean;
    instrumental: boolean;
    safetyTags: readonly string[];
    sourceType: string;
    sourceUrl: string | null;
    storageRef: string | null;
    sha256: string | null;
    mimeType: string | null;
    availabilityStatus: string;
    attributionText: string | null;
    latestLicenseComparable: string | null;
  }[];
};

export type MusicYouTubeAudioLibraryImportApplyInput = {
  actorUserId: string;
  provider?: MusicLibraryImportProvider;
  manifest: MusicLibraryImportManifest;
  tracks: readonly MusicLibraryImportValidatedTrack[];
};

export type MusicYouTubeAudioLibraryImportRepository = {
  getImportState(input?: { providerKey?: string }): Promise<MusicYouTubeAudioLibraryImportState>;
  applyImport(input: MusicYouTubeAudioLibraryImportApplyInput): Promise<MusicYouTubeAudioLibraryImportSummary>;
};

export type MusicAudioStorageVerifier = {
  verify(input: {
    storageRef: string;
    sha256: string;
  }): Promise<
    | {
      ok: true;
      contentType: string;
    }
    | {
      ok: false;
    }
  >;
};

export type MusicAudioUploadResult =
  | {
    ok: true;
    upload: {
      storageRef: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      sha256: string;
    };
  }
  | {
    ok: false;
    reason:
      | "music_admin_forbidden"
      | "music_admin_user_unlinked"
      | "music_audio_upload_invalid_input";
  };
