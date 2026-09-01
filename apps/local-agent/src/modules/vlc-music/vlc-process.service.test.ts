import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildVlcAudioRouteEnvironment,
  VlcProcessBackend
} from "./vlc-process.service.js";

const temporaryDirectories = new Set<string>();

const createBackend = (options?: {
  readinessPollMs: number;
  readinessTimeoutMs: number;
}): VlcProcessBackend => Reflect.construct(VlcProcessBackend, [{
  resolve: async (sourceUrl: string) => ({
    input: sourceUrl,
    release: async () => undefined
  })
}, undefined, options]) as VlcProcessBackend;

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
      PULSE_PROP: `application.id=org.VideoLAN.VLC application.name=maiks-audio-agent media.role=${mediaRole}`,
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
if [[ "$*" == "--format=json list sinks" ]]; then
  printf '[{"index":1,"name":"stream_music"}]\\n'
elif [[ "$*" == "--format=json list sink-inputs" ]]; then
  printf '[{"index":91,"sink":1,"properties":{"application.id":"org.VideoLAN.VLC","application.name":"maiks-audio-agent","media.role":"Music"}}]\\n'
elif [[ "$*" == "list short sinks" ]]; then
  printf '1\\tstream_music\\tPipeWire\\ts16le 2ch 48000Hz\\tRUNNING\\n'
elif [[ "\${1:-}" == "get-sink-volume" ]]; then
  printf 'Volume: front-left: 65536 / 100%% / 0.00 dB, front-right: 65536 / 100%% / 0.00 dB\\n'
elif [[ "\${1:-}" == "get-sink-mute" ]]; then
  printf 'Mute: no\\n'
