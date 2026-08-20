import { describe, expect, it } from "vitest";

import {
  getAudioOutputStorageKey,
  normalizeAudioOutputLabel,
  parseSavedAudioOutput
} from "./audio-output.service.js";

describe("PWA audio output", () => {
  it("keeps output choices separate per installed surface", () => {
    expect(getAudioOutputStorageKey("/chat")).toBe("maiks.yt.audio-output.chat");
    expect(getAudioOutputStorageKey("/moderation")).toBe("maiks.yt.audio-output.moderation");
    expect(getAudioOutputStorageKey("/control")).toBe("maiks.yt.audio-output.control");
  });

  it("parses only usable saved output selections", () => {
    expect(parseSavedAudioOutput(null)).toBeNull();
    expect(parseSavedAudioOutput("not-json")).toBeNull();
    expect(parseSavedAudioOutput('{"deviceId":"  ","label":"Private"}')).toBeNull();
    expect(parseSavedAudioOutput('{"deviceId":"sink-1","label":" Private   channel "}')).toEqual({
      deviceId: "sink-1",
      label: "Private channel"
    });
  });

  it("uses a safe fallback for hidden device labels", () => {
    expect(normalizeAudioOutputLabel("  ")).toBe("Selected output");
  });
});
