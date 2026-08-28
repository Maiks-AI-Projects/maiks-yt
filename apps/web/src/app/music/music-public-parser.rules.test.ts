import { describe, expect, it } from "vitest";
import { publicMusicPreviewUrlMaxLength } from "@maiks-yt/domain/music";

import {
  parsePublicMusicCatalogResponse,
  parsePublicMusicRequestResponse
} from "./music-public-parser.rules";

const publicRef = (value: string): string => `musicref_v1_${value.repeat(64)}`;
const canonicalOverflowPreviewUrl = `https://example.com/${"\u00e9".repeat(200)}`;

const createPublicMusicTrack = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  selectionReference: publicRef("a"),
  title: "Night Build",
  artist: "Aster Vale",
  durationSeconds: 180,
  providerName: "Safe Provider",
  sourceLabel: "Creator catalog",
  liveSafe: true,
  vodSafe: true,
  previewUrl: "https://cdn.example.com/night-build.mp3",
  previewMimeType: "audio/mpeg",
  attributionText: "Aster Vale via Safe Provider",
  ...overrides
});

describe("public music catalog parsing", () => {
  it("accepts the exact minimized anonymous catalog contract", () => {
    const parsed = parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack()]
    });

    expect(parsed).toEqual({
      ok: true,
      tracks: [createPublicMusicTrack()]
    });
    expect(Object.keys(parsed?.ok ? parsed.tracks[0] ?? {} : {})).toEqual([
      "selectionReference",
      "title",
      "artist",
      "durationSeconds",
      "providerName",
      "sourceLabel",
      "liveSafe",
      "vodSafe",
      "previewUrl",
      "previewMimeType",
      "attributionText"
    ]);
    expect(JSON.stringify(parsed)).not.toContain("\"trackId\"");
    expect(JSON.stringify(parsed)).not.toContain("\"sourceId\"");
  });

  it.each([
    ["track id", { trackId: "internal-track" }],
    ["source id", { sourceId: "internal-source" }],
    ["provider key", { providerKey: "provider-key" }],
    ["source URL", { sourceUrl: "https://example.com/source" }],
    ["license name", { licenseName: "Internal license" }],
    ["license kind", { licenseKind: "platform-library" }],
    ["license proof URL", { licenseUrl: "https://example.com/proof" }],
    ["provider policy URL", { providerPolicyUrl: "https://example.com/policy" }],
    ["provider terms URL", { providerTermsUrl: "https://example.com/terms" }],
    ["review state", { reviewState: "approved" }]
  ])("rejects extra/internal anonymous catalog fields: %s", (_label, overrides) => {
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack(overrides)]
    })).toBeNull();
  });

  it("rejects extra envelope keys and duplicate references", () => {
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack()],
      debug: "internal"
    })).toBeNull();
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [
        createPublicMusicTrack(),
        createPublicMusicTrack({ title: "Duplicate reference" })
      ]
    })).toBeNull();
  });

  it("accepts a producer-redacted null preview pair without poisoning the catalog", () => {
    expect(canonicalOverflowPreviewUrl.length).toBeLessThanOrEqual(publicMusicPreviewUrlMaxLength);
    expect(new URL(canonicalOverflowPreviewUrl).toString().length).toBeGreaterThan(publicMusicPreviewUrlMaxLength);
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack({
        attributionText: null,
        previewMimeType: null,
        previewUrl: null
      })]
    })).toMatchObject({ ok: true });
  });

  it("accepts a safe preview URL with a nullable MIME type", () => {
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack({
        previewMimeType: null
      })]
    })).toMatchObject({ ok: true });
  });

  it("accepts every positive safe-integer duration the producer can emit", () => {
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack({
        durationSeconds: Number.MAX_SAFE_INTEGER
      })]
    })).toMatchObject({ ok: true });
  });

  it.each([
    ["malformed reference prefix", { selectionReference: `track_${"a".repeat(64)}` }],
    ["uppercase reference", { selectionReference: publicRef("A") }],
    ["empty title", { title: "" }],
    ["overlong artist", { artist: "x".repeat(192) }],
    ["zero duration", { durationSeconds: 0 }],
    ["non-finite duration", { durationSeconds: Number.POSITIVE_INFINITY }],
    ["unsafe integer duration", { durationSeconds: Number.MAX_SAFE_INTEGER + 1 }],
    ["javascript preview URL", { previewUrl: "javascript:alert(1)" }],
    ["canonical preview URL overflow", { previewUrl: canonicalOverflowPreviewUrl }],
    ["MIME without preview URL", { previewUrl: null }],
    ["overlong attribution", { attributionText: "x".repeat(1_001) }],
    ["non-boolean live badge", { liveSafe: "true" }]
  ])("rejects malformed bounded public music data: %s", (_label, overrides) => {
    expect(parsePublicMusicCatalogResponse({
      ok: true,
      tracks: [createPublicMusicTrack(overrides)]
    })).toBeNull();
  });

  it("accepts only the finite public catalog failure reason", () => {
    expect(parsePublicMusicCatalogResponse({
      ok: false,
      reason: "music_unavailable"
    })).toEqual({
      ok: false,
      reason: "music_unavailable"
    });

    expect(parsePublicMusicCatalogResponse({
      ok: false,
      reason: "not_authenticated"
    })).toBeNull();
  });
});

describe("public music request parsing", () => {
  it("accepts only the minimal successful request acknowledgement", () => {
    expect(parsePublicMusicRequestResponse({
      ok: true,
      accepted: true
    })).toEqual({
      ok: true,
      accepted: true
    });
    expect(parsePublicMusicRequestResponse({
      ok: true,
      accepted: true,
      trackId: "internal"
    })).toBeNull();
    expect(parsePublicMusicRequestResponse({
      ok: true,
      accepted: false
    })).toBeNull();
  });

  it.each([
    "music_invalid_input",
    "music_request_daily_limit",
    "music_request_unavailable",
    "music_track_not_selectable"
  ])("accepts finite request failure reason %s", (reason) => {
    expect(parsePublicMusicRequestResponse({
      ok: false,
      reason
    })).toEqual({
      ok: false,
      reason
    });
  });

  it.each([
    "not_authenticated",
    "music_admin_forbidden",
    "database_error"
  ])("rejects non-public request failure reason %s", (reason) => {
    expect(parsePublicMusicRequestResponse({
      ok: false,
      reason
    })).toBeNull();
  });
});
