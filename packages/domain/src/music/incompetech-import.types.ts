export const incompetechProviderKey = "incompetech" as const;
export const incompetechManifestVersion = "incompetech-ccby4.v1" as const;
export const incompetechExpectedTrackCount = 20;
export const incompetechExpectedGenres = ["contemporary", "electronica", "jazz", "soundtrack", "world"] as const;
export const incompetechVocalsClasses = ["none", "minimal", "prominent", "unknown"] as const;

export type IncompetechGenre = typeof incompetechExpectedGenres[number];
export type IncompetechVocalsClass = typeof incompetechVocalsClasses[number];

export type IncompetechProviderEvidence = {
  label?: string | null;
  url?: string | null;
  path?: string | null;
  sha256?: string | null;
};

export type IncompetechManifestAudio = {
  path?: string | null;
  storageRef?: string | null;
  sha256?: string | null;
  mimeType?: string | null;
  format?: string | null;
  codec?: string | null;
  bitrate?: number | null;
  headStatus?: number | null;
  headContentType?: string | null;
  getContentType?: string | null;
};

export type IncompetechManifestProof = {
  accessedAt?: string | null;
  catalogRowPath?: string | null;
  catalogRowSha256?: string | null;
  itemPagePath?: string | null;
  itemPageSha256?: string | null;
  provider?: string | null;
  providerEvidenceManifest?: string | null;
  providerSnapshotSha256?: string | null;
  contentIdCaveat?: string | null;
  url?: string | null;
};

export type IncompetechManifestTrack = {
  externalId: string;
  isrc: string | null;
  title: string;
  artist: string;
  durationSeconds: number;
  catalogDurationSeconds: number;
  downloadedAt: string;
  normalizedGenre: IncompetechGenre;
  sourceGenre: string;
  vocalsClass: IncompetechVocalsClass;
  liveSafe: boolean;
  vodSafe: boolean;
  commercialAllowed: boolean;
  rightsStatus: string;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  attributionText: string;
  sourceUrl: string;
  directFileUrl: string;
  officialCatalogJsonUrl: string;
  catalogUrl: string;
  description?: string | null;
  instruments?: string | null;
  moods?: readonly string[];
  classificationEvidence: string;
  qualityUseCaseNote?: string | null;
  audio: IncompetechManifestAudio;
  proof: IncompetechManifestProof;
};

export type IncompetechBulkManifest = {
  manifestVersion: typeof incompetechManifestVersion;
  source: typeof incompetechProviderKey;
  sourceClass?: string | null;
  generatedAt: string;
  providerEvidence: readonly IncompetechProviderEvidence[];
  rejectedCandidatesLog?: unknown;
  counts?: Record<string, unknown>;
  acceptedRightsReport?: unknown;
  selectionRule?: unknown;
  tracks: readonly IncompetechManifestTrack[];
};

export type IncompetechImportRejectReason =
  | "invalid_manifest"
  | "unexpected_track_count"
  | "unexpected_genre_count"
  | "duplicate_external_id"
  | "duplicate_sha256"
  | "duplicate_source_url"
  | "duplicate_direct_file_url"
  | "not_cc_by_4"
  | "missing_attribution"
  | "unusable_attribution"
  | "wrong_artist"
  | "missing_audio"
  | "missing_license_evidence"
  | "invalid_license_evidence"
  | "invalid_audio_reference"
  | "invalid_required_field";

export type IncompetechRejectedTrack = {
  index: number;
  externalId: string | null;
  title: string | null;
  reason: IncompetechImportRejectReason;
};

export type IncompetechValidatedTrack = {
  externalId: string;
  isrc: string | null;
  title: string;
  artist: string;
  durationSeconds: number;
  downloadedAt: string;
  genre: IncompetechGenre;
  vocalsClass: Extract<IncompetechVocalsClass, "none">;
  liveSafe: true;
  vodSafe: true;
  commercialAllowed: true;
  rightsStatus: "universal-safe";
  licenseName: "Creative Commons Attribution 4.0";
  licenseUrl: string;
  attributionText: string;
  audio: {
    sourceType: "local_audio";
    storageRef: string;
    sha256: string;
    mimeType: string;
  };
  proofUrl: string;
  proofStorageRef: string | null;
  safetyTags: readonly string[];
  explicitContent: false;
  instrumental: true;
  licensePayload: Record<string, unknown>;
};

export type IncompetechManifestValidationResult =
  | {
    ok: true;
    manifest: IncompetechBulkManifest & { refreshMode: "full" };
    tracks: readonly IncompetechValidatedTrack[];
    rejectedTracks: readonly IncompetechRejectedTrack[];
  }
  | {
    ok: false;
    reason: IncompetechImportRejectReason;
    rejectedTracks: readonly IncompetechRejectedTrack[];
  };
