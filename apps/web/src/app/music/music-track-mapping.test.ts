import { describe, expect, it } from "vitest";

import { adminTrackToMusicSelectTrack, formatMusicDuration, toMusicSelectTrack } from "./music-track-mapping.service";
import type { MusicApiCatalogTrack, MusicTrackAdminRecord } from "./music-api.types";

describe("music track mapping", () => {
  it("keeps corrected preview and safety fields from public catalog rows", () => {
    const track: MusicApiCatalogTrack = {
      artist: "Artist",
      attributionText: "Artist via Provider",
      durationSeconds: 123,
      licenseKind: "catalog",
      licenseName: "Safe license",
      licenseUrl: null,
      liveSafe: false,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      providerKey: "provider",
      providerName: "Provider",
      providerPolicyUrl: null,
      providerTermsUrl: null,
      sourceId: "source",
      sourceLabel: "Main source",
      sourceUrl: null,
      title: "Track",
      trackId: "track",
      vodSafe: true
    };

    expect(toMusicSelectTrack(track)).toMatchObject({
      id: "track::source::source",
      liveSafe: false,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      provider: "Provider",
      sourceId: "source",
      sourceLabel: "Main source",
      vodSafe: true
    });
  });

  it("keeps one track selectable per exact public catalog source", () => {
    const baseTrack: MusicApiCatalogTrack = {
      artist: "Artist",
      attributionText: "Artist via Provider",
      durationSeconds: 123,
      licenseKind: "catalog",
      licenseName: "Safe license",
      licenseUrl: null,
      liveSafe: true,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      providerKey: "provider",
      providerName: "Provider",
      providerPolicyUrl: null,
      providerTermsUrl: null,
      sourceId: "source-a",
      sourceLabel: "Provider source",
      sourceUrl: null,
      title: "Track",
      trackId: "track",
      vodSafe: true
    };

    const first = toMusicSelectTrack(baseTrack);
    const second = toMusicSelectTrack({
      ...baseTrack,
      attributionText: "Artist via Local archive",
      previewUrl: "https://api.maiks.yt/music/previews/track-local.mp3",
      sourceId: "source-b",
      sourceLabel: "Local archive"
    });

    expect(first.trackId).toBe("track");
    expect(second.trackId).toBe("track");
    expect(first.id).toBe("track::source::source-a");
    expect(second.id).toBe("track::source::source-b");
    expect(first.sourceId).toBe("source-a");
    expect(second.sourceId).toBe("source-b");
    expect(first.attributionCue).toBe("Artist via Provider");
    expect(second.attributionCue).toBe("Artist via Local archive");
  });

  it("maps admin tracks without exposing storage references as preview URLs", () => {
    const track: MusicTrackAdminRecord = {
      album: null,
      artist: "Artist",
      createdAt: "2026-08-18T10:00:00.000Z",
      durationSeconds: 90,
      explicitContent: false,
      id: "track",
      instrumental: false,
      isrc: null,
      licenseSnapshots: [],
      liveSafe: true,
      notesPrivate: null,
      reviewState: "approved",
      rightsState: "eligible",
      safetyTags: [],
      slug: "track",
      sources: [{
        attributionText: "Artist via Provider",
        availabilityStatus: "available",
        createdAt: "2026-08-18T10:00:00.000Z",
        durationSeconds: 90,
        id: "source",
        mimeType: "audio/mpeg",
        previewMimeType: "audio/mpeg",
        previewUrl: null,
        providerKey: "provider",
        providerPolicyId: null,
        rightsState: "eligible",
        sourceExternalId: null,
        sourceLabel: "Stored source",
        sourceType: "local_audio",
        sourceUrl: null,
        storageRef: "music/source.mp3",
        sha256: "a".repeat(64),
        trackId: "track",
        updatedAt: "2026-08-18T10:00:00.000Z"
      }],
      title: "Track",
      updatedAt: "2026-08-18T10:00:00.000Z",
      vodSafe: true
    };

    expect(adminTrackToMusicSelectTrack(track).previewUrl).toBeNull();
  });

  it("formats durations for compact rows", () => {
    expect(formatMusicDuration(null)).toBe("Unknown length");
    expect(formatMusicDuration(65)).toBe("1:05");
  });
});
