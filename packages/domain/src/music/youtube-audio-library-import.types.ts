export const youtubeAudioLibraryProviderKey = "youtube-audio-library" as const;
export const youtubeAudioLibraryManifestVersion = "youtube-audio-library.v1" as const;
export const youtubeAudioLibraryMaxManifestTracks = 5_000;
export const youtubeAudioLibraryVocalsClasses = ["none", "minimal", "prominent", "unknown"] as const;

export type YouTubeAudioLibraryVocalsClass = typeof youtubeAudioLibraryVocalsClasses[number];

export type YouTubeAudioLibraryManifestAudio = {
  storageRef?: string | null;
  sha256?: string | null;
  mimeType?: string | null;
};

export type YouTubeAudioLibraryManifestProof = {
  url?: string | null;
  storageRef?: string | null;
};

export type YouTubeAudioLibraryManifestStudioEvidence = {
  studioUrl?: string | null;
  dialogText?: string | null;
  attributionText?: string | null;
  licenseText?: string | null;
  sourceText?: string | null;
  sourceUrl?: string | null;
  proofUrl?: string | null;
};

export type YouTubeAudioLibraryManifestTrack = {
  externalId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  downloadedAt: string;
  genre: string;
  vocalsClass: YouTubeAudioLibraryVocalsClass;
  liveSafe: boolean;
  vodSafe: boolean;
  licenseName: string;
  licenseUrl?: string | null;
  attributionRequired: boolean;
  attributionText?: string | null;
  audio?: YouTubeAudioLibraryManifestAudio | null;
  proof?: YouTubeAudioLibraryManifestProof | null;
  studioEvidence?: YouTubeAudioLibraryManifestStudioEvidence | null;
  genres?: readonly string[];
  moods?: readonly string[];
  tags?: readonly string[];
  explicitContent?: boolean;
  instrumental?: boolean;
};

export type YouTubeAudioLibraryBulkManifest = {
  manifestVersion: typeof youtubeAudioLibraryManifestVersion;
  exportedAt: string;
  refreshMode: "full" | "partial";
  source: "youtube-studio";
  exportCompleteness?: {
    reachedEnd: boolean;
    hitMaxTracks: boolean;
    visibleRows: number;
    candidateRows: number;
    processedCandidates: number;
    skippedCandidates: number;
    skipReasons: Record<string, number>;
    tracksExported: number;
    filterApplied: boolean;
    refreshMode: "full" | "partial";
  };
  tracks: readonly YouTubeAudioLibraryManifestTrack[];
};

export type YouTubeAudioLibraryImportRejectReason =
  | "invalid_manifest"
  | "too_many_tracks"
  | "duplicate_external_id"
  | "not_cc_by_4"
  | "missing_attribution"
  | "missing_audio"
  | "missing_license_evidence"
  | "invalid_license_evidence"
  | "invalid_audio_reference"
  | "invalid_required_field";

export type YouTubeAudioLibraryRejectedTrack = {
  index: number;
  externalId: string | null;
  title: string | null;
  reason: YouTubeAudioLibraryImportRejectReason;
};

export type YouTubeAudioLibraryValidatedTrack = {
  externalId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  downloadedAt: string;
  genre: string;
  vocalsClass: Extract<YouTubeAudioLibraryVocalsClass, "none" | "minimal">;
  liveSafe: true;
  vodSafe: true;
  licenseName: "Creative Commons Attribution 4.0";
  licenseUrl: string;
  attributionText: string;
  audio: {
    sourceType: "local_audio";
    storageRef: string;
    sha256: string;
    mimeType: string;
  };
  proofUrl: string | null;
  proofStorageRef: string | null;
  safetyTags: readonly string[];
  explicitContent: boolean;
  instrumental: boolean;
  licensePayload: Record<string, unknown>;
};

export type YouTubeAudioLibraryManifestValidationResult =
  | {
    ok: true;
    manifest: YouTubeAudioLibraryBulkManifest;
    tracks: readonly YouTubeAudioLibraryValidatedTrack[];
    rejectedTracks: readonly YouTubeAudioLibraryRejectedTrack[];
  }
  | {
    ok: false;
    reason: YouTubeAudioLibraryImportRejectReason;
    rejectedTracks: readonly YouTubeAudioLibraryRejectedTrack[];
  };
