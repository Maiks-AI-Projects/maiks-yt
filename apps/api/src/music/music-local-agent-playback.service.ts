import type {
  CommandAcknowledgement,
  CommandEnvelope,
  JsonValue,
  LocalAgentAudioRouteStatus
} from "@maiks-yt/events";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  LOCAL_AGENT_VLC_MUSIC_CAPABILITY,
  localAgentAudioRouteDefinitions,
  localAgentAudioRouteIds
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
  MusicPlaybackControlFailure,
  MusicPlaybackService,
  MusicPlaybackSnapshot
} from "./music-playback.service.js";
import type { MusicSelectableTrack } from "./music.types.js";

const capabilityId = LOCAL_AGENT_VLC_MUSIC_CAPABILITY;
const playerClientId = "local-agent-vlc";
const commandTtlMs = 15_000;
const routeStateSchema = z.object({
  id: z.enum(localAgentAudioRouteIds),
  state: z.enum(["available", "unavailable", "error", "reconnecting"]),
  detail: z.string().trim().min(1).max(240).optional()
}).passthrough();
const vlcStateSchema = z.object({
  activeAudioRouteId: z.enum(localAgentAudioRouteIds).optional().default(DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID),
  available: z.boolean(),
  playbackId: z.string().nullable(),
  positionSeconds: z.number().min(0).nullable(),
  routes: z.array(routeStateSchema).optional().default([]),
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
  | "control"
  | "getCurrentAudioTrack"
  | "getInternalState"
  | "getPlayerState"
  | "recordPlayerEvent"
  | "releasePlayerLease"
>;

type OwnerControlInput = {
  action: MusicPlaybackControlAction;
  audioRouteId?: MusicPlaybackSnapshot["audioRouteId"] | undefined;
  authUserId: string;
  trackId?: string | undefined;
};

type PendingSupersedingControl = OwnerControlInput & {
  oldPlaybackId: string;
};

type PendingRouteSwitch = OwnerControlInput & {
  playbackId: string;
};

const toOwnerControlInput = (input: OwnerControlInput): OwnerControlInput => ({
  action: input.action,
  audioRouteId: input.audioRouteId,
  authUserId: input.authUserId,
  trackId: input.trackId
});

export class MusicLocalAgentPlaybackCoordinator {
  readonly #playback: PlaybackPort;
  readonly #runtime: MusicLocalAgentRuntime;
  readonly #publicApiBaseUrl: string;
  readonly #reportError: (error: unknown) => void;
  readonly #pendingByEventId = new Map<string, string>();
  readonly #pendingSupersedingControls = new Map<string, PendingSupersedingControl>();
  readonly #pendingRouteSwitches = new Map<string, PendingRouteSwitch>();
  readonly #acknowledgedRouteSwitches = new Map<string, MusicPlaybackSnapshot["audioRouteId"]>();
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

  async handleOwnerControl(input: OwnerControlInput): Promise<{
    handled: false;
  } | {
    handled: true;
    result: MusicPlaybackSnapshot | MusicPlaybackControlFailure;
  }> {
    const before = this.#playback.getInternalState();
    const actual = this.#readVlcState(this.#runtime.getStatus());

    if (!this.#hasPlaybackCapability(this.#runtime.getStatus()) || !before.playbackId) {
      return { handled: false };
    }

    const oldPlaybackIsActive = actual?.playbackId === before.playbackId
      && !["idle", "stopped", "ended", "error"].includes(actual.status);
    if (!oldPlaybackIsActive) {
      return { handled: false };
    }

    if (input.action === "route.select") {
      if (!input.audioRouteId || input.audioRouteId === before.audioRouteId) {
        return { handled: false };
      }

      const playCommand = this.#issuePlay({
        ...before,
        audioRouteId: input.audioRouteId
      }, Math.max(0, actual.positionSeconds ?? 0));
      if (!playCommand) {
        return {
          handled: true,
          result: {
            ...this.projectControlState(before),
            reason: "music_play_control_unavailable"
          }
        };
      }
      this.#pendingRouteSwitches.set(playCommand.eventId, {
        ...input,
        playbackId: before.playbackId
      });

      return {
        handled: true,
        result: {
          ...this.projectControlState(before),
          reason: "music_local_agent_transition_pending"
        }
      };
    }

    if (input.action !== "next" && input.action !== "skip" && input.action !== "select") {
      return { handled: false };
    }

    const stopCommand = this.#issue("track.stop", { playbackId: before.playbackId });
    if (!stopCommand) {
      return {
        handled: true,
        result: {
          ...this.projectControlState(before),
          reason: "music_play_control_unavailable"
        }
      };
    }
    this.#pendingSupersedingControls.set(stopCommand.eventId, {
      ...input,
      oldPlaybackId: before.playbackId
    });

    return {
      handled: true,
      result: {
        ...this.projectControlState(before),
        reason: "music_local_agent_transition_pending"
      }
    };
  }

  projectControlState(snapshot: MusicPlaybackSnapshot): MusicPlaybackSnapshot {
    return {
      ...snapshot,
      audioRoutes: this.#projectAudioRoutes(this.#runtime.getStatus())
    };
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
      if (actual.activeAudioRouteId === desired.audioRouteId) {
        this.#acknowledgedRouteSwitches.delete(desired.playbackId);
      } else if (this.#acknowledgedRouteSwitches.get(desired.playbackId) !== desired.audioRouteId) {
        this.#issuePlay(desired, Math.max(0, actual.positionSeconds ?? 0));
        return;
      }

      if (desired.status === "paused" && actual.status !== "paused") {
        this.#issue("track.pause", { playbackId: desired.playbackId });
      } else if (desired.status === "playing" && actual.status === "paused") {
        this.#issue("track.resume", { playbackId: desired.playbackId });
      }
      return;
    }

    this.#issuePlay(desired, 0);
  }

  #issuePlay(desired: MusicPlaybackSnapshot, startAtSeconds: number): CommandEnvelope | null {
    if (!desired.playbackId || !desired.currentTrack) {
      return null;
    }

    const playerState = this.#playback.getPlayerState({
      clientId: playerClientId,
      createAudioUrl: (playbackId, track) => this.#createAudioUrl(playbackId, track)
    });
    if (!playerState.player.owned || !playerState.audioUrl) {
      return null;
    }
    return this.#issue("track.play", {
      playbackId: desired.playbackId,
      sourceUrl: playerState.audioUrl,
      audioRouteId: desired.audioRouteId,
      startPaused: desired.status === "paused",
      startAtSeconds,
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
    const routeSwitch = this.#pendingRouteSwitches.get(command.eventId);
    if (routeSwitch) {
      this.#pendingRouteSwitches.delete(command.eventId);
      if (acknowledgement.status === "succeeded") {
        this.#enqueue(async () => {
          if (routeSwitch.audioRouteId) {
            this.#acknowledgedRouteSwitches.set(routeSwitch.playbackId, routeSwitch.audioRouteId);
          }
          await this.#playback.control(toOwnerControlInput(routeSwitch));
        });
        return;
      }
      this.#enqueue(async () => {
        await this.#playback.recordPlayerEvent({
          clientId: playerClientId,
          event: "failed",
          playbackId: routeSwitch.playbackId,
          positionSeconds: null
        });
        this.#playback.releasePlayerLease(playerClientId);
      });
      return;
    }

    const supersedingControl = this.#pendingSupersedingControls.get(command.eventId);
    if (supersedingControl) {
      this.#pendingSupersedingControls.delete(command.eventId);
      if (acknowledgement.status === "succeeded") {
        this.#enqueue(async () => {
          const result = await this.#playback.control(toOwnerControlInput(supersedingControl));
          if (result.ok) {
            await this.#reconcile(result);
          }
        });
      }
      return;
    }

    if (acknowledgement.status !== "succeeded" && command.action === "track.play") {
      const payload = command.payload;
      const playbackId = typeof payload === "object"
        && payload !== null
        && !Array.isArray(payload)
        && typeof (payload as { playbackId?: unknown }).playbackId === "string"
        ? (payload as { playbackId: string }).playbackId
        : null;
      if (playbackId) {
        this.#enqueue(async () => {
          await this.#playback.recordPlayerEvent({
            clientId: playerClientId,
            event: "failed",
            playbackId,
            positionSeconds: null
          });
          this.#playback.releasePlayerLease(playerClientId);
        });
      } else {
        this.#playback.releasePlayerLease(playerClientId);
      }
    }
  }

  #issue(action: string, payload: JsonValue): CommandEnvelope | null {
    const signature = `${action}:${JSON.stringify(payload)}`;
    if ([...this.#pendingByEventId.values()].includes(signature)) {
      return null;
    }
    const result = this.#runtime.issueCommand({
      action,
      capability: capabilityId,
      expiresAt: new Date(Date.now() + commandTtlMs).toISOString(),
      payload
    });
    if (result.ok) {
      this.#pendingByEventId.set(result.command.eventId, signature);
      return result.command;
    }
    return null;
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

  #projectAudioRoutes(status: LocalAgentRuntimeStatus): readonly LocalAgentAudioRouteStatus[] {
    if (!status.connected) {
      return localAgentAudioRouteDefinitions.map((route) => ({
        ...route,
        state: "reconnecting" as const,
        detail: "Local Agent is not connected"
      }));
    }

    const actual = this.#readVlcState(status);

    return localAgentAudioRouteDefinitions.map((route) => {
      const reported = actual?.routes.find((candidate) => candidate.id === route.id);
      if (reported) {
        return {
          ...route,
          state: reported.state,
          ...(reported.detail ? { detail: reported.detail } : {})
        };
      }

      return {
        ...route,
        state: "unavailable" as const,
        detail: "Route was not reported by the Local Agent"
      };
    });
  }

  #enqueue(operation: () => Promise<void>): void {
    if (this.#disposed) {
      return;
    }
    this.#queue = this.#queue.then(operation).catch((error: unknown) => this.#reportError(error));
  }
}