fi
`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${oldPath ?? ""}`;
    const backend = createBackend({
      readinessPollMs: 10,
      readinessTimeoutMs: 250
    });

    try {
      await backend.inspect();
      await backend.play({
        audioRouteId: "music",
        playbackId: "playback-1",
        sourceUrl: "first-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal);

      await expect(backend.play({
        audioRouteId: "game",
        playbackId: "playback-2",
        sourceUrl: "second-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal)).rejects.toThrow("Audio route game is not available");

      await expect(readFile(commandLog, "utf8")).resolves.toContain("quit");
      await expect(readFile(commandLog, "utf8")).resolves.toContain("volume 256");
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });

  it("keeps track.play pending until the VLC sink-input reaches the selected stable sink", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-vlc-readiness-test-"));
    temporaryDirectories.add(directory);
    const readinessCount = path.join(directory, "readiness-count");
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
while IFS= read -r line; do
  if [[ "$line" == "quit" ]]; then
    exit 0
  fi
done
`, { mode: 0o700 });
    await writeFile(path.join(directory, "pactl"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "--format=json list sinks" ]]; then
  printf '[{"index":41,"name":"stream_music"}]\\n'
elif [[ "$*" == "--format=json list sink-inputs" ]]; then
  count=0
  if [[ -f ${JSON.stringify(readinessCount)} ]]; then
    count="$(<${JSON.stringify(readinessCount)})"
  fi
  count="$((count + 1))"
  printf '%s' "$count" > ${JSON.stringify(readinessCount)}
  if (( count < 3 )); then
    printf '[]\\n'
  else
    printf '[{"index":91,"sink":41,"properties":{"application.id":"org.VideoLAN.VLC","application.name":"maiks-audio-agent","media.role":"Music"}}]\\n'
  fi
elif [[ "$*" == "list short sinks" ]]; then
  printf '41\\tstream_music\\tPipeWire\\ts16le 2ch 48000Hz\\tRUNNING\\n'
elif [[ "$*" == "get-sink-volume stream_music" ]]; then
  printf 'Volume: front-left: 65536 / 100%% / 0.00 dB\\n'
elif [[ "$*" == "get-sink-mute stream_music" ]]; then
  printf 'Mute: no\\n'
fi
`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${oldPath ?? ""}`;
    const backend = createBackend({
      readinessPollMs: 10,
      readinessTimeoutMs: 250
    });

    try {
      await backend.inspect();
      const play = backend.play({
        audioRouteId: "music",
        playbackId: "playback-delayed",
        sourceUrl: "local-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal);

      await expect(play).resolves.toMatchObject({
        activeAudioRouteId: "music",
        playbackId: "playback-delayed",
        status: "playing"
      });
      const count = Number(await readFile(readinessCount, "utf8").catch(() => "0"));
      expect(count).toBeGreaterThanOrEqual(3);
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });

  it("fails track.play when VLC exits before an expected sink-input is ready", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-vlc-exit-test-"));
    temporaryDirectories.add(directory);
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
while IFS= read -r line; do
  if [[ "$line" == add* ]]; then
    printf 'decoder failed for local media https://api.example.test/audio?accessToken=fake-secret Bearer fake-bearer\\n' >&2
    exit 23
  fi
done
`, { mode: 0o700 });
    await writeFile(path.join(directory, "pactl"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "--format=json list sinks" ]]; then
  printf '[{"index":41,"name":"stream_music"}]\\n'
elif [[ "$*" == "--format=json list sink-inputs" ]]; then
  printf '[]\\n'
elif [[ "$*" == "list short sinks" ]]; then
  printf '41\\tstream_music\\tPipeWire\\ts16le 2ch 48000Hz\\tRUNNING\\n'
elif [[ "$*" == "get-sink-volume stream_music" ]]; then
  printf 'Volume: front-left: 65536 / 100%% / 0.00 dB\\n'
elif [[ "$*" == "get-sink-mute stream_music" ]]; then
  printf 'Mute: no\\n'
fi
`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${oldPath ?? ""}`;
    const backend = createBackend({
      readinessPollMs: 10,
      readinessTimeoutMs: 250
    });

    try {
      await backend.inspect();
      const failure = await backend.play({
        audioRouteId: "music",
        playbackId: "playback-exit",
        sourceUrl: "local-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal).then(() => null, (error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toMatch(
        /VLC exited before audio readiness.*code 23.*decoder failed for local media.*\[redacted-url\]/iu
      );
      expect((failure as Error).message).not.toContain("fake-secret");
      expect((failure as Error).message).not.toContain("fake-bearer");
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });

  it("fails track.play when VLC never reaches the selected stable sink", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-vlc-wrong-sink-test-"));
    temporaryDirectories.add(directory);
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
while IFS= read -r line; do
  if [[ "$line" == "quit" ]]; then
    exit 0
  fi
done
`, { mode: 0o700 });
    await writeFile(path.join(directory, "pactl"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "--format=json list sinks" ]]; then
  printf '[{"index":41,"name":"stream_music"},{"index":42,"name":"stream_private"}]\\n'
elif [[ "$*" == "--format=json list sink-inputs" ]]; then
  printf '[{"index":91,"sink":42,"properties":{"application.id":"org.VideoLAN.VLC","application.name":"maiks-audio-agent","media.role":"Music"}}]\\n'
elif [[ "$*" == "list short sinks" ]]; then
  printf '41\\tstream_music\\tPipeWire\\ts16le 2ch 48000Hz\\tRUNNING\\n'
elif [[ "$*" == "get-sink-volume stream_music" ]]; then
  printf 'Volume: front-left: 65536 / 100%% / 0.00 dB\\n'
elif [[ "$*" == "get-sink-mute stream_music" ]]; then
  printf 'Mute: no\\n'
fi
`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${oldPath ?? ""}`;
    const backend = createBackend({
      readinessPollMs: 10,
      readinessTimeoutMs: 80
    });

    try {
      await backend.inspect();
      await expect(backend.play({
        audioRouteId: "music",
        playbackId: "playback-wrong-sink",
        sourceUrl: "local-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal)).rejects.toThrow(
        /VLC audio readiness timed out.*stream_music/iu
      );
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });
});
