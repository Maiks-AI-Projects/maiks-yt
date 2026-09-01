import { describe, expect, it } from "vitest";

const loadExporterHelpers = async () =>
  await import(new URL("../../../../scripts/export-youtube-audio-library-studio.mjs", import.meta.url).href) as {
    evidenceMatchesRow: (row: {
      text: string;
      title?: string | null;
      artist?: string | null;
    }, evidence: {
      dialogText?: string | null;
      attributionText?: string | null;
      licenseText?: string | null;
      sourceText?: string | null;
    }) => boolean;
    buildManifestTrack: (input: {
      row: {
        text: string;
        title?: string | null;
        artist?: string | null;
        genre?: string | null;
        vocalsClass?: string | null;
      };
      evidence: {
        dialogText?: string | null;
        attributionText?: string | null;
        licenseText?: string | null;
        sourceText?: string | null;
        sourceUrl?: string | null;
        proofUrl?: string | null;
        licenseUrl?: string | null;
      };
      download: {
        fileName: string;
        sha256: string;
        downloadedAt: string;
        url?: string | null;
      };
      studioUrl: string;
    }) => Record<string, unknown> | null;
    extractStableExternalId: (urls: readonly (string | null | undefined)[], audioSha256: string) => string;
    inferGenreFromRow: (row: { text: string; genre?: string | null }) => string | null;
    inferVocalsClassFromRow: (row: { text: string; vocalsClass?: string | null }) => string;
    normalizeManifestGenre: (value: string | null | undefined) => string | null;
    rowTextMatchesMetadata: (rowText: string | null, row: {
      text: string;
      title?: string | null;
      artist?: string | null;
    }) => boolean;
    resolveExportRefreshMode: (completeness: {
      reachedEnd: boolean;
      tracksExported: number;
      skippedCandidates: number;
      hitMaxTracks: boolean;
      filterApplied: boolean;
    }) => "full" | "partial";
  };

describe("YouTube Audio Library Studio exporter helpers", () => {
  it("uses stable URL ids before falling back to audio hashes", async () => {
    const { extractStableExternalId } = await loadExporterHelpers();

    expect(extractStableExternalId([
      "https://studio.youtube.com/music/details?id=studio-track-123&vid=video-456"
    ], "a".repeat(64))).toBe("studio-track-123");
    expect(extractStableExternalId([
      "https://studio.youtube.com/music/reference/video-456"
    ], "b".repeat(64))).toBe("video-456");
    expect(extractStableExternalId([], "c".repeat(64))).toBe(`audio-sha256-${"c".repeat(64)}`);
  });

  it("marks exports partial unless they positively reach the end without skipped candidates or caps", async () => {
    const { resolveExportRefreshMode } = await loadExporterHelpers();

    expect(resolveExportRefreshMode({
      reachedEnd: true,
      tracksExported: 12,
      skippedCandidates: 0,
      hitMaxTracks: false,
      filterApplied: true
    })).toBe("full");
    expect(resolveExportRefreshMode({
      reachedEnd: true,
      tracksExported: 0,
      skippedCandidates: 0,
      hitMaxTracks: false,
      filterApplied: true
    })).toBe("partial");
    expect(resolveExportRefreshMode({
      reachedEnd: true,
      tracksExported: 12,
      skippedCandidates: 1,
      hitMaxTracks: false,
      filterApplied: true
    })).toBe("partial");
    expect(resolveExportRefreshMode({
      reachedEnd: true,
      tracksExported: 12,
      skippedCandidates: 0,
      hitMaxTracks: true,
      filterApplied: true
    })).toBe("partial");
    expect(resolveExportRefreshMode({
      reachedEnd: true,
      tracksExported: 12,
      skippedCandidates: 0,
      hitMaxTracks: false,
      filterApplied: false
    })).toBe("partial");
  });

  it("requires dialog evidence and row text to match the intended track metadata", async () => {
    const { evidenceMatchesRow, rowTextMatchesMetadata } = await loadExporterHelpers();
    const row = {
      text: "Clean Arc\nStudio Artist\nAttribution required",
      title: "Clean Arc",
      artist: "Studio Artist"
    };

    expect(rowTextMatchesMetadata("Clean Arc\nStudio Artist\nDownload", row)).toBe(true);
    expect(rowTextMatchesMetadata("Different Track\nStudio Artist\nDownload", row)).toBe(false);
    expect(evidenceMatchesRow(row, {
      dialogText: "Clean Arc by Studio Artist",
      attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
      licenseText: "Creative Commons Attribution 4.0",
      sourceText: "Source: YouTube Studio Audio Library"
    })).toBe(true);
    expect(evidenceMatchesRow(row, {
      dialogText: "Different Track by Studio Artist",
      attributionText: "Different Track by Studio Artist is licensed under CC BY 4.0.",
      licenseText: "Creative Commons Attribution 4.0",
      sourceText: "Source: YouTube Studio Audio Library"
    })).toBe(false);
  });

  it("normalizes genre and requires explicit safe vocal classification", async () => {
    const { buildManifestTrack, inferGenreFromRow, inferVocalsClassFromRow, normalizeManifestGenre } = await loadExporterHelpers();
    const evidence = {
      dialogText: "Clean Arc by Studio Artist",
      attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
      licenseText: "Creative Commons Attribution 4.0",
      sourceText: "Source: YouTube Studio Audio Library",
      sourceUrl: "https://artist.example.com/source/clean-arc",
      proofUrl: "https://artist.example.com/source/clean-arc",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/"
    };
    const download = {
      fileName: "clean-arc.mp3",
      sha256: "a".repeat(64),
      downloadedAt: "2026-08-18T10:01:02.000Z"
    };

    expect(normalizeManifestGenre("  Electronic / Dance  ")).toBe("electronic / dance");
    expect(inferGenreFromRow({ text: "Clean Arc\nGenre\nCinematic" })).toBe("cinematic");
    expect(inferVocalsClassFromRow({ text: "Clean Arc\nInstrumental" })).toBe("none");
    expect(inferVocalsClassFromRow({ text: "Clean Arc\nLead vocals" })).toBe("prominent");

    expect(buildManifestTrack({
      row: {
        text: "Clean Arc\nStudio Artist\n2:00",
        title: "Clean Arc",
        artist: "Studio Artist",
        genre: "Cinematic",
        vocalsClass: "minimal"
      },
      evidence,
      download,
      studioUrl: "https://studio.youtube.com/channel/example/music"
    })).toMatchObject({
      title: "Clean Arc",
      downloadedAt: "2026-08-18T10:01:02.000Z",
      genre: "cinematic",
      vocalsClass: "minimal",
      liveSafe: true,
      vodSafe: true
    });
    expect(buildManifestTrack({
      row: {
        text: "Clean Arc\nStudio Artist\n2:00",
        title: "Clean Arc",
        artist: "Studio Artist",
        genre: "Cinematic",
        vocalsClass: "unknown"
      },
      evidence,
      download,
      studioUrl: "https://studio.youtube.com/channel/example/music"
    })).toBeNull();
  });
});
