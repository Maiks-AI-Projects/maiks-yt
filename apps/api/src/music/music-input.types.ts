import type { MusicEligibilityState, MusicReviewState } from "@maiks-yt/domain/music";

export type MusicProviderPolicyInput = {
  providerKey: string;
  displayName: string;
  providerType?: string;
  providerStatus?: string;
  rightsState?: MusicEligibilityState;
  publicRequestsEnabled?: boolean;
  publicPlaybackEnabled?: boolean;
  defaultLiveSafe?: boolean;
  defaultVodSafe?: boolean;
  attributionRequired?: boolean;
  localCacheAllowed?: boolean;
  policyUrl?: string | null;
  termsUrl?: string | null;
  notesPrivate?: string | null;
  effectiveUntil?: string | null;
};

export type MusicTrackInput = {
  slug: string;
  title: string;
  artist: string;
  album?: string | null;
  durationSeconds?: number | null;
  isrc?: string | null;
  rightsState?: MusicEligibilityState;
  reviewState?: MusicReviewState;
  liveSafe?: boolean;
  vodSafe?: boolean;
  explicitContent?: boolean;
  instrumental?: boolean;
  safetyTags?: readonly string[];
  notesPrivate?: string | null;
};

export type MusicPlaylistInput = {
  slug: string;
  title: string;
  description?: string | null;
  visibility?: string;
  reviewState?: string;
};

export type MusicTrackSourceInput = {
  providerPolicyId?: string | null;
  providerKey: string;
  sourceType: string;
  sourceLabel: string;
  sourceExternalId?: string | null;
  sourceUrl?: string | null;
  previewUrl?: string | null;
  previewMimeType?: string | null;
  storageRef?: string | null;
  sha256?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  rightsState?: MusicEligibilityState;
  availabilityStatus?: string;
  attributionText?: string | null;
};

export type MusicLicenseSnapshotInput = {
  trackId?: string;
  sourceId?: string;
  providerPolicyId?: string | null;
  licenseName: string;
  licenseKind?: string;
  rightsState?: MusicEligibilityState;
  liveSafe?: boolean;
  vodSafe?: boolean;
  attributionRequired?: boolean;
  attributionText?: string | null;
  proofUrl?: string | null;
  proofStorageRef?: string | null;
  licensePayload?: Record<string, unknown> | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

export type MusicBlacklistInput = {
  scope: string;
  trackId?: string | null;
  sourceId?: string | null;
  providerKey?: string | null;
  normalizedValue: string;
  reason: string;
  severity?: string;
};

export type MusicReviewResolutionAction = "keep" | "restrict" | "reject" | "blacklist";

export type MusicTopTrackPick = {
  trackId: string;
  rank: number;
  title: string;
  artist: string;
  durationSeconds: number | null;
  providerKey: string;
  attributionText: string | null;
  licenseName: string;
  licenseUrl: string | null;
};

export type MusicPlaybackOutcomeInput =
  | "played-full"
  | "skipped"
  | "stopped"
  | "failed"
  | "queued-skipped"
  | "admin-preview";
