import { describe, expect, it, vi } from "vitest";

import type { CommandEnvelope } from "../../protocol/agent-protocol.types.js";
import { VlcMusicModule } from "./vlc-music.service.js";
import type { VlcMusicBackend, VlcMusicSnapshot } from "./vlc-music.types.js";

const snapshot: VlcMusicSnapshot = {
  activeAudioRouteId: "music",
  available: true,
  playbackId: "playback-1",
  positionSeconds: 0,
  routes: [{
    id: "music",
    label: "Music",
    mediaRole: "Music",
    pipeWireSink: "stream_music",
    controlState: "acknowledged",
    muted: false,
    revision: 0,
    state: "available",
    volumePercent: 70
  }],
  status: "playing"
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

const createBackend = (): VlcMusicBackend & {
  publish: (next: VlcMusicSnapshot) => void;
} => {
  const listeners = new Set<(next: VlcMusicSnapshot) => void>();
  return {
    inspect: async () => ({ available: true, detail: "VLC ready" }),
    play: vi.fn(async () => snapshot),
    pause: vi.fn(async () => ({ ...snapshot, status: "paused" as const })),
    resume: vi.fn(async () => snapshot),
    stop: vi.fn(async () => ({ ...snapshot, status: "stopped" as const })),
    seek: vi.fn(async (_playbackId, positionSeconds) => ({ ...snapshot, positionSeconds })),
    setAudioRouteVolume: vi.fn(async () => snapshot.routes[0]!),
    setAudioRouteMute: vi.fn(async () => snapshot.routes[0]!),
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (next) => {
      for (const listener of listeners) {
        listener(next);
      }
    },
    shutdown: vi.fn(async () => undefined)
  };
};

describe("VlcMusicModule", () => {
  it("advertises the complete VLC command set and routes valid play requests", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal, reportStatus: vi.fn() });

    expect(module.getCapability()).toMatchObject({
      availability: "available",
      actions: [
        "track.play",
        "track.pause",
        "track.resume",
        "track.stop",
        "track.seek",
        "audio-route.volume.set",
        "audio-route.mute.set",
        "status.get"
      ]
    });
    await module.execute(command("track.play", {
      playbackId: "playback-1",
      audioRouteId: "game",
      sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-1",
      startAtSeconds: 12
    }), { signal });
    expect(backend.play).toHaveBeenCalledWith({
      playbackId: "playback-1",
      audioRouteId: "game",
      sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-1",
      startPaused: false,
      startAtSeconds: 12
    }, signal);
  });

  it("rejects insecure remote sources before reaching VLC", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal, reportStatus: vi.fn() });

    await expect(module.execute(command("track.play", {
      playbackId: "playback-1",
      sourceUrl: "http://example.com/audio.mp3"
    }), { signal })).rejects.toThrow();
    expect(backend.play).not.toHaveBeenCalled();
  });

  it("defaults VLC play requests to the Music route and rejects unknown routes", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal, reportStatus: vi.fn() });

    await module.execute(command("track.play", {
      playbackId: "playback-1",
      sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-1"
    }), { signal });
    expect(backend.play).toHaveBeenLastCalledWith(expect.objectContaining({
      audioRouteId: "music"
    }), signal);

    await expect(module.execute(command("track.play", {
      playbackId: "playback-2",
      audioRouteId: "shell;bad",
      sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-2"
    }), { signal })).rejects.toThrow();
  });

  it("publishes backend state changes through module status", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const reportStatus = vi.fn();
    await module.start({ signal: new AbortController().signal, reportStatus });

    backend.publish({ ...snapshot, status: "ended", positionSeconds: 180 });

    expect(reportStatus).toHaveBeenCalledTimes(1);
    expect(module.getStatus().state).toMatchObject({
      playbackId: "playback-1",
      positionSeconds: 180,
      routes: snapshot.routes,
      status: "ended"
    });
  });

  it("routes stable-name gain and mute commands through revisioned backend actions", async () => {
    const backend = createBackend();
    const module = new VlcMusicModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal, reportStatus: vi.fn() });

    await module.execute(command("audio-route.volume.set", {
      audioRouteId: "music",
      revision: 4,
      volumePercent: 42
    }), { signal });
    await module.execute(command("audio-route.mute.set", {
      audioRouteId: "music",
      muted: true,
      revision: 5
    }), { signal });

    expect(backend.setAudioRouteVolume).toHaveBeenCalledWith({
      audioRouteId: "music",
      revision: 4,
      volumePercent: 42
    });
    expect(backend.setAudioRouteMute).toHaveBeenCalledWith({
      audioRouteId: "music",
      muted: true,
      revision: 5
    });
  });
});
