import { describe, expect, it } from "vitest";
import type { IncompetechBulkManifest } from "@maiks-yt/domain/music";

import {
  analyzeIncompetechAudioSelection,
  buildPreparedIncompetechManifest,
  buildPreparedManifest,
  expectedIncompetechManifestSha256,
  findMissingAudioFiles,
  getManifestAudioFileNames,
  hasUnsavedImportSelection,
  indexAudioFilesByName,
  safeImportFileName,
  summarizeImportCounts,
  type ImportAudioUpload,
  type ManifestWithFileNames
} from "./admin-music-import-workflow.service";

const incompetechSha = (index: number): string => (index + 1).toString(16).padStart(64, "0");
const incompetechGenres = ["contemporary", "electronica", "jazz", "soundtrack", "world"] as const;

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

const incompetechUploadsFor = (manifest: IncompetechBulkManifest): Map<string, ImportAudioUpload> => {
  const uploads = new Map<string, ImportAudioUpload>();

  for (const track of manifest.tracks) {
    const sha256 = track.audio.sha256;
    if (!sha256) {
      throw new Error("test fixture missing sha256");
    }

    uploads.set(sha256, upload({
      contentType: "audio/mpeg",
      filename: `${sha256}.mp3`,
      sha256,
      storageRef: `music-audio:${sha256}:${sha256}.mp3`
    }));
  }

  return uploads;
};

const incompetechTrack = (
  index: number,
  overrides: Partial<IncompetechBulkManifest["tracks"][number]> = {}
): IncompetechBulkManifest["tracks"][number] => {
  const genre = incompetechGenres[Math.floor(index / 4)] ?? "world";
  const sha256 = incompetechSha(index);
  const isrc = `USUAN23000${String(index).padStart(2, "0")}`;
  const title = index === 3 ? "Sergio's Magic Dustbin" : `Track ${index}`;

  return {
    externalId: isrc,
    isrc,
    title,
    artist: "Kevin MacLeod",
    durationSeconds: 120,
    catalogDurationSeconds: 120,
    downloadedAt: "2026-09-01T00:00:00.000Z",
    normalizedGenre: genre,
    sourceGenre: genre,
    vocalsClass: "none" as const,
    liveSafe: true,
    vodSafe: true,
    commercialAllowed: true,
    rightsStatus: "universal-safe",
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attributionRequired: true,
    attributionText: `"${title}" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`,
    sourceUrl: `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`,
    directFileUrl: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/Track%20${index}.mp3`,
    officialCatalogJsonUrl: "https://incompetech.com/music/royalty-free/pieces.json",
    catalogUrl: "https://incompetech.com/music/royalty-free/music.html",
    classificationEvidence: "Official Incompetech metadata lists this track as instrumental.",
    audio: {
      path: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/library/${genre}/${sha256}.mp3`,
      sha256,
      storageRef: `music-audio:${sha256}:incompetech/${genre}/${sha256}.mp3`,
      mimeType: "audio/mpeg",
      format: "mp3",
      codec: "mp3"
    },
    proof: {
      accessedAt: "2026-09-01T00:00:00.000Z",
      catalogRowPath: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/items/${isrc}/catalog-row.json`,
      catalogRowSha256: "b".repeat(64),
      contentIdCaveat: "Incompetech Content ID evidence is preserved for disputes.",
      itemPagePath: `/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/items/${isrc}/item-page.html`,
      itemPageSha256: "c".repeat(64),
      provider: "Incompetech",
      providerEvidenceManifest: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/snapshots-manifest.json",
      providerSnapshotSha256: "d".repeat(64),
      url: `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`
    },
    ...overrides
  };
};

const incompetechManifest = (
  trackOverrides: (index: number) => Partial<IncompetechBulkManifest["tracks"][number]> = () => ({})
): IncompetechBulkManifest => ({
  manifestVersion: "incompetech-ccby4.v1" as const,
  source: "incompetech" as const,
  generatedAt: "2026-09-01T00:00:00.000Z",
  providerEvidence: [{
    label: "pieces.json",
    path: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/pieces_json.json",
    sha256: "e".repeat(64),
    url: "https://incompetech.com/music/royalty-free/pieces.json"
  }, {
    label: "license",
    path: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/license.html",
    sha256: "f".repeat(64),
    url: "https://incompetech.com/music/royalty-free/licenses/"
  }, {
    label: "content id",
    path: "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/evidence/provider/content_id.html",
    sha256: "1".repeat(64),
    url: "https://incompetech.com/music/royalty-free/youtube-contentid.html"
  }],
  tracks: Array.from({ length: 20 }, (_, index) => incompetechTrack(index, trackOverrides(index)))
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

  it("matches Incompetech selected files by unique SHA basenames or reviewed relative tails", () => {
    const manifest = incompetechManifest();
    const first = incompetechSha(0);
    const second = incompetechSha(1);

    expect(analyzeIncompetechAudioSelection(manifest, [
      { name: `${first}.mp3` },
      { name: `${second}.mp3`, webkitRelativePath: `library/contemporary/${second}.mp3` },
      { name: `${second}.mp3`, webkitRelativePath: `library/contemporary/${second}.mp3` },
      { name: "extra.mp3" }
    ])).toMatchObject({
      duplicates: [`${second}.mp3`],
      expectedCount: 20,
      extra: ["extra.mp3"],
      missing: expect.arrayContaining([`${incompetechSha(2)}.mp3`])
    });
  });

  it("preserves reviewed Incompetech storage refs and rejects mismatched uploads", () => {
    const manifest = incompetechManifest();
    const uploads = incompetechUploadsFor(manifest);
    const result = buildPreparedIncompetechManifest(manifest, uploads);

    expect(expectedIncompetechManifestSha256).toBe("a9b84960595facde28c3f6b5183b442dfe31168130052bf46a12996841676ce5");
    expect(result.ok).toBe(true);
    expect(result.ok ? result.uploadedTrackCount : 0).toBe(20);
    expect(result.ok ? result.manifest.tracks[0]?.audio.storageRef : null)
      .toBe(`music-audio:${incompetechSha(0)}:incompetech/contemporary/${incompetechSha(0)}.mp3`);

    expect(buildPreparedIncompetechManifest(manifest, new Map([[incompetechSha(0), upload()]]))).toEqual({
      ok: false,
      errors: expect.arrayContaining([`Missing upload for ${incompetechSha(1)}.mp3.`])
    });
  });

  it("fails closed when Incompetech evidence is not the reviewed provider contract", () => {
    const manifest = incompetechManifest((index) => index === 0
      ? { artist: "Not Kevin MacLeod" }
      : {});
    const uploads = incompetechUploadsFor(manifest);

    expect(buildPreparedIncompetechManifest(manifest, uploads)).toEqual({
      ok: false,
      errors: ["Incompetech manifest rejected: wrong_artist."]
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
      licenseSnapshotsAppended: 2,
      markedUnavailable: 0,
      received: 3,
      rejected: 1,
      unchanged: 0,
      updated: 1
    })).toBe("2/3 accepted, 1 rejected, 1 created, 1 updated, 0 unchanged, 0 unavailable, 2 snapshots");
  });
});
