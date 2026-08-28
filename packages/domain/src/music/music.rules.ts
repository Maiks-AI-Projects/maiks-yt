import {
  blockedMusicProviderKeys,
  musicManageCapability,
  musicPlayControlCapability,
  publicMusicSelectionReferenceMaxLength,
  publicMusicSelectionReferencePrefix,
  type MusicCapability,
  type MusicPlaybackOutcome,
  type MusicSafetyContext,
  type MusicTopTracksValidationResult,
  type MusicTrackSelectionCandidate,
  type MusicTrackSelectionDecision,
  type RankedMusicTrackInput
} from "./music.types.js";

export const defaultMusicTopTrackLimit = 10;
export const maximumMusicTopTrackLimit = 1_000;

const publiclySelectableReviewStates = new Set(["unreviewed", "approved"]);
const blockedProviderKeys = new Set<string>(blockedMusicProviderKeys);
const publicMusicSelectionReferencePattern = new RegExp(
  `^${publicMusicSelectionReferencePrefix}[a-f0-9]{64}$`,
  "u"
);

export const normalizeMusicProviderKey = (providerKey: string): string =>
  providerKey.trim().toLowerCase();

export const isBlockedMusicProviderKey = (providerKey: string): boolean =>
  blockedProviderKeys.has(normalizeMusicProviderKey(providerKey));

export const isPublicMusicSelectionReference = (value: string): boolean =>
  value.length === publicMusicSelectionReferenceMaxLength
  && publicMusicSelectionReferencePattern.test(value);

export const canManageMusic = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is MusicCapability =>
    capability === "*" || capability === musicManageCapability
  );

export const canControlMusicPlayback = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is MusicCapability =>
    capability === "*" || capability === musicPlayControlCapability
  );

export const decideMusicTrackSelection = (
  track: MusicTrackSelectionCandidate,
  context: MusicSafetyContext
): MusicTrackSelectionDecision => {
  if (track.hasActiveBlacklist || track.reviewState === "blacklisted") {
    return { ok: false, reason: "blacklisted" };
  }

  if (track.providerPolicyState !== "allowed") {
    return { ok: false, reason: "provider_not_allowed" };
  }

  if (track.eligibilityState !== "eligible") {
    return { ok: false, reason: "rights_not_eligible" };
  }

  if (!publiclySelectableReviewStates.has(track.reviewState)) {
    return { ok: false, reason: "manual_review_required" };
  }

  if ((context === "live" && !track.liveSafe) || (context === "vod" && !track.vodSafe)) {
    return { ok: false, reason: "not_safe_for_context" };
  }

  return { ok: true };
};

export const resolveMusicTopTrackLimit = (tierAllowance?: number | null): number => {
  if (tierAllowance === undefined || tierAllowance === null || !Number.isInteger(tierAllowance)) {
    return defaultMusicTopTrackLimit;
  }

  return Math.min(Math.max(tierAllowance, defaultMusicTopTrackLimit), maximumMusicTopTrackLimit);
};

export const validateRankedMusicTracks = (
  tracks: readonly RankedMusicTrackInput[],
  limit = defaultMusicTopTrackLimit
): MusicTopTracksValidationResult => {
  const resolvedLimit = resolveMusicTopTrackLimit(limit);

  if (tracks.length > resolvedLimit) {
    return { ok: false, reason: "limit_exceeded" };
  }

  const normalizedTracks = tracks
    .map((track) => ({ trackId: track.trackId.trim(), rank: track.rank }))
    .sort((left, right) => left.rank - right.rank);

  if (normalizedTracks.some((track) =>
    track.trackId.length === 0
    || !Number.isInteger(track.rank)
    || track.rank < 1
    || track.rank > resolvedLimit
  )) {
    return { ok: false, reason: "invalid_rank" };
  }

  if (new Set(normalizedTracks.map((track) => track.trackId)).size !== normalizedTracks.length) {
    return { ok: false, reason: "duplicate_track" };
  }

  if (new Set(normalizedTracks.map((track) => track.rank)).size !== normalizedTracks.length) {
    return { ok: false, reason: "duplicate_rank" };
  }

  return { ok: true, tracks: normalizedTracks };
};

export const shouldQueueMusicTrackReview = (outcome: MusicPlaybackOutcome): boolean =>
  outcome === "skipped" || outcome === "queued-skipped";

export const getAmsterdamCalendarDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};
