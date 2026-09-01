import { describe, expect, it, vi } from "vitest";

import { localAgentAudioRouteGainMigrationContract } from "@maiks-yt/events";

import { PipeWireAudioRouteService } from "./pipewire-audio-route.service.js";

const createRunner = () => {
  const state = new Map([
    ["stream_communication", { muted: false, volumePercent: 80 }],
    ["stream_music", { muted: false, volumePercent: 10 }],
    ["stream_private", { muted: true, volumePercent: 65 }],
    ["stream_game", { muted: false, volumePercent: 90 }]
  ]);
  const runPactl = vi.fn(async (args: readonly string[]) => {
    if (args.join(" ") === "list short sinks") {
      return { stdout: [...state.keys()].map((name, index) => `${index + 50}\t${name}\tPipeWire`).join("\n") };
    }
    const sink = args[1] ?? "";
    const route = state.get(sink);
    if (!route) {
      throw new Error(`Unknown sink ${sink}`);
    }
    if (args[0] === "get-sink-volume") {
      return { stdout: `Volume: front-left: 65536 / ${route.volumePercent}% / 0.00 dB, front-right: 65536 / ${route.volumePercent}% / 0.00 dB` };
    }
    if (args[0] === "get-sink-mute") {
      return { stdout: `Mute: ${route.muted ? "yes" : "no"}` };
    }
    if (args[0] === "set-sink-volume") {
      route.volumePercent = Number.parseInt(args[2] ?? "", 10);
      return { stdout: "" };
    }
    if (args[0] === "set-sink-mute") {
      route.muted = args[2] === "1";
      return { stdout: "" };
    }
    throw new Error(`Unexpected pactl call ${args.join(" ")}`);
  });

  return { runPactl, state };
};

describe("PipeWireAudioRouteService", () => {
  it("reads every route from its stable sink name without exposing ephemeral ids", async () => {
    const { runPactl } = createRunner();
    const service = new PipeWireAudioRouteService({ runPactl });

    const routes = await service.inspect();

    expect(routes.map((route) => ({
      id: route.id,
      muted: route.muted,
      pipeWireSink: route.pipeWireSink,
      revision: route.revision,
      volumePercent: route.volumePercent
    }))).toEqual([
      { id: "communication", muted: false, pipeWireSink: "stream_communication", revision: 0, volumePercent: 80 },
      { id: "music", muted: false, pipeWireSink: "stream_music", revision: 0, volumePercent: 10 },
      { id: "private", muted: true, pipeWireSink: "stream_private", revision: 0, volumePercent: 65 },
      { id: "game", muted: false, pipeWireSink: "stream_game", revision: 0, volumePercent: 90 }
    ]);
    expect(JSON.stringify(routes)).not.toMatch(/"(?:node|sink)Id"/u);
    expect(runPactl.mock.calls.flat(2)).not.toContain("50");
  });

  it("applies gain and mute by stable sink name, reads back truth, and rejects stale revisions", async () => {
    const { runPactl } = createRunner();
    const service = new PipeWireAudioRouteService({ runPactl });

    const gained = await service.setVolume({
      audioRouteId: "music",
      revision: 4,
      volumePercent: 42
    });
    const muted = await service.setMute({
      audioRouteId: "music",
      muted: true,
      revision: 5
    });

    expect(gained).toMatchObject({ id: "music", muted: false, revision: 4, volumePercent: 42 });
    expect(muted).toMatchObject({ id: "music", muted: true, revision: 5, volumePercent: 42 });
    expect(runPactl).toHaveBeenCalledWith(["set-sink-volume", "stream_music", "42%"]);
    expect(runPactl).toHaveBeenCalledWith(["set-sink-mute", "stream_music", "1"]);
    await expect(service.setVolume({
      audioRouteId: "music",
      revision: 4,
      volumePercent: 20
    })).rejects.toThrow("stale route revision");
    expect(runPactl).not.toHaveBeenCalledWith(["set-sink-volume", "stream_music", "20%"]);
  });

  it("reports unavailable and read errors without inventing gain state", async () => {
    const runPactl = vi.fn(async (args: readonly string[]) => {
      if (args.join(" ") === "list short sinks") {
        return { stdout: "63\tstream_music\tPipeWire" };
      }
      throw new Error("PipeWire read failed");
    });
    const service = new PipeWireAudioRouteService({ runPactl });

    const routes = await service.inspect();

    expect(routes.find((route) => route.id === "communication")).toMatchObject({
      muted: null,
      state: "unavailable",
      volumePercent: null
    });
    expect(routes.find((route) => route.id === "music")).toMatchObject({
      muted: null,
      state: "error",
      volumePercent: null
    });
  });

  it("defines the deferred one-time migration without executing it", () => {
    expect(localAgentAudioRouteGainMigrationContract).toMatchObject({
      applyMode: "once",
      defaultMuted: false,
      defaultVolumePercent: 70,
      ephemeralNodeIdsAllowed: false,
      headphoneLoopbackAfterMigration: "neutral-transport",
      version: 1
    });
    expect(localAgentAudioRouteGainMigrationContract.routes.map((route) => ({
      id: route.id,
      source: route.effectiveStateSourceName,
      target: route.targetSinkName
    }))).toEqual([
      { id: "communication", source: "stream_communication_to_headphones", target: "stream_communication" },
      { id: "music", source: "stream_music_to_headphones", target: "stream_music" },
      { id: "private", source: "stream_private_to_headphones", target: "stream_private" },
      { id: "game", source: "stream_game_to_headphones", target: "stream_game" }
    ]);
  });
});
