import { describe, expect, it } from "vitest";

import {
  adminTrackToMusicSelectTrack,
  formatMusicDuration,
  toMusicSelectTrack,
  toPublicMusicSelectTrack
} from "./music-track-mapping.service";
import type { MusicAccountCatalogTrack, MusicPublicApiCatalogTrack, MusicTrackAdminRecord } from "./music-api.types";

describe("music track mapping", () => {
  it("keeps corrected preview and safety fields from public catalog rows", () => {
    const track: MusicPublicApiCatalogTrack = {
      artist: "Artist",
      attributionText: "Artist via Provider",
      durationSeconds: 123,
      liveSafe: false,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      providerName: "Provider",
      selectionReference: `musicref_v1_${"a".repeat(64)}`,
      sourceLabel: "Main source",
      title: "Track",
      vodSafe: true
    };

    expect(toPublicMusicSelectTrack(track)).toMatchObject({
      id: `musicref_v1_${"a".repeat(64)}`,
      liveSafe: false,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      provider: "Provider",
      selectionReference: `musicref_v1_${"a".repeat(64)}`,
      sourceLabel: "Main source",
      vodSafe: true
    });
  });

  it("keeps one public row selectable per exact opaque reference", () => {
    const baseTrack: MusicPublicApiCatalogTrack = {
      artist: "Artist",
      attributionText: "Artist via Provider",
      durationSeconds: 123,
      liveSafe: true,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      providerName: "Provider",
      selectionReference: `musicref_v1_${"a".repeat(64)}`,
      sourceLabel: "Provider source",
      title: "Track",
      vodSafe: true
    };

    const first = toPublicMusicSelectTrack(baseTrack);
    const second = toPublicMusicSelectTrack({
      ...baseTrack,
      attributionText: "Artist via Local archive",
      previewUrl: "https://api.maiks.yt/music/previews/track-local.mp3",
      selectionReference: `musicref_v1_${"b".repeat(64)}`,
      sourceLabel: "Local archive"
    });

    expect(first.id).toBe(`musicref_v1_${"a".repeat(64)}`);
    expect(second.id).toBe(`musicref_v1_${"b".repeat(64)}`);
    expect(first.attributionCue).toBe("Artist via Provider");
    expect(second.attributionCue).toBe("Artist via Local archive");
  });

  it("keeps authenticated account catalog rows tied to internal track ids for Top 10 saves", () => {
    const track: MusicAccountCatalogTrack = {
      artist: "Artist",
      attributionText: "Artist via Provider",
      durationSeconds: 123,
      liveSafe: true,
      previewMimeType: "audio/mpeg",
      previewUrl: "https://api.maiks.yt/music/previews/track.mp3",
      providerName: "Provider",
      sourceLabel: "Main source",
      title: "Track",
      trackId: "track",
      vodSafe: true
    };

    expect(toMusicSelectTrack(track)).toMatchObject({
      id: "track",
      provider: "Provider",
      sourceId: null,
      title: "Track",
      trackId: "track"
    });
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
