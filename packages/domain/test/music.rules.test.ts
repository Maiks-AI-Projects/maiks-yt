import { describe, expect, it } from "vitest";

import {
  canControlMusicPlayback,
  canManageMusic,
  decideMusicTrackSelection,
  getAmsterdamCalendarDate,
  incompetechExpectedGenres,
  incompetechManifestVersion,
  incompetechProviderKey,
  isBlockedMusicProviderKey,
  isPublicMusicSelectionReference,
  musicManageCapability,
  musicPlayControlCapability,
  resolveMusicTopTrackLimit,
  shouldQueueMusicTrackReview,
  validateIncompetechManifest,
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

describe("public music selection references", () => {
  it("accepts only the bounded prefixed lowercase SHA-256 shape", () => {
    expect(isPublicMusicSelectionReference(`musicref_v1_${"a".repeat(64)}`)).toBe(true);
    expect(isPublicMusicSelectionReference(`musicref_v1_${"A".repeat(64)}`)).toBe(false);
    expect(isPublicMusicSelectionReference(`musicref_v1_${"a".repeat(63)}`)).toBe(false);
    expect(isPublicMusicSelectionReference(`track-${"a".repeat(64)}`)).toBe(false);
    expect(isPublicMusicSelectionReference(`musicref_v1_${"g".repeat(64)}`)).toBe(false);
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
  downloadedAt: "2026-08-18T09:58:00.000Z",
  genre: "Cinematic",
  vocalsClass: "none",
  liveSafe: true,
  vodSafe: true,
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
      },
      downloadedAt: "2026-08-18T09:58:00.000Z",
      genre: "cinematic",
      vocalsClass: "none",
      liveSafe: true,
      vodSafe: true,
      safetyTags: expect.arrayContaining(["cinematic"]),
      licensePayload: expect.objectContaining({
        downloadedAt: "2026-08-18T09:58:00.000Z",
        genre: "cinematic",
        vocalsClass: "none",
        liveSafe: true,
        vodSafe: true
      })
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

  it("requires acquisition and classification evidence for universal-safe imports", () => {
    const result = validateYouTubeAudioLibraryManifest({
      manifestVersion: youtubeAudioLibraryManifestVersion,
      source: "youtube-studio",
      refreshMode: "partial",
      exportedAt: "2026-08-18T10:00:00.000Z",
      tracks: [
        validYouTubeTrack({
          externalId: "minimal-vocals",
          vocalsClass: "minimal",
          genre: "Electronic / Dance"
        }),
        validYouTubeTrack({
          externalId: "missing-download-time",
          downloadedAt: undefined
        }),
        validYouTubeTrack({
          externalId: "missing-genre",
          genre: ""
        }),
        validYouTubeTrack({
          externalId: "unknown-vocals",
          vocalsClass: "unknown"
        }),
        validYouTubeTrack({
          externalId: "prominent-vocals",
          vocalsClass: "prominent"
        }),
        validYouTubeTrack({
          externalId: "live-only",
          vodSafe: false
        }),
        validYouTubeTrack({
          externalId: "missing-duration",
          durationSeconds: null
        })
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.tracks).toHaveLength(1);
    expect(result.ok && result.tracks[0]).toMatchObject({
      externalId: "minimal-vocals",
      genre: "electronic / dance",
      vocalsClass: "minimal",
      durationSeconds: 124
    });
    expect(result.ok && result.rejectedTracks.map((track) => [track.externalId, track.reason])).toEqual([
      [null, "invalid_required_field"],
      [null, "invalid_required_field"],
      ["unknown-vocals", "invalid_required_field"],
      ["prominent-vocals", "invalid_required_field"],
      ["live-only", "invalid_required_field"],
      [null, "invalid_required_field"]
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

const incompetechSha = (index: number): string => (index + 1).toString(16).padStart(64, "0");

const validIncompetechTrack = (index: number, overrides: Record<string, unknown> = {}) => {
  const genre = incompetechExpectedGenres[Math.floor(index / 4)] ?? "world";
  const sha256 = incompetechSha(index);
  const isrc = `USUAN2300${index.toString().padStart(3, "0")}`;

  return {
    artist: "Kevin MacLeod",
    attributionRequired: true,
    attributionText: `"Track ${index}" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`,
    audio: {
      bitrate: 256000,
      codec: "mp3",
      format: "mp3",
      getContentType: "application/octet-stream",
      headContentType: "application/octet-stream",
      headStatus: 200,
      mimeType: "audio/mpeg",
      path: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/library/${genre}/${sha256}.mp3`,
      sha256,
      storageRef: `music-audio:${sha256}:incompetech/${genre}/${sha256}.mp3`
    },
    catalogDurationSeconds: 151,
    catalogUrl: "https://incompetech.com/music/royalty-free/music.html",
    classificationEvidence: "Official catalog instruments include only instrumental metadata. No vocals signal under the staging gate.",
    commercialAllowed: true,
    description: "Catalog description.",
    directFileUrl: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/Track%20${index}.mp3`,
    downloadedAt: "2026-09-01T02:46:00.108Z",
    durationSeconds: 151.458,
    externalId: isrc,
    instruments: "Piano",
    isrc,
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    liveSafe: true,
    moods: ["Calm"],
    normalizedGenre: genre,
    officialCatalogJsonUrl: "https://incompetech.com/music/royalty-free/pieces.json",
    proof: {
      accessedAt: "2026-09-01T02:46:03.288Z",
      catalogRowPath: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/items/${isrc}/catalog-row.json`,
      catalogRowSha256: "a".repeat(64),
      contentIdCaveat: "Incompetech Content ID evidence is preserved for disputes.",
      itemPagePath: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/items/${isrc}/item-page.html`,
      itemPageSha256: "b".repeat(64),
      provider: "Incompetech",
      providerEvidenceManifest: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/snapshots-manifest.json",
      providerSnapshotSha256: "c".repeat(64),
      url: `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`
    },
    qualityUseCaseNote: "Fits transitions.",
    rightsStatus: "universal-safe",
    sourceGenre: genre,
    sourceUrl: `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`,
    studioEvidence: null,
    title: `Track ${index}`,
    vocalsClass: "none",
    vodSafe: true,
    ...overrides
  };
};

const validIncompetechManifest = (
  overrides: Record<string, unknown> = {},
  trackOverrides: (index: number) => Record<string, unknown> = () => ({})
) => ({
  manifestVersion: incompetechManifestVersion,
  source: incompetechProviderKey,
  sourceClass: "official-provider-manifest",
  generatedAt: "2026-09-01T03:00:00.000Z",
  providerEvidence: [{
    label: "Catalog JSON",
    path: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/pieces_json.json",
    sha256: "c".repeat(64),
    url: "https://incompetech.com/music/royalty-free/pieces.json"
  }, {
    label: "License",
    path: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/license.html",
    sha256: "d".repeat(64),
    url: "https://incompetech.com/music/royalty-free/licenses/"
  }, {
    label: "Content ID",
    path: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/content_id.html",
    sha256: "e".repeat(64),
    url: "https://incompetech.com/music/royalty-free/youtube-contentid.html"
  }],
  tracks: Array.from({ length: 20 }, (_, index) => validIncompetechTrack(index, trackOverrides(index))),
  ...overrides
});

describe("Incompetech manifest validation", () => {
  it("accepts only the exact 20-track CC BY 4.0 manifest shape and preserves private evidence payloads", () => {
    const result = validateIncompetechManifest(validIncompetechManifest());

    expect(result.ok).toBe(true);
    expect(result.ok && result.tracks).toHaveLength(20);
    expect(result.ok && result.tracks[0]).toMatchObject({
      externalId: "USUAN2300000",
      isrc: "USUAN2300000",
      artist: "Kevin MacLeod",
      durationSeconds: 151,
      genre: "contemporary",
      vocalsClass: "none",
      liveSafe: true,
      vodSafe: true,
      commercialAllowed: true,
      rightsStatus: "universal-safe",
      audio: {
        sourceType: "local_audio",
        mimeType: "audio/mpeg"
      },
      licensePayload: expect.objectContaining({
        source: "incompetech",
        sourceUrl: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2300000",
        directFileUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Track%200.mp3",
        downloadedAt: "2026-09-01T02:46:00.108Z",
        genre: "contemporary",
        vocalsClass: "none",
        contentIdCaveat: "Incompetech Content ID evidence is preserved for disputes."
      })
    });
  });

  it("accepts the official attribution format for punctuation-heavy titles", () => {
    const result = validateIncompetechManifest(validIncompetechManifest({}, (index) => index === 0
      ? {
        title: "Sergio's Magic Dustbin",
        attributionText: "\"Sergio's Magic Dustbin\" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/"
      }
      : {}));

    expect(result.ok).toBe(true);
  });

  it("rejects wrong artist identity and unusable attribution text", () => {
    const cases: Array<{
      name: string;
      overrides: Record<string, unknown>;
      reason: string;
    }> = [
      {
        name: "wrong artist",
        overrides: { artist: "Someone Else" },
        reason: "wrong_artist"
      },
      {
        name: "substring artist",
        overrides: { artist: "Not Kevin MacLeod" },
        reason: "wrong_artist"
      },
      {
        name: "placeholder attribution",
        overrides: { attributionText: "placeholder attribution" },
        reason: "unusable_attribution"
      },
      {
        name: "missing exact title",
        overrides: {
          attributionText: "\"Different Title\" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/"
        },
        reason: "unusable_attribution"
      },
      {
        name: "missing Kevin MacLeod",
        overrides: {
          attributionText: "\"Track 0\" Studio Artist (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/"
        },
        reason: "unusable_attribution"
      },
      {
        name: "missing Incompetech",
        overrides: {
          attributionText: "\"Track 0\" Kevin MacLeod\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/"
        },
        reason: "unusable_attribution"
      },
      {
        name: "missing CC BY 4.0 license URL",
        overrides: {
          attributionText: "\"Track 0\" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License"
        },
        reason: "unusable_attribution"
      }
    ];

    for (const testCase of cases) {
      const result = validateIncompetechManifest(validIncompetechManifest({}, (index) => index === 0
        ? testCase.overrides
        : {}));

      expect(result, testCase.name).toMatchObject({
        ok: false,
        reason: testCase.reason
      });
    }
  });

  it("fails closed on wrong counts, duplicate content, unsafe vocals, and missing item evidence", () => {
    expect(validateIncompetechManifest(validIncompetechManifest({
      tracks: Array.from({ length: 19 }, (_, index) => validIncompetechTrack(index))
    }))).toMatchObject({
      ok: false,
      reason: "unexpected_track_count"
    });

    expect(validateIncompetechManifest(validIncompetechManifest({}, (index) => index === 1
      ? {
        audio: {
          ...validIncompetechTrack(1).audio,
          sha256: incompetechSha(0),
          path: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/library/contemporary/${incompetechSha(0)}.mp3`,
          storageRef: `music-audio:${incompetechSha(0)}:incompetech/contemporary/${incompetechSha(0)}.mp3`
        }
      }
      : {}))).toMatchObject({
      ok: false,
      reason: "duplicate_sha256"
    });

    expect(validateIncompetechManifest(validIncompetechManifest({}, (index) => index === 0
      ? { vocalsClass: "unknown" }
      : {}))).toMatchObject({
      ok: false,
      reason: "invalid_required_field"
    });

    expect(validateIncompetechManifest(validIncompetechManifest({}, (index) => index === 0
      ? { proof: null }
      : {}))).toMatchObject({
      ok: false,
      reason: "invalid_required_field"
    });
  });
});
