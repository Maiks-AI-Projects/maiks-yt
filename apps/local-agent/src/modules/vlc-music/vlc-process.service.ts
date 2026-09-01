import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
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
const defaultReadinessPollMs = 100;
const defaultReadinessTimeoutMs = 5_000;
const maximumDiagnosticLength = 512;
const execFileAsync = promisify(execFile);

type VlcProcessBackendOptions = {
  readinessPollMs?: number;
  readinessTimeoutMs?: number;
  runPactl?: (args: readonly string[]) => Promise<{ stdout: string }>;
};

type VlcProcessTerminal = {
  code: number | null;
  error: string | null;
  signal: NodeJS.Signals | null;
};

type PipeWireVlcAttachment = {
  observedSink: string | null;
  ready: boolean;
};

const sanitizeDiagnostic = (value: string): string => value
  .replace(/https?:\/\/\S+/giu, "[redacted-url]")
  .replace(/\bBearer\s+\S+/giu, "Bearer [redacted]")
  .replace(/\b(accessToken|token|authorization)=\S+/giu, "$1=[redacted]")
  .replace(/[\u0000-\u001f\u007f]+/gu, " ")
  .replace(/\s+/gu, " ")
  .trim()
  .slice(0, maximumDiagnosticLength);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const parsePactlArray = (stdout: string, label: string): readonly Record<string, unknown>[] => {
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error(`PipeWire ${label} response was not an array`);
  }
  return parsed.map(asRecord).filter((value): value is Record<string, unknown> => value !== null);
};

