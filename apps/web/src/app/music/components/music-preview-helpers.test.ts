import { describe, expect, it } from "vitest";

import {
  canSeekMusicPreview,
  formatMusicPreviewTime,
  normalizeMusicPreviewUrl,
  shouldResetMusicPreviewForSourceChange
} from "./music-preview.service";

describe("music preview helpers", () => {
  it("formats preview time for compact controls", () => {
    expect(formatMusicPreviewTime(0)).toBe("0:00");
    expect(formatMusicPreviewTime(9.9)).toBe("0:09");
    expect(formatMusicPreviewTime(65.2)).toBe("1:05");
    expect(formatMusicPreviewTime(Number.NaN)).toBe("0:00");
  });

  it("allows seek only when duration metadata is finite", () => {
    expect(canSeekMusicPreview(180)).toBe(true);
    expect(canSeekMusicPreview(0)).toBe(false);
    expect(canSeekMusicPreview(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("normalizes blank preview URLs", () => {
    expect(normalizeMusicPreviewUrl(" https://api.maiks.yt/music/previews/track.mp3 ")).toBe("https://api.maiks.yt/music/previews/track.mp3");
    expect(normalizeMusicPreviewUrl("   ")).toBeNull();
    expect(normalizeMusicPreviewUrl(null)).toBeNull();
  });

  it("detects URL changes that require preview reset", () => {
    expect(shouldResetMusicPreviewForSourceChange("/a.mp3", "/a.mp3")).toBe(false);
    expect(shouldResetMusicPreviewForSourceChange(" /a.mp3 ", "/a.mp3")).toBe(false);
    expect(shouldResetMusicPreviewForSourceChange("/a.mp3", "/b.mp3")).toBe(true);
    expect(shouldResetMusicPreviewForSourceChange("/a.mp3", null)).toBe(true);
  });
});
