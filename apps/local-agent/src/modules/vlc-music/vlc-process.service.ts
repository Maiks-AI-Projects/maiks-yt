import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  getLocalAgentAudioRouteDefinition,
  type LocalAgentAudioRouteId,
  type LocalAgentAudioRouteStatus
} from "@maiks-yt/events";

import { PipeWireAudioRouteService } from "./pipewire-audio-route.service.js";
import {
  type VlcMusicBackend,
  type VlcMusicPlayRequest,
  type VlcMusicSnapshot
} from "./vlc-music.types.js";
import type { ResolvedVlcMediaSource, VlcMediaSourceResolver } from "./vlc-media-source.service.js";

const stopTimeoutMs = 2_000;
export const buildVlcAudioRouteEnvironment = (
  audioRouteId: LocalAgentAudioRouteId
): {
  PULSE_PROP: string;
  PULSE_SINK: string;
} => {
  const route = getLocalAgentAudioRouteDefinition(audioRouteId);
  return {
    PULSE_PROP: `application.id=org.VideoLAN.VLC application.name=maiks-audio-agent media.role=${route.mediaRole}`,
    PULSE_SINK: route.pipeWireSink
  };
};

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
  #activeAudioRouteId: LocalAgentAudioRouteId = DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID;
  #positionBaseSeconds = 0;
  #positionStartedAtMs: number | null = null;
  #vlcPath: string | null = null;
  readonly #listeners = new Set<(snapshot: VlcMusicSnapshot) => void>();
  readonly #mediaSourceResolver: VlcMediaSourceResolver;
  readonly #audioRoutes: PipeWireAudioRouteService;
  #resolvedMedia: ResolvedVlcMediaSource | null = null;
  #snapshot: VlcMusicSnapshot = {
    activeAudioRouteId: DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
    available: false,
    playbackId: null,
    positionSeconds: null,
    routes: [],
    status: "idle"
  };

  constructor(
    mediaSourceResolver: VlcMediaSourceResolver,
    audioRoutes: PipeWireAudioRouteService = new PipeWireAudioRouteService()
  ) {
    this.#mediaSourceResolver = mediaSourceResolver;
    this.#audioRoutes = audioRoutes;
  }

  async inspect(): Promise<{ available: boolean; detail?: string }> {
    this.#vlcPath = await findExecutable("cvlc") ?? await findExecutable("vlc");
    const routes = await this.#inspectAudioRoutes();
    const activeRoute = routes.find((route) => route.id === this.#activeAudioRouteId);
    this.#snapshot.routes = routes;
    this.#snapshot.available = Boolean(this.#vlcPath);
    this.#snapshot.detail = this.#vlcPath
      ? activeRoute?.state === "available"
        ? `VLC ready on ${activeRoute.pipeWireSink}`
        : `VLC ready; route ${activeRoute?.pipeWireSink ?? this.#activeAudioRouteId} is not available`
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
    this.#activeAudioRouteId = request.audioRouteId;
    this.#snapshot.activeAudioRouteId = request.audioRouteId;
    await this.inspect();
    const requestedRoute = this.#snapshot.routes.find((route) => route.id === request.audioRouteId);
    if (requestedRoute?.state !== "available") {
      throw new Error(`Audio route ${request.audioRouteId} is not available`);
    }

    const resolvedMedia = await this.#mediaSourceResolver.resolve(request.sourceUrl, signal);
    this.#resolvedMedia = resolvedMedia;
    this.#expectedStop = false;
    this.#snapshot = {
      ...this.#snapshot,
      activeAudioRouteId: request.audioRouteId,
      playbackId: request.playbackId,
      positionSeconds: request.startAtSeconds,
      status: "loading"
    };
    this.#positionBaseSeconds = request.startAtSeconds;
    this.#positionStartedAtMs = request.startPaused ? null : Date.now();
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
        ...buildVlcAudioRouteEnvironment(request.audioRouteId)
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.#child = child;
    child.stdout.resume();
    child.stderr.resume();
    child.once("error", () => {
      if (this.#child === child) {
        this.#capturePosition(false);
        this.#child = null;
        this.#snapshot.status = "error";
        void this.#releaseMedia();
        this.#publish();
      }
    });
    child.once("exit", (code) => {
      if (this.#child !== child) {
        return;
      }
      this.#capturePosition(false);
      this.#child = null;
      this.#snapshot.status = this.#expectedStop
        ? "stopped"
        : code === 0
          ? "ended"
          : "error";
      void this.#releaseMedia();
      this.#publish();
    });
    this.#send(`add ${JSON.stringify(resolvedMedia.input)}`);
    this.#send("volume 256");
    if (request.startAtSeconds > 0) {
      this.#send(`seek ${request.startAtSeconds}`);
    }
    if (request.startPaused) {
      this.#send("pause");
    }
    this.#snapshot.status = request.startPaused ? "paused" : "playing";
    this.#publish();
    return this.getSnapshot();
  }

  async pause(playbackId: string): Promise<VlcMusicSnapshot> {
    this.#requirePlayback(playbackId);
    this.#capturePosition(false);
    this.#send("pause");
    this.#snapshot.status = "paused";
    this.#publish();
    return this.getSnapshot();
  }

  async resume(playbackId: string): Promise<VlcMusicSnapshot> {
    this.#requirePlayback(playbackId);
    this.#send("play");
    this.#positionStartedAtMs = Date.now();
    this.#snapshot.status = "playing";
    this.#publish();
    return this.getSnapshot();
  }

  async stop(playbackId: string | null): Promise<VlcMusicSnapshot> {
    if (playbackId && this.#snapshot.playbackId !== playbackId) {
      throw new Error("Playback ID does not match the active VLC track");
    }
    const child = this.#child;
    if (!child) {
      this.#snapshot.status = this.#snapshot.playbackId ? "stopped" : "idle";
      await this.#releaseMedia();
      this.#publish();
      return this.getSnapshot();
    }

    this.#expectedStop = true;
    this.#capturePosition(false);
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
    await this.#releaseMedia();
    this.#publish();
    return this.getSnapshot();
  }

  async seek(playbackId: string, positionSeconds: number): Promise<VlcMusicSnapshot> {
    this.#requirePlayback(playbackId);
    this.#send(`seek ${positionSeconds}`);
    this.#positionBaseSeconds = positionSeconds;
    this.#positionStartedAtMs = this.#snapshot.status === "playing" ? Date.now() : null;
    this.#snapshot.positionSeconds = positionSeconds;
    this.#publish();
    return this.getSnapshot();
  }

  async setAudioRouteVolume(input: {
    audioRouteId: LocalAgentAudioRouteId;
    revision: number;
    volumePercent: number;
  }): Promise<LocalAgentAudioRouteStatus> {
    const route = await this.#audioRoutes.setVolume(input);
    this.#replaceRoute(route);
    this.#publish();
    return route;
  }

  async setAudioRouteMute(input: {
    audioRouteId: LocalAgentAudioRouteId;
    muted: boolean;
    revision: number;
  }): Promise<LocalAgentAudioRouteStatus> {
    const route = await this.#audioRoutes.setMute(input);
    this.#replaceRoute(route);
    this.#publish();
    return route;
  }

  getSnapshot(): VlcMusicSnapshot {
    const snapshot = structuredClone(this.#snapshot);
    snapshot.positionSeconds = this.#currentPositionSeconds();
    return snapshot;
  }

  subscribe(listener: (snapshot: VlcMusicSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async shutdown(): Promise<void> {
    await this.stop(null);
    await this.#releaseMedia();
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

  #publish(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }

  #capturePosition(keepRunning: boolean): void {
    this.#positionBaseSeconds = this.#currentPositionSeconds() ?? this.#positionBaseSeconds;
    this.#snapshot.positionSeconds = this.#positionBaseSeconds;
    this.#positionStartedAtMs = keepRunning ? Date.now() : null;
  }

  #currentPositionSeconds(): number | null {
    if (this.#snapshot.playbackId === null) {
      return null;
    }
    if (this.#positionStartedAtMs === null) {
      return this.#positionBaseSeconds;
    }
    return this.#positionBaseSeconds + Math.max(0, (Date.now() - this.#positionStartedAtMs) / 1_000);
  }

  async #releaseMedia(): Promise<void> {
    const media = this.#resolvedMedia;
    this.#resolvedMedia = null;
    await media?.release().catch(() => undefined);
  }

  async #inspectAudioRoutes(): Promise<readonly LocalAgentAudioRouteStatus[]> {
    return await this.#audioRoutes.inspect();
  }

  #replaceRoute(route: LocalAgentAudioRouteStatus): void {
    this.#snapshot.routes = this.#snapshot.routes.map((current) => current.id === route.id ? route : current);
  }
}