const inspectVlcAttachment = async (
  runPactl: (args: readonly string[]) => Promise<{ stdout: string }>,
  expectedSink: string,
  expectedMediaRole: string
): Promise<PipeWireVlcAttachment> => {
  const [sinksResult, inputsResult] = await Promise.all([
    runPactl(["--format=json", "list", "sinks"]),
    runPactl(["--format=json", "list", "sink-inputs"])
  ]);
  const sinkNames = new Map<string, string>();
  for (const sink of parsePactlArray(sinksResult.stdout, "sink")) {
    if ((typeof sink.index === "number" || typeof sink.index === "string") && typeof sink.name === "string") {
      sinkNames.set(String(sink.index), sink.name);
    }
  }

  let observedSink: string | null = null;
  for (const input of parsePactlArray(inputsResult.stdout, "sink-input")) {
    const properties = asRecord(input.properties);
    if (!properties
      || properties["application.id"] !== "org.VideoLAN.VLC"
      || properties["application.name"] !== "maiks-audio-agent"
      || properties["media.role"] !== expectedMediaRole) {
      continue;
    }
    const sink = typeof input.sink === "number" || typeof input.sink === "string"
      ? sinkNames.get(String(input.sink)) ?? null
      : null;
    if (sink === expectedSink) {
      return { observedSink: sink, ready: true };
    }
    observedSink = sink;
  }
  return { observedSink, ready: false };
};
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
  readonly #readinessPollMs: number;
  readonly #readinessTimeoutMs: number;
  readonly #runPactl: (args: readonly string[]) => Promise<{ stdout: string }>;
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
    audioRoutes: PipeWireAudioRouteService = new PipeWireAudioRouteService(),
    options: VlcProcessBackendOptions = {}
  ) {
    this.#mediaSourceResolver = mediaSourceResolver;
    this.#audioRoutes = audioRoutes;
    this.#readinessPollMs = options.readinessPollMs ?? defaultReadinessPollMs;
    this.#readinessTimeoutMs = options.readinessTimeoutMs ?? defaultReadinessTimeoutMs;
    this.#runPactl = options.runPactl ?? (async (args) => {
      const { stdout } = await execFileAsync("pactl", [...args], {
        maxBuffer: 256 * 1_024,
        timeout: 2_000
      });
      return { stdout };
    });
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
      "--play-and-exit"
    ], {
      env: {
        ...process.env,
        ...buildVlcAudioRouteEnvironment(request.audioRouteId)
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.#child = child;
    let terminal: VlcProcessTerminal | null = null;
    let settleTerminal: ((value: VlcProcessTerminal) => void) | null = null;
    let stderr = "";
    const readTerminal = (): VlcProcessTerminal | null => terminal;
    const terminalPromise = new Promise<VlcProcessTerminal>((resolve) => {
      settleTerminal = resolve;
    });
    child.stdout.resume();
    child.stderr.on("data", (chunk: Buffer | string) => {
      const remaining = maximumDiagnosticLength * 2 - stderr.length;
      if (remaining > 0) {
        stderr += String(chunk).slice(0, remaining);
      }
    });
    child.once("error", (error) => {
      terminal = {
        code: null,
        error: sanitizeDiagnostic(error.message) || "VLC process error",
        signal: null
      };
      settleTerminal?.(terminal);
      if (this.#child === child) {
        this.#capturePosition(false);
        this.#child = null;
        this.#snapshot.status = "error";
        void this.#releaseMedia();
        this.#publish();
      }
    });
    child.once("exit", (code, exitSignal) => {
      terminal = { code, error: null, signal: exitSignal };
      settleTerminal?.(terminal);
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
    const expectedRoute = getLocalAgentAudioRouteDefinition(request.audioRouteId);
    console.info("VLC play readiness", {
      expectedSink: expectedRoute.pipeWireSink,
      pid: child.pid ?? null,
      playbackId: request.playbackId,
      route: request.audioRouteId,
      state: "pending"
    });
    try {
      this.#send(`add ${JSON.stringify(resolvedMedia.input)}`);
      this.#send("volume 256");
      if (request.startAtSeconds > 0) {
        this.#send(`seek ${request.startAtSeconds}`);
      }
      await this.#waitForReadiness({
        child,
        expectedMediaRole: expectedRoute.mediaRole,
        expectedSink: expectedRoute.pipeWireSink,
        getStderr: () => stderr,
        getTerminal: readTerminal,
        signal,
        terminalPromise
      });
      if (request.startPaused) {
        this.#send("pause");
      }
      this.#snapshot.status = request.startPaused ? "paused" : "playing";
      this.#snapshot.detail = `VLC audio ready on ${expectedRoute.pipeWireSink}`;
      console.info("VLC play readiness", {
        expectedSink: expectedRoute.pipeWireSink,
        pid: child.pid ?? null,
        playbackId: request.playbackId,
        route: request.audioRouteId,
        state: "succeeded"
      });
      this.#publish();
      return this.getSnapshot();
    } catch (error) {
      const detail = sanitizeDiagnostic(error instanceof Error ? error.message : "VLC audio readiness failed")
        || "VLC audio readiness failed";
      const failureTerminal = readTerminal();
      console.warn("VLC play readiness", {
        detail,
        expectedSink: expectedRoute.pipeWireSink,
        exitCode: failureTerminal?.code ?? child.exitCode,
        exitSignal: failureTerminal?.signal ?? child.signalCode,
        pid: child.pid ?? null,
        playbackId: request.playbackId,
        route: request.audioRouteId,
        state: "failed"
      });
      await this.#cleanupFailedPlay(child, detail);
      throw new Error(detail);
    }
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

  async #waitForReadiness(input: {
    child: ChildProcessWithoutNullStreams;
    expectedMediaRole: string;
    expectedSink: string;
    getStderr: () => string;
    getTerminal: () => VlcProcessTerminal | null;
    signal: AbortSignal;
    terminalPromise: Promise<VlcProcessTerminal>;
  }): Promise<void> {
    const deadline = Date.now() + this.#readinessTimeoutMs;
    let observedSink: string | null = null;
    let probeError: string | null = null;
    while (Date.now() <= deadline) {
      if (input.signal.aborted) {
        throw input.signal.reason ?? new Error("VLC playback was aborted during audio readiness");
      }
      const terminal = input.getTerminal();
      if (terminal || input.child.exitCode !== null || input.child.signalCode !== null) {
        throw new Error(this.#terminalReadinessDetail(terminal, input.getStderr()));
      }
      try {
        const attachment = await inspectVlcAttachment(
          this.#runPactl,
          input.expectedSink,
          input.expectedMediaRole
        );
        observedSink = attachment.observedSink;
        probeError = null;
        if (attachment.ready && input.child.exitCode === null && !input.getTerminal()) {
          return;
        }
      } catch (error) {
        probeError = sanitizeDiagnostic(error instanceof Error ? error.message : "PipeWire readiness probe failed");
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }
      await Promise.race([
        input.terminalPromise,
        waitForDelay(Math.min(this.#readinessPollMs, remainingMs), input.signal)
      ]);
    }
    const diagnostic = observedSink
      ? `matching VLC sink-input was attached to ${observedSink}`
      : probeError
        ? `last PipeWire probe failed: ${probeError}`
        : "matching VLC sink-input was not present";
    throw new Error(`VLC audio readiness timed out for ${input.expectedSink}; ${diagnostic}`);
  }

  #terminalReadinessDetail(terminal: VlcProcessTerminal | null, stderr: string): string {
    const boundedStderr = sanitizeDiagnostic(stderr);
    const cause = terminal?.error
      ? terminal.error
      : terminal?.signal
        ? `signal ${terminal.signal}`
        : `code ${terminal?.code ?? "unknown"}`;
    return `VLC exited before audio readiness (${cause})${boundedStderr ? `: ${boundedStderr}` : ""}`;
  }

  async #cleanupFailedPlay(child: ChildProcessWithoutNullStreams, detail: string): Promise<void> {
    this.#expectedStop = true;
    if (this.#child === child && child.exitCode === null && child.signalCode === null) {
      if (child.stdin.writable) {
        child.stdin.write("stop\n");
        child.stdin.write("quit\n");
      }
      await Promise.race([
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
        new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) {
              child.kill("SIGTERM");
            }
            resolve();
          }, stopTimeoutMs);
          timeout.unref();
        })
      ]);
    }
    if (this.#child === child) {
      this.#child = null;
    }
    this.#capturePosition(false);
    this.#snapshot.status = "error";
    this.#snapshot.detail = detail;
    await this.#releaseMedia();
    this.#publish();
  }

  #replaceRoute(route: LocalAgentAudioRouteStatus): void {
    this.#snapshot.routes = this.#snapshot.routes.map((current) => current.id === route.id ? route : current);
  }
}

function waitForDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || delayMs <= 0) {
      resolve();
      return;
    }
    const timeout = setTimeout(finish, delayMs);
    const abort = (): void => finish();
    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      resolve();
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}
