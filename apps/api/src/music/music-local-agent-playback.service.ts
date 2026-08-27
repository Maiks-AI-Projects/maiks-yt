import type {
  CommandAcknowledgement,
  CommandEnvelope,
  JsonValue
} from "@maiks-yt/events";
import { z } from "zod";

import type {
  LocalAgentAcknowledgementListener,
  LocalAgentRuntimeStatus,
  LocalAgentStatusListener
} from "../local-agent/local-agent-runtime.service.js";
import { safeHttpUrlOrNull } from "./music-service-catalog.service.js";
import type {
  MusicPlaybackControlAction,
  MusicPlaybackService,
  MusicPlaybackSnapshot
} from "./music-playback.service.js";
import type { MusicSelectableTrack } from "./music.types.js";

const capabilityId = "vlc-music";
const playerClientId = "local-agent-vlc";
const commandTtlMs = 15_000;
const vlcStateSchema = z.object({
  available: z.boolean(),
  playbackId: z.string().nullable(),
  positionSeconds: z.number().min(0).nullable(),
  status: z.enum(["idle", "loading", "playing", "paused", "stopped", "ended", "error"]),
  volumePercent: z.number().min(0).max(100)
}).passthrough();

type VlcState = z.infer<typeof vlcStateSchema>;

export interface MusicLocalAgentRuntime {
  getStatus(): LocalAgentRuntimeStatus;
  issueCommand(input: {
    action: string;
    capability: string;
    expiresAt?: string;
    payload: JsonValue;
  }): { ok: true; command: CommandEnvelope } | {
    ok: false;
    reason: "local_agent_not_connected" | "local_agent_capability_unavailable";
  };
  subscribeToStatus(listener: LocalAgentStatusListener): () => void;
  subscribeToAcknowledgements(listener: LocalAgentAcknowledgementListener): () => void;
}

type PlaybackPort = Pick<MusicPlaybackService,
  | "getCurrentAudioTrack"
  | "getInternalState"
  | "getPlayerState"
  | "recordPlayerEvent"
  | "releasePlayerLease"
>;

