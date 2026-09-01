import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildVlcAudioRouteEnvironment,
  VlcProcessBackend
} from "./vlc-process.service.js";

const temporaryDirectories = new Set<string>();

const createBackend = (options?: {
  readinessPollMs: number;
  readinessTimeoutMs: number;
  runPactl?: (args: readonly string[]) => Promise<{ stdout: string }>;
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

  it("passes a filesystem media path to VLC RC as an unquoted file URI", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks vlc media-input [test]-"));
    temporaryDirectories.add(directory);
    const mediaPath = path.join(directory, "track #1 [safe] & ready?.mp3");
    const expectedInput = `add ${pathToFileURL(mediaPath).href}`;
    const commandLog = path.join(directory, "vlc-commands.log");
    const inputAccepted = path.join(directory, "input-accepted");
    const vlcPid = path.join(directory, "vlc-pid");
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s' "$$" > ${JSON.stringify(vlcPid)}
while IFS= read -r line; do
  printf '%s\\n' "$line" >> ${JSON.stringify(commandLog)}
  if [[ "$line" == ${JSON.stringify(expectedInput)} ]]; then
    : > ${JSON.stringify(inputAccepted)}
  elif [[ "$line" == add* ]]; then
    printf 'VLC RC rejected media input: %s\\n' "$line" >&2
    exit 64
  elif [[ "$line" == "quit" ]]; then
    exit 0
  fi
done
`, { mode: 0o700 });
    await writeFile(path.join(directory, "pactl"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "--format=json list sinks" ]]; then
  printf '[{"index":41,"name":"stream_music"}]\\n'
elif [[ "$*" == "--format=json list sink-inputs" ]]; then
  if [[ -f ${JSON.stringify(inputAccepted)} ]]; then
    pid="$(<${JSON.stringify(vlcPid)})"
    printf '[{"index":91,"sink":41,"properties":{"application.id":"org.VideoLAN.VLC","application.name":"VLC media player (LibVLC 3.0.23)","application.process.id":"%s","media.role":"video"}}]\\n' "$pid"
  else
    printf '[]\\n'
  fi
elif [[ "$*" == "list short sinks" ]]; then
  printf '41\\tstream_music\\tPipeWire\\ts16le 2ch 48000Hz\\tRUNNING\\n'
elif [[ "$*" == "get-sink-volume stream_music" ]]; then
  printf 'Volume: front-left: 65536 / 100%%%% / 0.00 dB\\n'
elif [[ "$*" == "get-sink-mute stream_music" ]]; then
  printf 'Mute: no\\n'
fi
`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${oldPath ?? ""}`;
    const backend = createBackend({ readinessPollMs: 10, readinessTimeoutMs: 250 });

    try {
      await backend.inspect();
      await expect(backend.play({
        audioRouteId: "music",
        playbackId: "playback-safe-input",
        sourceUrl: mediaPath,
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal)).resolves.toMatchObject({
        activeAudioRouteId: "music",
        playbackId: "playback-safe-input",
        status: "playing"
      });
      const commands = await readFile(commandLog, "utf8");
      expect(commands).toContain(`${expectedInput}\n`);
      expect(commands).not.toContain(`add ${JSON.stringify(mediaPath)}`);
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });

  it("stops the old VLC child before rejecting an unavailable replacement route", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-vlc-process-test-"));
    temporaryDirectories.add(directory);
    const commandLog = path.join(directory, "vlc-commands.log");
    const vlcPid = path.join(directory, "vlc-pid");
    const oldPath = process.env.PATH;
    const cvlcPath = path.join(directory, "cvlc");
    const pactlPath = path.join(directory, "pactl");
    await writeFile(cvlcPath, `#!/usr/bin/env bash
set -euo pipefail
printf '%s' "$$" > ${JSON.stringify(vlcPid)}
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
  pid="$(<${JSON.stringify(vlcPid)})"
  printf '[{"index":91,"sink":1,"properties":{"application.id":"org.VideoLAN.VLC","application.name":"VLC media player (LibVLC 3.0.23)","application.process.id":"%s","media.role":"video"}}]\\n' "$pid"
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
    const vlcPid = path.join(directory, "vlc-pid");
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s' "$$" > ${JSON.stringify(vlcPid)}
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
    pid="$(<${JSON.stringify(vlcPid)})"
    printf '[{"index":91,"sink":41,"properties":{"application.id":"org.VideoLAN.VLC","application.name":"VLC media player (LibVLC 3.0.23)","application.process.id":"%s","media.role":"video"}}]\\n' "$pid"
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

  it.each([
    ["wrong process ID", "wrong-pid"],
    ["missing process ID", "missing-pid"],
    ["wrong stable sink", "wrong-sink"],
    ["missing stable sink mapping", "missing-sink"],
    ["absent sink-input", "absent-input"]
  ] as const)("fails track.play for a %s", async (_label, mode) => {
    const directory = await mkdtemp(path.join(tmpdir(), `maiks-vlc-${mode}-test-`));
    temporaryDirectories.add(directory);
    const vlcPid = path.join(directory, "vlc-pid");
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s' "$$" > ${JSON.stringify(vlcPid)}
while IFS= read -r line; do
  if [[ "$line" == "quit" ]]; then
    exit 0
  fi
done
`, { mode: 0o700 });
    await writeFile(path.join(directory, "pactl"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "list short sinks" ]]; then
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
      readinessTimeoutMs: 80,
      runPactl: async (args) => {
        if (args.join(" ") === "--format=json list sinks") {
          return {
            stdout: JSON.stringify(mode === "wrong-sink"
              ? [{ index: 41, name: "stream_music" }, { index: 42, name: "stream_private" }]
              : [{ index: 41, name: "stream_music" }])
          };
        }
        if (args.join(" ") !== "--format=json list sink-inputs" || mode === "absent-input") {
          return { stdout: "[]" };
        }
        const spawnedPid = await readFile(vlcPid, "utf8").catch(() => "");
        if (!spawnedPid) {
          return { stdout: "[]" };
        }
        const properties: Record<string, string> = {
          "application.id": "org.VideoLAN.VLC",
          "application.name": "VLC media player (LibVLC 3.0.23)",
          "media.role": "video"
        };
        if (mode !== "missing-pid") {
          properties["application.process.id"] = mode === "wrong-pid"
            ? String(Number(spawnedPid) + 1)
            : spawnedPid;
        }
        return {
          stdout: JSON.stringify([{
            index: 91,
            properties,
            sink: mode === "wrong-sink" ? 42 : mode === "missing-sink" ? 99 : 41
          }])
        };
      }
    });

    try {
      await backend.inspect();
      const failure = await backend.play({
        audioRouteId: "music",
        playbackId: `playback-${mode}`,
        sourceUrl: "local-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal).then(() => null, (error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toMatch(/VLC audio readiness timed out.*stream_music/iu);
      if (mode === "wrong-pid") {
        expect((failure as Error).message).toContain("processId=other");
      } else if (mode === "missing-pid") {
        expect((failure as Error).message).toContain("processId=missing");
      } else if (mode === "wrong-sink") {
        expect((failure as Error).message).toContain("processId=expected");
        expect((failure as Error).message).toContain("sink=stream_private");
      } else if (mode === "missing-sink") {
        expect((failure as Error).message).toContain("processId=expected");
        expect((failure as Error).message).toContain("sink=unmapped");
      } else {
        expect((failure as Error).message).toContain("matching VLC sink-input was not present");
      }
      expect((failure as Error).message).not.toMatch(/sink=(41|42|99)\b/u);
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });

  it("forces Pulse output and reports Pulse unavailability truthfully", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-vlc-pulse-unavailable-test-"));
    temporaryDirectories.add(directory);
    const argumentLog = path.join(directory, "vlc-arguments.log");
    const oldPath = process.env.PATH;
    await writeFile(path.join(directory, "cvlc"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > ${JSON.stringify(argumentLog)}
has_pulse=false
for argument in "$@"; do
  if [[ "$argument" == "--aout=pulse" ]]; then
    has_pulse=true
  fi
done
while IFS= read -r line; do
  if [[ "$line" == add* ]]; then
    if [[ "$has_pulse" == true ]]; then
      printf 'Pulse audio output unavailable\\n' >&2
      exit 24
    fi
    printf 'forced Pulse audio output missing\\n' >&2
    exit 25
  fi
done
`, { mode: 0o700 });
    await writeFile(path.join(directory, "pactl"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "list short sinks" ]]; then
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
      readinessTimeoutMs: 250,
      runPactl: async () => ({ stdout: "[]" })
    });

    try {
      await backend.inspect();
      await expect(backend.play({
        audioRouteId: "music",
        playbackId: "playback-pulse-unavailable",
        sourceUrl: "local-media",
        startAtSeconds: 0,
        startPaused: false
      }, new AbortController().signal)).rejects.toThrow(
        /VLC exited before audio readiness.*code 24.*Pulse audio output unavailable/iu
      );
      await expect(readFile(argumentLog, "utf8")).resolves.toContain("--aout=pulse\n");
    } finally {
      await backend.shutdown().catch(() => undefined);
      process.env.PATH = oldPath;
    }
  });
});
