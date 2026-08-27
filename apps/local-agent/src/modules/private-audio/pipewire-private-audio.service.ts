import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { createCueWav } from "./private-cue-data.js";
import {
  PRIVATE_PIPEWIRE_SINK,
  type PrivateAudioAvailability,
  type PrivateAudioBackend,
  type PrivateCueRequest,
  type PrivateSpeechRequest
} from "./private-audio.types.js";

const PIPEWIRE_IDENTITY = "application.name=maiks-audio-agent node.name=maiks-audio-agent";

async function findExecutable(name: string): Promise<string | undefined> {
  const pathValue = process.env.PATH ?? "";
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = path.join(directory, name);
    try {
      await access(candidate, 1);
      return candidate;
    } catch {
      // Continue searching PATH.
    }
  }
  return undefined;
}

function waitForExit(processName: string, child: ChildProcess, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      signal.removeEventListener("abort", abort);
      child.removeListener("error", fail);
    };
    const abort = (): void => {
      child.kill("SIGTERM");
    };
    const fail = (error: Error): void => {
      cleanup();
      reject(error);
    };
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", fail);
    child.once("exit", (code, exitSignal) => {
      cleanup();
      if (signal.aborted) {
        reject(signal.reason ?? new Error(`${processName} was aborted`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${processName} exited with ${code ?? exitSignal ?? "unknown"}`));
      }
    });
  });
}

export class PipeWirePrivateAudioBackend implements PrivateAudioBackend {
  #pwPlayPath: string | undefined;
  #espeakPath: string | undefined;

  async inspect(): Promise<PrivateAudioAvailability> {
    this.#pwPlayPath = await findExecutable("pw-play");
    this.#espeakPath = await findExecutable("espeak-ng");
    if (!this.#pwPlayPath) {
      return { cue: false, tts: false, detail: "pw-play is not installed or not on PATH" };
    }
    if (!this.#espeakPath) {
      return { cue: true, tts: false, detail: "Cue ready; espeak-ng is unavailable" };
    }
    return { cue: true, tts: true };
  }

  async playCue(request: PrivateCueRequest, signal: AbortSignal): Promise<void> {
    const player = this.#spawnPlayer(signal);
    player.stdin?.end(createCueWav(request));
    await waitForExit("pw-play", player, signal);
  }

  async speak(request: PrivateSpeechRequest, signal: AbortSignal): Promise<void> {
    if (!this.#espeakPath) {
      throw new Error("espeak-ng is unavailable");
    }
    const speech = spawn(
      this.#espeakPath,
      ["--stdout", "--stdin", "-s", String(request.rate), ...(request.voice ? ["-v", request.voice] : [])],
      { stdio: ["pipe", "pipe", "inherit"] }
    );
    const player = this.#spawnPlayer(signal);
    speech.stdin?.on("error", () => undefined);
    speech.stdout?.pipe(player.stdin!);
    speech.stdin?.end(request.text);
    try {
      await Promise.all([
        waitForExit("espeak-ng", speech, signal),
        waitForExit("pw-play", player, signal)
      ]);
    } catch (error) {
      speech.kill("SIGTERM");
      player.kill("SIGTERM");
      throw error;
    }
  }

  #spawnPlayer(signal: AbortSignal): ChildProcess {
    if (!this.#pwPlayPath) {
      throw new Error("pw-play is unavailable");
    }
    if (signal.aborted) {
      throw signal.reason ?? new Error("Audio playback was aborted");
    }
    const player = spawn(
      this.#pwPlayPath,
      [
        "--target",
        PRIVATE_PIPEWIRE_SINK,
        "--media-role",
        "Notification",
        "--properties",
        PIPEWIRE_IDENTITY,
        "-"
      ],
      {
        env: { ...process.env, PIPEWIRE_PROPS: PIPEWIRE_IDENTITY },
        stdio: ["pipe", "inherit", "inherit"]
      }
    );
    player.stdin?.on("error", () => undefined);
    return player;
  }
}
