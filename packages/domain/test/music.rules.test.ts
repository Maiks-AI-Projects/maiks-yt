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
  validateYouTubeAudioLibraryManifest,
  validateRankedMusicTracks,
  youtubeAudioLibraryMaxManifestTracks,
  youtubeAudioLibraryManifestVersion,
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

const validYouTubeTrack = (overrides: Record<string, unknown> = {}) => ({
  externalId: "ytal-track-1",
  title: "Safe Studio Track",
  artist: "Studio Artist",
  durationSeconds: 124,
  licenseName: "Creative Commons Attribution 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequired: true,
  attributionText: "Safe Studio Track by Studio Artist is licensed under CC BY 4.0.",
  audio: {
    storageRef: "music-audio:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:safe.mp3",
    sha256: "a".repeat(64),
    mimeType: "audio/mpeg"
  },
  proof: {
    url: "https://artist.example.com/source/safe-studio-track"
  },
  studioEvidence: {
    studioUrl: "https://studio.youtube.com/channel/example/music",
    dialogText: "Safe Studio Track by Studio Artist is licensed under Creative Commons Attribution 4.0. Source: YouTube Studio Audio Library.",
    attributionText: "Safe Studio Track by Studio Artist is licensed under CC BY 4.0.",
    licenseText: "Creative Commons Attribution 4.0",
    sourceText: "Source: YouTube Studio Audio Library",
    sourceUrl: "https://artist.example.com/source/safe-studio-track",
    proofUrl: "https://artist.example.com/source/safe-studio-track"
  },
  ...overrides
});

describe("YouTube Audio Library manifest validation", () => {
  it("allows bounded manifests up to five thousand rows", () => {
    expect(youtubeAudioLibraryMaxManifestTracks).toBe(5_000);
    expect(validateYouTubeAudioLibraryManifest({
      manifestVersion: youtubeAudioLibraryManifestVersion,
      source: "youtube-studio",
      refreshMode: "partial",
      exportedAt: "2026-08-18T10:00:00.000Z",
      tracks: Array.from({ length: 5_001 }, (_, index) => validYouTubeTrack({
        externalId: `track-${index}`
      }))
    })).toEqual({
      ok: false,
      reason: "too_many_tracks",
      rejectedTracks: [{ index: 0, externalId: null, title: null, reason: "too_many_tracks" }]
    });
  });

  it("accepts only Studio CC BY 4.0 rows with attribution, evidence, and audio", () => {
    const result = validateYouTubeAudioLibraryManifest({
      manifestVersion: youtubeAudioLibraryManifestVersion,
      source: "youtube-studio",
      refreshMode: "full",
      exportedAt: "2026-08-18T10:00:00.000Z",
      tracks: [
        validYouTubeTrack(),
        validYouTubeTrack({
          externalId: "standard-license",
          licenseName: "YouTube Audio Library License",
          licenseUrl: "https://www.youtube.com/audiolibrary"
        }),
        validYouTubeTrack({
          externalId: "missing-attribution",
          attributionText: ""
        }),
        validYouTubeTrack({
          externalId: "missing-audio",
          audio: null
        }),
        validYouTubeTrack({
          externalId: "missing-proof",
          proof: null
        }),
        validYouTubeTrack({
          externalId: "missing-captured-evidence",
          studioEvidence: null
        }),
        validYouTubeTrack({
          externalId: "bad-studio-url",
          studioEvidence: {
            studioUrl: "https://www.youtube.com/audiolibrary",
            dialogText: "Safe Studio Track by Studio Artist",
            attributionText: "Safe Studio Track by Studio Artist is licensed under CC BY 4.0.",
            licenseText: "Creative Commons Attribution 4.0",
            sourceText: "Source: artist",
            sourceUrl: "https://artist.example.com/source/safe-studio-track",
            proofUrl: "https://artist.example.com/source/safe-studio-track"
          }
        })
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.tracks).toHaveLength(1);
    expect(result.ok && result.tracks[0]).toMatchObject({
      externalId: "ytal-track-1",
      licenseName: "Creative Commons Attribution 4.0",
      audio: {
        sourceType: "local_audio"
      }
    });
    expect(result.ok && result.rejectedTracks.map((track) => track.reason)).toEqual([
      "not_cc_by_4",
      "missing_attribution",
      "missing_audio",
      "missing_license_evidence",
      "missing_license_evidence",
      "missing_license_evidence"
    ]);
  });

  it("rejects duplicate external ids and unsafe local audio references", () => {
    const result = validateYouTubeAudioLibraryManifest({
      manifestVersion: youtubeAudioLibraryManifestVersion,
      source: "youtube-studio",
      refreshMode: "partial",
      exportedAt: "2026-08-18T10:00:00.000Z",
      tracks: [
        validYouTubeTrack({ externalId: "duplicate" }),
        validYouTubeTrack({ externalId: "duplicate" }),
        validYouTubeTrack({
          externalId: "unsafe-storage",
          audio: {
            storageRef: "file:///tmp/private.mp3",
            sha256: "b".repeat(64),
            mimeType: "audio/mpeg"
          }
        }),
        validYouTubeTrack({
          externalId: "external-url-only",
          audio: {
            sourceUrl: "https://example.com/audio.mp3"
          }
        })
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.tracks).toHaveLength(1);
    expect(result.ok && result.rejectedTracks.map((track) => track.reason)).toEqual([
      "duplicate_external_id",
      "invalid_audio_reference",
      "missing_audio"
    ]);
  });
});
