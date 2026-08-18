import { describe, expect, it } from "vitest";

import {
  canControlMusicPlayback,
  canManageMusic,
  decideMusicTrackSelection,
  getAmsterdamCalendarDate,
  isBlockedMusicProviderKey,
  musicManageCapability,
  musicPlayControlCapability,
  resolveMusicTopTrackLimit,
  shouldQueueMusicTrackReview,
  validateRankedMusicTracks,
  type MusicTrackSelectionCandidate
} from "../src/music/index.js";

const candidate = (overrides: Partial<MusicTrackSelectionCandidate> = {}): MusicTrackSelectionCandidate => ({
  id: "track-1",
  providerPolicyState: "allowed",
  eligibilityState: "eligible",
  reviewState: "unreviewed",
  liveSafe: true,
  vodSafe: true,
  hasActiveBlacklist: false,
  ...overrides
});

describe("music permissions", () => {
  it("keeps management and playback capabilities separate", () => {
    expect(canManageMusic(["*"])).toBe(true);
    expect(canManageMusic([musicManageCapability])).toBe(true);
    expect(canManageMusic([musicPlayControlCapability])).toBe(false);
    expect(canControlMusicPlayback([musicPlayControlCapability])).toBe(true);
    expect(canControlMusicPlayback([musicManageCapability])).toBe(false);
  });
});

describe("music selection safety", () => {
  it("hard-blocks Spotify provider keys", () => {
    expect(isBlockedMusicProviderKey("spotify")).toBe(true);
    expect(isBlockedMusicProviderKey(" Spotify ")).toBe(true);
    expect(isBlockedMusicProviderKey("pretzel-rocks")).toBe(false);
  });

  it("allows eligible unreviewed tracks without manual pre-approval", () => {
    expect(decideMusicTrackSelection(candidate(), "live")).toEqual({ ok: true });
  });

  it("makes blacklist precedence immediate", () => {
    expect(decideMusicTrackSelection(candidate({ hasActiveBlacklist: true }), "live")).toEqual({
      ok: false,
      reason: "blacklisted"
    });
  });

  it("fails closed for uncertain rights, review state, provider policy, and context", () => {
    expect(decideMusicTrackSelection(candidate({ eligibilityState: "uncertain" }), "live")).toEqual({
      ok: false,
      reason: "rights_not_eligible"
    });
    expect(decideMusicTrackSelection(candidate({ reviewState: "review" }), "live")).toEqual({
      ok: false,
      reason: "manual_review_required"
    });
    expect(decideMusicTrackSelection(candidate({ providerPolicyState: "review-only" }), "live")).toEqual({
      ok: false,
      reason: "provider_not_allowed"
    });
    expect(decideMusicTrackSelection(candidate({ liveSafe: false }), "live")).toEqual({
      ok: false,
      reason: "not_safe_for_context"
    });
  });
});

describe("member music allowance", () => {
  it("defaults to ten while permitting future larger tier allowances", () => {
    expect(resolveMusicTopTrackLimit()).toBe(10);
    expect(resolveMusicTopTrackLimit(5)).toBe(10);
    expect(resolveMusicTopTrackLimit(25)).toBe(25);
  });

  it("normalizes ranked tracks and rejects duplicates or excess picks", () => {
    expect(validateRankedMusicTracks([
      { trackId: " second ", rank: 2 },
      { trackId: "first", rank: 1 }
    ])).toEqual({
      ok: true,
      tracks: [
        { trackId: "first", rank: 1 },
        { trackId: "second", rank: 2 }
      ]
    });
    expect(validateRankedMusicTracks([
      { trackId: "same", rank: 1 },
      { trackId: "same", rank: 2 }
    ])).toEqual({ ok: false, reason: "duplicate_track" });
    expect(validateRankedMusicTracks(Array.from({ length: 11 }, (_, index) => ({
      trackId: `track-${index}`,
      rank: index + 1
    })))).toEqual({ ok: false, reason: "limit_exceeded" });
  });
});

describe("music playback audit", () => {
  it("queues skipped tracks for review without treating every stop as dislike", () => {
    expect(shouldQueueMusicTrackReview("skipped")).toBe(true);
    expect(shouldQueueMusicTrackReview("queued-skipped")).toBe(true);
    expect(shouldQueueMusicTrackReview("stopped")).toBe(false);
  });

  it("uses Amsterdam calendar days across UTC date boundaries", () => {
    expect(getAmsterdamCalendarDate(new Date("2026-01-01T23:30:00.000Z"))).toBe("2026-01-02");
    expect(getAmsterdamCalendarDate(new Date("2026-07-01T21:30:00.000Z"))).toBe("2026-07-01");
  });
});
