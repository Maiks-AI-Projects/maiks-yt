import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildVlcAudioRouteEnvironment,
  VlcProcessBackend
} from "./vlc-process.service.js";

const temporaryDirectories = new Set<string>();

afterEach(async () => {
  for (const directory of temporaryDirectories) {
    await rm(directory, { force: true, recursive: true });
  }
  temporaryDirectories.clear();
});

describe("VLC process audio route environment", () => {
  it.each([
    ["communication", "stream_communication", "Communication"],
    ["music", "stream_music", "Music"],
    ["private", "stream_private", "Private"],
    ["game", "stream_game", "Game"]
  ] as const)("maps %s to its fixed PipeWire sink", (audioRouteId, sink, mediaRole) => {
    expect(buildVlcAudioRouteEnvironment(audioRouteId)).toEqual({
      PULSE_PROP: `application.name=maiks-audio-agent media.role=${mediaRole}`,
      PULSE_SINK: sink
    });
  });

  it("stops the old VLC child before rejecting an unavailable replacement route", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-vlc-process-test-"));
    temporaryDirectories.add(directory);
    const commandLog = path.join(directory, "vlc-commands.log");
    const oldPath = process.env.PATH;
    const cvlcPath = path.join(directory, "cvlc");
    const pactlPath = path.join(directory, "pactl");
    await writeFile(cvlcPath, `#!/usr/bin/env bash
set -euo pipefail
while IFS= read -r line; do
  printf '%s\\n' "$line" >> ${JSON.stringify(commandLog)}
  if [[ "$line" == "quit" ]]; then
    exit 0
  fi
done
`, { mode: 0o700 });
    await writeFile(pactlPath, `#!/usr/bin/env bash
set -euo pipefail
printf '1\\tstream_music\\tPipeWire\\ts16le 2ch 48000Hz\\tRUNNING\\n'
`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${oldPath ?? ""}`;
    const backend = new VlcProcessBackend({
      resolve: async (sourceUrl) => ({
        input: sourceUrl,
        release: async () => undefined
      })
    });

    try {
      await backend.inspect();
      await backend.play({
        audioRouteId: "music",
        playbackId: "playback-1",
        sourceUrl: "first-media",
        startAtSeconds: 0,
        startPaused: false,
        volumePercent: 70
      }, new AbortController().signal);

      await expect(backend.play({
        audioRouteId: "game",
        playbackId: "playback-2",
        sourceUrl: "second-media",
        startAtSeconds: 0,
        startPaused: false,
        volumePercent: 70
      }, new AbortController().signal)).rejects.toThrow("Audio route game is not available");

      await expect(readFile(commandLog, "utf8")).resolves.toContain("quit");
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });
});
