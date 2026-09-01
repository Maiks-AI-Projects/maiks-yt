import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MusicControlPanel,
  createRouteControlPayload,
  mergeMusicPlaybackState,
  readRouteControlMessage,
  type MusicPlaybackState
} from "./MusicControlPanel.js";

const route = (
  revision: number,
  controlState: MusicPlaybackState["audioRoutes"][number]["controlState"],
  overrides: Partial<MusicPlaybackState["audioRoutes"][number]> = {}
): MusicPlaybackState["audioRoutes"][number] => ({
  id: "music",
  label: "Music",
  mediaRole: "Music",
  pipeWireSink: "stream_music",
  controlState,
  muted: false,
  revision,
  state: "available",
  volumePercent: 70,
  ...overrides
});

const state = (musicRoute: MusicPlaybackState["audioRoutes"][number]): MusicPlaybackState => ({
  ok: true,
  status: "idle",
  audioRouteId: "music",
  audioRoutes: [musicRoute],
  playbackId: null,
  currentTrack: null,
  reason: null,
  player: {
    authority: "local-agent",
    blockedReason: null,
    connected: true,
    kind: "local-agent",
    lastCommand: null,
    owned: false,
    state: "active"
  }
});

describe("MusicControlPanel route controls", () => {
  it("keeps pending truth over stale polling and accepts the matching acknowledgement", () => {
    const pending = state(route(4, "pending", { volumePercent: 42 }));
    const stale = state(route(3, "acknowledged", { volumePercent: 70 }));
    const acknowledged = state(route(4, "acknowledged", { volumePercent: 42 }));
    const failed = state(route(4, "error", { lastError: "PIPEWIRE_WRITE_FAILED", volumePercent: 70 }));

    expect(mergeMusicPlaybackState(pending, stale).audioRoutes[0]).toMatchObject({
      controlState: "pending",
      revision: 4,
      volumePercent: 42
    });
    expect(mergeMusicPlaybackState(pending, acknowledged).audioRoutes[0]).toMatchObject({
      controlState: "acknowledged",
      revision: 4,
      volumePercent: 42
    });
    expect(mergeMusicPlaybackState(pending, failed).audioRoutes[0]).toMatchObject({
      controlState: "error",
      lastError: "PIPEWIRE_WRITE_FAILED",
      revision: 4
    });
  });

  it("shows pending, acknowledged mute, unavailable, and error truth", () => {
    expect(readRouteControlMessage(route(4, "pending", { volumePercent: 42 }))).toBe("Pending revision 4");
    expect(readRouteControlMessage(route(5, "acknowledged", { muted: true, volumePercent: 42 })))
      .toBe("42% / Muted / revision 5");
    expect(readRouteControlMessage(route(0, "unavailable", {
      muted: null,
      state: "unavailable",
      volumePercent: null
    }))).toBe("Unavailable");
    expect(readRouteControlMessage(route(6, "error", { lastError: "PIPEWIRE_READ_FAILED" })))
      .toBe("Error: PIPEWIRE_READ_FAILED");
  });

  it("builds logical route actions without PipeWire sink or node ids", () => {
    const volume = createRouteControlPayload({ audioRouteId: "communication", volumePercent: 35 });
    const mute = createRouteControlPayload({ audioRouteId: "private", muted: true });

    expect(volume).toEqual({ action: "route.volume.set", audioRouteId: "communication", volumePercent: 35 });
    expect(mute).toEqual({ action: "route.mute.set", audioRouteId: "private", muted: true });
    expect(JSON.stringify([volume, mute])).not.toMatch(/stream_|nodeId|sinkId/u);
  });

  it("renders one gain and mute control for every logical route", () => {
    const markup = renderToStaticMarkup(<MusicControlPanel />);

    for (const label of ["Communication", "Music", "Private", "Game"]) {
      expect(markup).toContain(`aria-label="${label} volume"`);
      expect(markup).toContain(`aria-label="${label} gain"`);
    }
    expect(markup.match(/type="range"/gu)).toHaveLength(4);
    expect(markup.match(/aria-pressed="false"/gu)).toHaveLength(4);
  });
});
