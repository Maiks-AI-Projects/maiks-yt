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
    extractStableExternalId: (urls: readonly (string | null | undefined)[], audioSha256: string) => string;
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
});
