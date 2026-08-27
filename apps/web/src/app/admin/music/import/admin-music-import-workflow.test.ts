import { describe, expect, it } from "vitest";

import {
  buildPreparedManifest,
  findMissingAudioFiles,
  getManifestAudioFileNames,
  hasUnsavedImportSelection,
  indexAudioFilesByName,
  safeImportFileName,
  summarizeImportCounts,
  type ImportAudioUpload,
  type ManifestWithFileNames
} from "./admin-music-import-workflow.service";

const baseManifest = (tracks: ManifestWithFileNames["tracks"]): ManifestWithFileNames => ({
  manifestVersion: "youtube-audio-library.v1",
  exportedAt: "2026-08-20T12:00:00.000Z",
  refreshMode: "partial",
  source: "youtube-studio",
  tracks
});

const upload = (overrides: Partial<ImportAudioUpload> = {}): ImportAudioUpload => ({
  storageRef: `music-audio:${"a".repeat(64)}:track.mp3`,
  filename: "track.mp3",
  contentType: "audio/mpeg",
  sizeBytes: 123,
  sha256: "a".repeat(64),
  ...overrides
});

describe("admin music import workflow", () => {
  it("uses safe basenames for selected manifest and audio file names", () => {
    expect(safeImportFileName("/tmp/private/Track One.mp3")).toBe("Track One.mp3");
    expect(safeImportFileName("")).toBe("unnamed-file");
    expect([...indexAudioFilesByName([{ name: "TRACK.MP3" }]).keys()]).toEqual(["track.mp3"]);
  });

  it("reports missing audio selections without exposing source paths", () => {
    const manifest = baseManifest([
      {
        externalId: "track-1",
        title: "Track One",
        artist: "Artist",
        licenseName: "Creative Commons Attribution 4.0",
        attributionRequired: true,
        fileName: "/private/export/Track One.mp3"
      }
    ]);

    expect(getManifestAudioFileNames(manifest)).toEqual(["Track One.mp3"]);
    expect(findMissingAudioFiles(manifest, [])).toEqual(["Track One.mp3"]);
  });

  it("attaches uploaded storage refs to matching manifest rows", () => {
    const manifest = baseManifest([
      {
        externalId: "track-1",
        title: "Track One",
        artist: "Artist",
        licenseName: "Creative Commons Attribution 4.0",
        attributionRequired: true,
        fileName: "track.mp3",
        audio: {
          sha256: "a".repeat(64),
          mimeType: "audio/mpeg"
        }
      }
    ]);
    const result = buildPreparedManifest(manifest, new Map([["track.mp3", upload()]]));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.uploadedTrackCount : 0).toBe(1);
    expect(result.ok ? result.manifest.tracks[0]?.audio : null).toEqual({
      storageRef: `music-audio:${"a".repeat(64)}:track.mp3`,
      sha256: "a".repeat(64),
      mimeType: "audio/mpeg"
    });
  });

  it("blocks checksum mismatches before dry-run or apply", () => {
    const manifest = baseManifest([
      {
        externalId: "track-1",
        title: "Track One",
        artist: "Artist",
        licenseName: "Creative Commons Attribution 4.0",
        attributionRequired: true,
        fileName: "track.mp3",
        audio: {
          sha256: "b".repeat(64),
          mimeType: "audio/mpeg"
        }
      }
    ]);
    const result = buildPreparedManifest(manifest, new Map([["track.mp3", upload()]]));

    expect(result).toEqual({
      ok: false,
      errors: ["Checksum mismatch for track.mp3."]
    });
  });

  it("tracks unsaved local selections and summarizes dry-run counts", () => {
    expect(hasUnsavedImportSelection({
      applied: false,
      audioFileCount: 2,
      manifestSelected: true,
      prepared: false
    })).toBe(true);
    expect(hasUnsavedImportSelection({
      applied: false,
      audioFileCount: 2,
      manifestSelected: true,
      prepared: true
    })).toBe(true);
    expect(hasUnsavedImportSelection({
      applied: true,
      audioFileCount: 2,
      manifestSelected: true,
      prepared: true
    })).toBe(false);
    expect(summarizeImportCounts({
      accepted: 2,
      created: 1,
      received: 3,
      rejected: 1,
      unchanged: 0,
      updated: 1
    })).toBe("2/3 accepted, 1 rejected, 1 create, 1 update, 0 unchanged");
  });
});
