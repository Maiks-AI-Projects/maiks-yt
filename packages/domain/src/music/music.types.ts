export const musicEligibilityStates = ["eligible", "uncertain", "ineligible"] as const;
export type MusicEligibilityState = typeof musicEligibilityStates[number];

export const musicReviewStates = [
  "unreviewed",
  "review",
  "approved",
  "restricted",
  "rejected",
  "blacklisted"
] as const;
export type MusicReviewState = typeof musicReviewStates[number];

export const musicProviderPolicyStates = ["allowed", "review-only", "disabled"] as const;
export type MusicProviderPolicyState = typeof musicProviderPolicyStates[number];

export const musicSafetyContexts = ["live", "vod"] as const;
export type MusicSafetyContext = typeof musicSafetyContexts[number];

export const musicPlaybackOutcomes = [
  "played-full",
  "skipped",
  "stopped",
  "failed",
  "queued-skipped"
] as const;
export type MusicPlaybackOutcome = typeof musicPlaybackOutcomes[number];

export const musicManageCapability = "music:manage" as const;
export const musicPlayControlCapability = "music:play-control" as const;

export const blockedMusicProviderKeys = ["spotify"] as const;

export type MusicCapability =
  | "*"
  | typeof musicManageCapability
  | typeof musicPlayControlCapability;

export type MusicTrackSelectionCandidate = {
  id: string;
  providerPolicyState: MusicProviderPolicyState;
  eligibilityState: MusicEligibilityState;
  reviewState: MusicReviewState;
  liveSafe: boolean;
  vodSafe: boolean;
  hasActiveBlacklist: boolean;
};

export type MusicTrackSelectionDecision =
  | { ok: true }
  | {
    ok: false;
    reason:
      | "provider_not_allowed"
      | "rights_not_eligible"
      | "manual_review_required"
      | "blacklisted"
      | "not_safe_for_context";
  };

export type RankedMusicTrackInput = {
  trackId: string;
  rank: number;
};

export type MusicTopTracksValidationResult =
  | {
    ok: true;
    tracks: readonly RankedMusicTrackInput[];
  }
  | {
    ok: false;
    reason: "limit_exceeded" | "duplicate_track" | "duplicate_rank" | "invalid_rank";
  };

export const publicMusicSelectionReferencePrefix = "musicref_v1_" as const;
export const publicMusicSelectionReferenceDigestLength = 64;
export const publicMusicSelectionReferenceMaxLength =
  publicMusicSelectionReferencePrefix.length + publicMusicSelectionReferenceDigestLength;
export const publicMusicPreviewUrlMaxLength = 1_024;