export class MusicLocalAgentPlaybackCoordinator {
  readonly #playback: PlaybackPort;
  readonly #runtime: MusicLocalAgentRuntime;
  readonly #publicApiBaseUrl: string;
  readonly #reportError: (error: unknown) => void;
  readonly #pendingByEventId = new Map<string, string>();
  readonly #processedTerminalStates = new Set<string>();
  readonly #removeListeners: readonly (() => void)[];
  #queue: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(input: {
    playback: PlaybackPort;
    publicApiBaseUrl: string;
    reportError?: (error: unknown) => void;
    runtime: MusicLocalAgentRuntime;
  }) {
    this.#playback = input.playback;
    this.#runtime = input.runtime;
    this.#publicApiBaseUrl = new URL(input.publicApiBaseUrl).origin;
    this.#reportError = input.reportError ?? ((error) => console.error("Local-agent music coordination failed", error));
    this.#removeListeners = [
      this.#runtime.subscribeToStatus((status) => this.#enqueue(() => this.#handleStatus(status))),
      this.#runtime.subscribeToAcknowledgements((acknowledgement, command) => {
        this.#handleAcknowledgement(acknowledgement, command);
      })
    ];
  }

  handleControl(input: {
    action: MusicPlaybackControlAction;
    before: MusicPlaybackSnapshot;
    after: MusicPlaybackSnapshot;
  }): void {
    this.#processedTerminalStates.clear();
    this.#enqueue(async () => {
      if (input.action === "skip" && input.before.playbackId) {
        this.#issue("track.stop", { playbackId: input.before.playbackId });
      }
      await this.#reconcile(input.after);
    });
  }

  dispose(): void {
    this.#disposed = true;
    for (const removeListener of this.#removeListeners) {
      removeListener();
    }
    this.#playback.releasePlayerLease(playerClientId);
  }

  async #handleStatus(status: LocalAgentRuntimeStatus): Promise<void> {
    if (!this.#hasPlaybackCapability(status)) {
      this.#playback.releasePlayerLease(playerClientId);
      return;
    }

    const actual = this.#readVlcState(status);
    const desired = this.#playback.getInternalState();
    if (actual && actual.playbackId === desired.playbackId && desired.playbackId) {
      if (actual.status === "playing" && desired.status === "loading") {
        const started = await this.#playback.recordPlayerEvent({
          clientId: playerClientId,
          event: "started",
          playbackId: desired.playbackId,
          positionSeconds: actual.positionSeconds
        });
        if (started.ok) {
          await this.#reconcile(started);
        }
        return;
      }
      if (actual.status === "ended" || actual.status === "error") {
        const terminalKey = `${actual.playbackId}:${actual.status}`;
        if (this.#processedTerminalStates.has(terminalKey)) {
          return;
        }
        this.#processedTerminalStates.add(terminalKey);
        const finished = await this.#playback.recordPlayerEvent({
          clientId: playerClientId,
          event: actual.status === "ended" ? "ended" : "failed",
          playbackId: desired.playbackId,
          positionSeconds: actual.positionSeconds
        });
        if (finished.ok) {
          await this.#reconcile(finished);
        }
        return;
      }
    }

    await this.#reconcile(desired, actual);
  }

  async #reconcile(desired: MusicPlaybackSnapshot, actual = this.#readVlcState(this.#runtime.getStatus())): Promise<void> {
    if (!this.#hasPlaybackCapability(this.#runtime.getStatus())) {
      this.#playback.releasePlayerLease(playerClientId);
      return;
    }
    if (!desired.playbackId || !desired.currentTrack) {
      if (actual?.playbackId && actual.status !== "idle" && actual.status !== "stopped") {
        this.#issue("track.stop", { playbackId: actual.playbackId });
      }
      return;
    }

    if (actual?.playbackId === desired.playbackId) {
      if (desired.status === "paused" && actual.status !== "paused") {
        this.#issue("track.pause", { playbackId: desired.playbackId });
      } else if (desired.status === "playing" && actual.status === "paused") {
        this.#issue("track.resume", { playbackId: desired.playbackId });
      }
      return;
    }

    const playerState = this.#playback.getPlayerState({
      clientId: playerClientId,
      createAudioUrl: (playbackId, track) => this.#createAudioUrl(playbackId, track)
    });
    if (!playerState.player.owned || !playerState.audioUrl) {
      return;
    }
    this.#issue("track.play", {
      playbackId: desired.playbackId,
      sourceUrl: playerState.audioUrl,
      startPaused: desired.status === "paused",
      startAtSeconds: 0,
      volumePercent: 70
    });
  }

  #createAudioUrl(playbackId: string, track: MusicSelectableTrack): string | null {
    if (track.sourceType !== "local_audio") {
      return safeHttpUrlOrNull(track.sourceUrl);
    }
    return new URL(
      `/music/playback/audio/${encodeURIComponent(playbackId)}`,
      this.#publicApiBaseUrl
    ).toString();
  }

  #handleAcknowledgement(acknowledgement: CommandAcknowledgement, command: CommandEnvelope): void {
    if (command.capability !== capabilityId || acknowledgement.status === "received") {
      return;
    }
    this.#pendingByEventId.delete(command.eventId);
    if (acknowledgement.status !== "succeeded" && command.action === "track.play") {
      this.#playback.releasePlayerLease(playerClientId);
    }
  }

  #issue(action: string, payload: JsonValue): void {
    const signature = `${action}:${JSON.stringify(payload)}`;
    if ([...this.#pendingByEventId.values()].includes(signature)) {
      return;
    }
    const result = this.#runtime.issueCommand({
      action,
      capability: capabilityId,
      expiresAt: new Date(Date.now() + commandTtlMs).toISOString(),
      payload
    });
    if (result.ok) {
      this.#pendingByEventId.set(result.command.eventId, signature);
    }
  }

  #hasPlaybackCapability(status: LocalAgentRuntimeStatus): boolean {
    return status.connected && status.capabilities.some((capability) =>
      capability.id === capabilityId
      && capability.availability !== "unavailable"
      && capability.actions.includes("track.play")
    );
  }

  #readVlcState(status: LocalAgentRuntimeStatus): VlcState | null {
    const moduleStatus = status.status?.modules.find((module) => module.capabilityId === capabilityId);
    const parsed = vlcStateSchema.safeParse(moduleStatus?.state);
    return parsed.success ? parsed.data : null;
  }

  #enqueue(operation: () => Promise<void>): void {
    if (this.#disposed) {
      return;
    }
    this.#queue = this.#queue.then(operation).catch((error: unknown) => this.#reportError(error));
  }
}
