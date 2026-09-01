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

const manifestTrack = (overrides: Partial<ManifestWithFileNames["tracks"][number]> = {}): ManifestWithFileNames["tracks"][number] => ({
  externalId: "track-1",
  title: "Track One",
  artist: "Artist",
  durationSeconds: 120,
  downloadedAt: "2026-08-20T11:58:00.000Z",
  genre: "cinematic",
  vocalsClass: "none",
  liveSafe: true,
  vodSafe: true,
  licenseName: "Creative Commons Attribution 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequired: true,
  attributionText: "Track One by Artist is licensed under CC BY 4.0.",
  audio: {
    storageRef: `music-audio:${"a".repeat(64)}:track.mp3`,
    sha256: "a".repeat(64),
    mimeType: "audio/mpeg"
  },
  proof: {
    url: "https://artist.example.com/source/track-one"
  },
  studioEvidence: {
    studioUrl: "https://studio.youtube.com/channel/example/music",
    dialogText: "Track One by Artist is licensed under Creative Commons Attribution 4.0.",
    attributionText: "Track One by Artist is licensed under CC BY 4.0.",
    licenseText: "Creative Commons Attribution 4.0",
    sourceText: "Source: YouTube Studio Audio Library",
    sourceUrl: "https://artist.example.com/source/track-one",
    proofUrl: "https://artist.example.com/source/track-one"
  },
  ...overrides
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
      manifestTrack({
        fileName: "/private/export/Track One.mp3"
      })
    ]);

    expect(getManifestAudioFileNames(manifest)).toEqual(["Track One.mp3"]);
    expect(findMissingAudioFiles(manifest, [])).toEqual(["Track One.mp3"]);
  });

  it("attaches uploaded storage refs to matching manifest rows", () => {
    const manifest = baseManifest([
      manifestTrack({
        fileName: "track.mp3",
        audio: {
          sha256: "a".repeat(64),
          mimeType: "audio/mpeg"
        }
      })
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
      manifestTrack({
        fileName: "track.mp3",
        audio: {
          sha256: "b".repeat(64),
          mimeType: "audio/mpeg"
        }
      })
    ]);
    const result = buildPreparedManifest(manifest, new Map([["track.mp3", upload()]]));

    expect(result).toEqual({
      ok: false,
      errors: ["Checksum mismatch for track.mp3."]
    });
  });

  it("blocks prepared manifests with incomplete acquisition or classification evidence", () => {
    const result = buildPreparedManifest(baseManifest([
      manifestTrack({
        externalId: "bad-genre",
        genre: "Cinematic"
      }),
      manifestTrack({
        externalId: "bad-vocals",
        vocalsClass: "unknown"
      })
    ]), new Map());

    expect(result).toEqual({
      ok: false,
      errors: [
        "Track 1 is missing normalized genre evidence.",
        "Track 2 must be instrumental or minimal-vocal."
      ]
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
