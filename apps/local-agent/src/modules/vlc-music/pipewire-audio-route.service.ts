import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  getLocalAgentAudioRouteDefinition,
  localAgentAudioRouteDefinitions,
  type LocalAgentAudioRouteId,
  type LocalAgentAudioRouteStatus
} from "@maiks-yt/events";

const execFileAsync = promisify(execFile);

export type PactlRunner = (args: readonly string[]) => Promise<{ stdout: string }>;

const runInstalledPactl: PactlRunner = async (args) => {
  const { stdout } = await execFileAsync("pactl", [...args], {
    timeout: 2_000,
    maxBuffer: 256 * 1_024
  });
  return { stdout };
};

const readVolumePercent = (stdout: string): number => {
  const match = stdout.match(/\b(\d+(?:\.\d+)?)%/u);
  if (!match) {
    throw new Error("PipeWire sink volume response was not recognized");
  }
  return Math.max(0, Math.min(100, Math.round(Number(match[1]))));
};

const readMuted = (stdout: string): boolean => {
  const match = stdout.match(/\bMute:\s*(yes|no)\b/iu);
  if (!match) {
    throw new Error("PipeWire sink mute response was not recognized");
  }
  return match[1]?.toLowerCase() === "yes";
};

export class PipeWireAudioRouteService {
  readonly #runPactl: PactlRunner;
  readonly #revisions = new Map<LocalAgentAudioRouteId, number>();

  constructor(options: { runPactl?: PactlRunner } = {}) {
    this.#runPactl = options.runPactl ?? runInstalledPactl;
  }

  async inspect(): Promise<readonly LocalAgentAudioRouteStatus[]> {
    let sinkNames: ReadonlySet<string>;
    try {
      const { stdout } = await this.#runPactl(["list", "short", "sinks"]);
      sinkNames = new Set(stdout
        .split("\n")
        .map((line) => line.trim().split(/\s+/u)[1])
        .filter((value): value is string => Boolean(value)));
    } catch (error) {
      return localAgentAudioRouteDefinitions.map((route) => this.#errorStatus(
        route.id,
        error instanceof Error ? error.message : "Unable to list PipeWire sinks"
      ));
    }

    return await Promise.all(localAgentAudioRouteDefinitions.map(async (route) => {
      if (!sinkNames.has(route.pipeWireSink)) {
        return {
          ...route,
          controlState: "unavailable" as const,
          detail: `PipeWire sink ${route.pipeWireSink} is unavailable`,
          muted: null,
          revision: this.#revisions.get(route.id) ?? 0,
          state: "unavailable" as const,
          volumePercent: null
        };
      }
      try {
        return await this.#readRoute(route.id, this.#revisions.get(route.id) ?? 0);
      } catch (error) {
        return this.#errorStatus(
          route.id,
          error instanceof Error ? error.message : "Unable to read PipeWire route state"
        );
      }
    }));
  }

  async setVolume(input: {
    audioRouteId: LocalAgentAudioRouteId;
    revision: number;
    volumePercent: number;
  }): Promise<LocalAgentAudioRouteStatus> {
    this.#assertRevision(input.audioRouteId, input.revision);
    await this.#runPactl([
      "set-sink-volume",
      getLocalAgentAudioRouteDefinition(input.audioRouteId).pipeWireSink,
      `${Math.round(input.volumePercent)}%`
    ]);
    const status = await this.#readRoute(input.audioRouteId, input.revision);
    this.#revisions.set(input.audioRouteId, input.revision);
    return status;
  }

  async setMute(input: {
    audioRouteId: LocalAgentAudioRouteId;
    muted: boolean;
    revision: number;
  }): Promise<LocalAgentAudioRouteStatus> {
    this.#assertRevision(input.audioRouteId, input.revision);
    await this.#runPactl([
      "set-sink-mute",
      getLocalAgentAudioRouteDefinition(input.audioRouteId).pipeWireSink,
      input.muted ? "1" : "0"
    ]);
    const status = await this.#readRoute(input.audioRouteId, input.revision);
    this.#revisions.set(input.audioRouteId, input.revision);
    return status;
  }

  #assertRevision(audioRouteId: LocalAgentAudioRouteId, revision: number): void {
    const current = this.#revisions.get(audioRouteId) ?? 0;
    if (!Number.isSafeInteger(revision) || revision <= current) {
      throw new Error(`stale route revision ${revision}; current revision is ${current}`);
    }
  }

  async #readRoute(audioRouteId: LocalAgentAudioRouteId, revision: number): Promise<LocalAgentAudioRouteStatus> {
    const route = getLocalAgentAudioRouteDefinition(audioRouteId);
    const [volume, mute] = await Promise.all([
      this.#runPactl(["get-sink-volume", route.pipeWireSink]),
      this.#runPactl(["get-sink-mute", route.pipeWireSink])
    ]);
    return {
      ...route,
      controlState: "acknowledged",
      muted: readMuted(mute.stdout),
      revision,
      state: "available",
      volumePercent: readVolumePercent(volume.stdout)
    };
  }

  #errorStatus(audioRouteId: LocalAgentAudioRouteId, detail: string): LocalAgentAudioRouteStatus {
    return {
      ...getLocalAgentAudioRouteDefinition(audioRouteId),
      controlState: "error",
      detail,
      lastError: detail,
      muted: null,
      revision: this.#revisions.get(audioRouteId) ?? 0,
      state: "error",
      volumePercent: null
    };
  }
}
