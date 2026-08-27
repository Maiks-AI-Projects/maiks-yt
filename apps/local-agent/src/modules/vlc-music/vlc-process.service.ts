import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import {
  MUSIC_PIPEWIRE_SINK,
  type VlcMusicBackend,
  type VlcMusicPlayRequest,
  type VlcMusicSnapshot
} from "./vlc-music.types.js";

const stopTimeoutMs = 2_000;

const findExecutable = async (name: string): Promise<string | null> => {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
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
  return null;
};

export class VlcProcessBackend implements VlcMusicBackend {
  #child: ChildProcessWithoutNullStreams | null = null;
  #expectedStop = false;
  #vlcPath: string | null = null;
  #snapshot: VlcMusicSnapshot = {
    available: false,
    playbackId: null,
    positionSeconds: null,
    status: "idle",
    volumePercent: 70
  };

  async inspect(): Promise<{ available: boolean; detail?: string }> {
    this.#vlcPath = await findExecutable("cvlc") ?? await findExecutable("vlc");
    this.#snapshot.available = Boolean(this.#vlcPath);
    this.#snapshot.detail = this.#vlcPath
      ? `VLC ready on ${MUSIC_PIPEWIRE_SINK}`
      : "VLC is not installed or not on PATH";
    return {
      available: this.#snapshot.available,
      ...(this.#snapshot.detail ? { detail: this.#snapshot.detail } : {})
    };
  }

  async play(request: VlcMusicPlayRequest, signal: AbortSignal): Promise<VlcMusicSnapshot> {
    if (!this.#vlcPath) {
      throw new Error("VLC is unavailable");
    }
    if (signal.aborted) {
      throw signal.reason ?? new Error("VLC playback was aborted");
    }

    await this.stop(null);
    this.#expectedStop = false;
    this.#snapshot = {
      ...this.#snapshot,
      playbackId: request.playbackId,
      positionSeconds: request.startAtSeconds,
      status: "loading",
      volumePercent: request.volumePercent
    };
    const child = spawn(this.#vlcPath, [
      "--intf", "rc",
      "--rc-fake-tty",
      "--no-video",
      "--no-video-title-show",
      "--no-media-library",
      "--play-and-exit",
      "--quiet"
    ], {
      env: {
        ...process.env,
        PULSE_PROP: "application.name=maiks-audio-agent media.role=Music",
        PULSE_SINK: MUSIC_PIPEWIRE_SINK
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.#child = child;
    child.stdout.resume();
    child.stderr.resume();
    child.once("error", () => {
      if (this.#child === child) {
        this.#child = null;
        this.#snapshot.status = "error";
      }
    });
    child.once("exit", (code) => {
      if (this.#child !== child) {
        return;
      }
      this.#child = null;
      this.#snapshot.status = this.#expectedStop
        ? "stopped"
        : code === 0
          ? "ended"
          : "error";
    });
    this.#send(`add ${JSON.stringify(request.sourceUrl)}`);
    this.#send(`volume ${Math.round(request.volumePercent * 2.56)}`);
    if (request.startAtSeconds > 0) {
      this.#send(`seek ${request.startAtSeconds}`);
    }
    this.#snapshot.status = "playing";
    return this.getSnapshot();
  }

  async pause(playbackId: string): Promise<VlcMusicSnapshot> {
    this.#requirePlayback(playbackId);
    this.#send("pause");
    this.#snapshot.status = "paused";
    return this.getSnapshot();
  }

  async resume(playbackId: string): Promise<VlcMusicSnapshot> {
    this.#requirePlayback(playbackId);
    this.#send("play");
    this.#snapshot.status = "playing";
    return this.getSnapshot();
  }

  async stop(playbackId: string | null): Promise<VlcMusicSnapshot> {
    if (playbackId && this.#snapshot.playbackId !== playbackId) {
      throw new Error("Playback ID does not match the active VLC track");
    }
    const child = this.#child;
    if (!child) {
      this.#snapshot.status = this.#snapshot.playbackId ? "stopped" : "idle";
      return this.getSnapshot();
    }

    this.#expectedStop = true;
    this.#send("stop");
    this.#send("quit");
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      child.once("exit", finish);
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGTERM");
        }
        finish();
      }, stopTimeoutMs).unref();
    });
    this.#snapshot.status = "stopped";
    return this.getSnapshot();
  }

  async seek(playbackId: string, positionSeconds: number): Promise<VlcMusicSnapshot> {
    this.#requirePlayback(playbackId);
    this.#send(`seek ${positionSeconds}`);
    this.#snapshot.positionSeconds = positionSeconds;
    return this.getSnapshot();
  }

  async setVolume(volumePercent: number): Promise<VlcMusicSnapshot> {
    this.#snapshot.volumePercent = volumePercent;
    if (this.#child) {
      this.#send(`volume ${Math.round(volumePercent * 2.56)}`);
    }
    return this.getSnapshot();
  }

  getSnapshot(): VlcMusicSnapshot {
    return structuredClone(this.#snapshot);
  }

  async shutdown(): Promise<void> {
    await this.stop(null);
  }

  #requirePlayback(playbackId: string): void {
    if (!this.#child || this.#snapshot.playbackId !== playbackId) {
      throw new Error("Playback ID does not match the active VLC track");
    }
  }

  #send(command: string): void {
    if (!this.#child?.stdin.writable) {
      throw new Error("VLC command channel is unavailable");
    }
    this.#child.stdin.write(`${command}\n`);
  }
}
