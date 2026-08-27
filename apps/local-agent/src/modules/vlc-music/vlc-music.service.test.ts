import { describe, expect, it, vi } from "vitest";

import type { CommandEnvelope } from "../../protocol/agent-protocol.types.js";
import { VlcMusicModule } from "./vlc-music.service.js";
import type { VlcMusicBackend, VlcMusicSnapshot } from "./vlc-music.types.js";

const snapshot: VlcMusicSnapshot = {
  available: true,
  playbackId: "playback-1",
  positionSeconds: 0,
  status: "playing",
  volumePercent: 70
};

const command = (action: string, payload: unknown): CommandEnvelope => ({
  type: "command",
  eventId: "event-1",
  commandId: "command-1",
  issuedAt: new Date().toISOString(),
  capability: "vlc-music",
  action,
  payload
});

const createBackend = (): VlcMusicBackend => ({
  inspect: async () => ({ available: true, detail: "VLC ready" }),
  play: vi.fn(async () => snapshot),
  pause: vi.fn(async () => ({ ...snapshot, status: "paused" as const })),
  resume: vi.fn(async () => snapshot),
  stop: vi.fn(async () => ({ ...snapshot, status: "stopped" as const })),
  seek: vi.fn(async (_playbackId, positionSeconds) => ({ ...snapshot, positionSeconds })),
  setVolume: vi.fn(async (volumePercent) => ({ ...snapshot, volumePercent })),
  getSnapshot: () => snapshot,
  shutdown: vi.fn(async () => undefined)
});

describe("VlcMusicModule", () => {
  it("advertises the complete VLC command set and routes valid play requests", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal });

    expect(module.getCapability()).toMatchObject({
      availability: "available",
      actions: ["track.play", "track.pause", "track.resume", "track.stop", "track.seek", "volume.set", "status.get"]
    });
    await module.execute(command("track.play", {
      playbackId: "playback-1",
      sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-1",
      startAtSeconds: 12,
      volumePercent: 55
    }), { signal });
    expect(backend.play).toHaveBeenCalledWith({
      playbackId: "playback-1",
      sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-1",
      startAtSeconds: 12,
      volumePercent: 55
    }, signal);
  });

  it("rejects insecure remote sources before reaching VLC", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal });

    await expect(module.execute(command("track.play", {
      playbackId: "playback-1",
      sourceUrl: "http://example.com/audio.mp3"
    }), { signal })).rejects.toThrow();
    expect(backend.play).not.toHaveBeenCalled();
  });
});
