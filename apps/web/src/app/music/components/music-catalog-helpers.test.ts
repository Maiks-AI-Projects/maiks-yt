import { describe, expect, it } from "vitest";

import {
  filterMusicTracks,
  getInitialActiveMusicTrackIndex,
  getMusicSafetyLabels,
  getMusicTrackUnavailableReason,
  getNextMusicTrackIndex,
  isMusicTrackSelectable
} from "./music-catalog.service";
import type { MusicCatalogTrack } from "./music-track.types";

const tracks = [
  {
    artist: "Aster Vale",
    attributionCue: "Credit Monstercat Gold",
    id: "track-1",
    liveSafe: true,
    provider: "Monstercat",
    title: "Night Build",
    vodSafe: true
  },
  {
    artist: "Mika Lane",
    id: "track-2",
    liveSafe: false,
    provider: "Pretzel",
    title: "Boss Pull",
    unavailableReason: "Pending catalog review.",
    vodSafe: true
  },
  {
    artist: "Rain Harbor",
    disabledReason: "Provider disabled this region.",
    id: "track-3",
    liveSafe: true,
    provider: "Epidemic Sound",
    title: "Quiet Craft",
    vodSafe: false
  }
] satisfies readonly MusicCatalogTrack[];

describe("music catalog helpers", () => {
  it("filters real catalog rows by title, artist, provider, and attribution cue", () => {
    expect(filterMusicTracks(tracks, "gold").map((track) => track.id)).toEqual(["track-1"]);
    expect(filterMusicTracks(tracks, "pretzel").map((track) => track.id)).toEqual(["track-2"]);
    expect(filterMusicTracks(tracks, "rain").map((track) => track.id)).toEqual(["track-3"]);
  });

  it("keeps empty queries in catalog order", () => {
    expect(filterMusicTracks(tracks, "   ").map((track) => track.id)).toEqual(["track-1", "track-2", "track-3"]);
  });

  it("returns disabled and unavailable reasons before safety fallbacks", () => {
    expect(getMusicTrackUnavailableReason(tracks[1] as MusicCatalogTrack, "live")).toBe("Pending catalog review.");
    expect(getMusicTrackUnavailableReason(tracks[2] as MusicCatalogTrack, "vod")).toBe("Provider disabled this region.");
  });

  it("applies live and VOD safety reasons when requested", () => {
    const baseTrack = tracks[0] as MusicCatalogTrack;
    const liveUnsafe = { ...baseTrack, liveSafe: false };
    const vodUnsafe = { ...baseTrack, vodSafe: false };

    expect(getMusicTrackUnavailableReason(liveUnsafe, "live")).toBe("Not marked safe for live playback.");
    expect(getMusicTrackUnavailableReason(vodUnsafe, "vod")).toBe("Not marked safe for VOD playback.");
  });

  it("finds keyboard indexes while skipping unavailable tracks", () => {
    expect(isMusicTrackSelectable(tracks[1] as MusicCatalogTrack, "none")).toBe(false);
    expect(getInitialActiveMusicTrackIndex(tracks, null, "none")).toBe(0);
    expect(getNextMusicTrackIndex(tracks, 0, "next", "none")).toBe(0);
    expect(getNextMusicTrackIndex(tracks, 0, "last", "none")).toBe(0);
  });

  it("uses selected track as the initial active option when selectable", () => {
    expect(getInitialActiveMusicTrackIndex(tracks, "track-1", "live")).toBe(0);
    expect(getInitialActiveMusicTrackIndex(tracks, "track-2", "live")).toBe(0);
  });

  it("returns compact safety labels", () => {
    expect(getMusicSafetyLabels(tracks[1] as MusicCatalogTrack)).toEqual(["Live review", "VOD safe"]);
  });
});
