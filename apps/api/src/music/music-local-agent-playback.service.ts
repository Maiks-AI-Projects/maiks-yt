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
  MusicPlaybackCommandOutcome,
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
  controlState: z.enum(["acknowledged", "pending", "error", "unavailable", "reconnecting"]).optional(),
  lastError: z.string().trim().min(1).max(240).optional(),
  muted: z.boolean().nullable().optional().default(null),
  revision: z.number().int().min(0).optional().default(0),
  state: z.enum(["available", "unavailable", "error", "reconnecting"]),
  detail: z.string().trim().min(1).max(240).optional(),
  volumePercent: z.number().min(0).max(100).nullable().optional().default(null)
}).passthrough();
const vlcStateSchema = z.object({
  activeAudioRouteId: z.enum(localAgentAudioRouteIds).optional().default(DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID),
  available: z.boolean(),
  playbackId: z.string().nullable(),
  positionSeconds: z.number().min(0).nullable(),
  routes: z.array(routeStateSchema).optional().default([]),
  status: z.enum(["idle", "loading", "playing", "paused", "stopped", "ended", "error"])
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
  | "getControlState"
  | "recordPlayerEvent"
  | "failAuthoritativePlayer"
  | "releasePlayerLease"
  | "setAuthoritativePlayer"
>;

type OwnerControlInput = {
  action: MusicPlaybackControlAction;
  audioRouteId?: MusicPlaybackSnapshot["audioRouteId"] | undefined;
  authUserId: string;
  muted?: boolean | undefined;
  trackId?: string | undefined;
  volumePercent?: number | undefined;
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
  trackId: input.trackId,
  muted: input.muted,
  volumePercent: input.volumePercent
});

type PendingAudioRouteControl = {
  audioRouteId: MusicPlaybackSnapshot["audioRouteId"];
  eventId: string;
  muted?: boolean | undefined;
  revision: number;
  volumePercent?: number | undefined;
};

export class MusicLocalAgentPlaybackCoordinator {
  readonly #playback: PlaybackPort;
  readonly #runtime: MusicLocalAgentRuntime;
  readonly #publicApiBaseUrl: string;
  readonly #reportError: (error: unknown) => void;
  readonly #pendingByEventId = new Map<string, string>();
  readonly #pendingSupersedingControls = new Map<string, PendingSupersedingControl>();
  readonly #pendingRouteSwitches = new Map<string, PendingRouteSwitch>();
  readonly #acknowledgedRouteSwitches = new Map<string, MusicPlaybackSnapshot["audioRouteId"]>();
  readonly #acknowledgedAudioRoutes = new Map<MusicPlaybackSnapshot["audioRouteId"], LocalAgentAudioRouteStatus>();
  readonly #audioRouteErrors = new Map<MusicPlaybackSnapshot["audioRouteId"], {
    detail: string;
    revision: number;
  }>();
  readonly #pendingAudioRouteControls = new Map<string, PendingAudioRouteControl>();
  readonly #routeRevisionFloors = new Map<MusicPlaybackSnapshot["audioRouteId"], number>();
  readonly #lastProjectedRouteRevisions = new Map<MusicPlaybackSnapshot["audioRouteId"], number>();
  readonly #processedTerminalStates = new Set<string>();
  readonly #removeListeners: readonly (() => void)[];
  #failedConnectionAt: string | null = null;
  #hasObservedConnection = false;
  #lastPlayCommand: MusicPlaybackCommandOutcome | null = null;
  #observedConnectionAt: string | null = null;
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
    this.#refreshAuthoritativePlayer(this.#runtime.getStatus());
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

    if (input.action === "route.volume.set" || input.action === "route.mute.set") {
      const authorized = await this.#playback.getControlState(input.authUserId);
      if (!authorized.ok) {
        return { handled: true, result: authorized };
      }
      if (!input.audioRouteId || !this.#hasRouteControlCapability(this.#runtime.getStatus())) {
        return {
          handled: true,
          result: {
            ...this.projectControlState(authorized),
            reason: "music_local_agent_unavailable"
          }
        };
      }
      if ((input.action === "route.volume.set" && input.volumePercent === undefined)
        || (input.action === "route.mute.set" && input.muted === undefined)) {
        return {
          handled: true,
          result: {
            ...this.projectControlState(authorized),
            reason: "music_invalid_input"
          }
        };
      }
      const projected = this.projectControlState(authorized);
      const currentRoute = projected.audioRoutes.find((route) => route.id === input.audioRouteId);
      if (!currentRoute || currentRoute.state !== "available") {
        return {
          handled: true,
          result: {
            ...projected,
            reason: "music_audio_route_unavailable"
          }
        };
      }
      const revision = this.#nextAudioRouteRevision(input.audioRouteId, projected.audioRoutes);
      const payload = input.action === "route.volume.set"
        ? {
            audioRouteId: input.audioRouteId,
            revision,
            volumePercent: input.volumePercent!
          }
        : {
            audioRouteId: input.audioRouteId,
            muted: input.muted!,
            revision
          };
      const command = this.#issue(
        input.action === "route.volume.set" ? "audio-route.volume.set" : "audio-route.mute.set",
        payload
      );
      if (!command) {
        this.#audioRouteErrors.set(input.audioRouteId, {
          detail: "music_audio_route_command_unavailable",
          revision
        });
        return {
          handled: true,
          result: {
            ...this.projectControlState(authorized),
            reason: "music_audio_route_command_unavailable"
          }
        };
      }
      this.#audioRouteErrors.delete(input.audioRouteId);
      this.#pendingAudioRouteControls.set(command.eventId, {
        audioRouteId: input.audioRouteId,
        eventId: command.eventId,
        ...(input.muted === undefined ? {} : { muted: input.muted }),
        revision,
        ...(input.volumePercent === undefined ? {} : { volumePercent: input.volumePercent })
      });
      return {
        handled: true,
        result: this.projectControlState(authorized)
      };
    }

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
    const runtimeStatus = this.#runtime.getStatus();
    const actual = this.#readVlcState(runtimeStatus);
    const hasCapability = this.#hasPlaybackCapability(runtimeStatus)
      && this.#failedConnectionAt !== runtimeStatus.connectedAt;
    const commandFailed = this.#lastPlayCommand
      && ["failed", "rejected", "expired"].includes(this.#lastPlayCommand.status);
    const localPlaybackActive = Boolean(snapshot.playbackId
      && actual?.playbackId === snapshot.playbackId
      && !["idle", "stopped", "ended", "error"].includes(actual.status));
    const player: MusicPlaybackSnapshot["player"] = hasCapability
      ? {
          ...snapshot.player,
          authority: "local-agent" as const,
          connected: true,
          kind: "local-agent" as const,
          lastCommand: this.#lastPlayCommand,
          state: !snapshot.playbackId ? "idle" : localPlaybackActive ? "active" : "pending"
        }
      : commandFailed
        ? {
            ...snapshot.player,
            authority: "browser-fallback" as const,
            kind: snapshot.player.kind === "browser-fallback" ? "browser-fallback" : null,
            lastCommand: this.#lastPlayCommand,
            state: snapshot.player.state === "fallback" ? "fallback" as const : "error" as const
          }
        : {
            ...snapshot.player,
            authority: snapshot.player.authority === "browser-fallback" ? "browser-fallback" as const : "none" as const,
            lastCommand: this.#lastPlayCommand,
            state: snapshot.player.state === "fallback" ? "fallback" as const : "unavailable" as const
          };

    return {
      ...snapshot,
      audioRoutes: this.#projectAudioRoutes(runtimeStatus),
      player,
      reason: commandFailed ? this.#lastPlayCommand?.error ?? "music_local_agent_play_failed" : snapshot.reason
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
    if (!this.#refreshAuthoritativePlayer(status)) {
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
    if (!this.#refreshAuthoritativePlayer(this.#runtime.getStatus())) {
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
      createAudioUrl: (playbackId, track) => this.#createAudioUrl(playbackId, track),
      playerKind: "local-agent"
    });
    if (!playerState.player.owned || !playerState.audioUrl) {
      this.#markPlayFailed("music_local_agent_lease_unavailable");
      return null;
    }
    const command = this.#issue("track.play", {
      playbackId: desired.playbackId,
      sourceUrl: playerState.audioUrl,
      audioRouteId: desired.audioRouteId,
      startPaused: desired.status === "paused",
      startAtSeconds
    });
    if (!command) {
      this.#markPlayFailed("music_local_agent_command_unavailable");
      return null;
    }
    this.#lastPlayCommand = {
      action: "track.play",
      acknowledgedAt: null,
      error: null,
      eventId: command.eventId,
      status: "pending"
    };
    return command;
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
    if (command.action === "track.play") {
      this.#lastPlayCommand = {
        action: "track.play",
        acknowledgedAt: acknowledgement.acknowledgedAt,
        error: acknowledgement.status === "succeeded"
          ? null
          : acknowledgement.error?.code ?? "music_local_agent_play_failed",
        eventId: command.eventId,
        status: acknowledgement.status
      };
    }
    const audioRouteControl = this.#pendingAudioRouteControls.get(command.eventId);
    if (audioRouteControl) {
      this.#pendingAudioRouteControls.delete(command.eventId);
      if (acknowledgement.status !== "succeeded") {
        this.#audioRouteErrors.set(audioRouteControl.audioRouteId, {
          detail: acknowledgement.error?.code ?? "music_audio_route_command_failed",
          revision: audioRouteControl.revision
        });
        return;
      }
      const current = this.#acknowledgedAudioRoutes.get(audioRouteControl.audioRouteId);
      if (current && audioRouteControl.revision < current.revision) {
        return;
      }
      const state = vlcStateSchema.safeParse(acknowledgement.result);
      const route = state.success
        ? state.data.routes.find((candidate) => candidate.id === audioRouteControl.audioRouteId)
        : undefined;
      if (!route || route.revision !== audioRouteControl.revision) {
        this.#audioRouteErrors.set(audioRouteControl.audioRouteId, {
          detail: "music_audio_route_stale_ack",
          revision: audioRouteControl.revision
        });
        return;
      }
      if (!current || route.revision >= current.revision) {
        this.#acknowledgedAudioRoutes.set(audioRouteControl.audioRouteId, this.#completeRouteStatus(route));
        this.#audioRouteErrors.delete(audioRouteControl.audioRouteId);
      }
      return;
    }
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
      this.#markPlayFailed(acknowledgement.error?.code ?? "music_local_agent_play_failed");
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
      this.#markPlayFailed(acknowledgement.error?.code ?? "music_local_agent_play_failed");
    }
  }

  #markPlayFailed(reason: string): void {
    this.#failedConnectionAt = this.#runtime.getStatus().connectedAt;
    this.#lastPlayCommand = {
      action: "track.play",
      acknowledgedAt: this.#lastPlayCommand?.acknowledgedAt ?? new Date().toISOString(),
      error: reason,
      eventId: this.#lastPlayCommand?.eventId ?? null,
      status: this.#lastPlayCommand?.status === "expired"
        ? "expired"
        : this.#lastPlayCommand?.status === "rejected"
          ? "rejected"
          : "failed"
    };
    this.#playback.failAuthoritativePlayer(playerClientId, reason);
  }

  #refreshAuthoritativePlayer(status: LocalAgentRuntimeStatus): boolean {
    this.#observeConnection(status.connectedAt);
    if (!this.#hasPlaybackCapability(status)) {
      this.#failedConnectionAt = null;
      this.#playback.failAuthoritativePlayer(
        playerClientId,
        status.connected ? "music_local_agent_unavailable" : "music_local_agent_disconnected"
      );
      return false;
    }
    if (this.#failedConnectionAt === status.connectedAt) {
      this.#playback.failAuthoritativePlayer(playerClientId, "music_local_agent_play_failed");
      return false;
    }

    this.#failedConnectionAt = null;
    this.#playback.setAuthoritativePlayer({
      clientId: playerClientId,
      healthyUntil: new Date(Date.now() + commandTtlMs * 2).toISOString()
    });
    return true;
  }

  #observeConnection(connectedAt: string | null): void {
    if (this.#hasObservedConnection && connectedAt === this.#observedConnectionAt) {
      return;
    }
    const previousConnectionAt = this.#observedConnectionAt;
    const isFirstObservation = !this.#hasObservedConnection;
    this.#hasObservedConnection = true;
    this.#observedConnectionAt = connectedAt;
    if (!isFirstObservation) {
      for (const route of localAgentAudioRouteDefinitions) {
        const pendingRevisions = [...this.#pendingAudioRouteControls.values()]
          .filter((pending) => pending.audioRouteId === route.id)
          .map((pending) => pending.revision);
        const previous = Math.max(
          this.#routeRevisionFloors.get(route.id) ?? 0,
          this.#lastProjectedRouteRevisions.get(route.id) ?? 0,
          this.#acknowledgedAudioRoutes.get(route.id)?.revision ?? 0,
          this.#audioRouteErrors.get(route.id)?.revision ?? 0,
          ...pendingRevisions
        );
        this.#routeRevisionFloors.set(route.id, previous + 1);
      }
    }
    this.#acknowledgedAudioRoutes.clear();
    this.#audioRouteErrors.clear();
    if (previousConnectionAt !== null) {
      for (const pending of this.#pendingAudioRouteControls.values()) {
        this.#audioRouteErrors.set(pending.audioRouteId, {
          detail: "music_local_agent_disconnected",
          revision: pending.revision
        });
        this.#pendingByEventId.delete(pending.eventId);
      }
      this.#pendingAudioRouteControls.clear();
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

  #hasRouteControlCapability(status: LocalAgentRuntimeStatus): boolean {
    return status.connected && status.capabilities.some((capability) =>
      capability.id === capabilityId
      && capability.availability !== "unavailable"
      && capability.actions.includes("audio-route.volume.set")
      && capability.actions.includes("audio-route.mute.set")
    );
  }

  #readVlcState(status: LocalAgentRuntimeStatus): VlcState | null {
    const moduleStatus = status.status?.modules.find((module) => module.capabilityId === capabilityId);
    const parsed = vlcStateSchema.safeParse(moduleStatus?.state);
    return parsed.success ? parsed.data : null;
  }

  #projectAudioRoutes(status: LocalAgentRuntimeStatus): readonly LocalAgentAudioRouteStatus[] {
    if (!status.connected) {
      return localAgentAudioRouteDefinitions.map((route) => {
        const error = this.#audioRouteErrors.get(route.id);
        return this.#recordProjectedRoute({
          ...route,
          controlState: error ? "error" as const : "reconnecting" as const,
          state: "reconnecting" as const,
          detail: "Local Agent is not connected",
          ...(error ? { lastError: error.detail } : {}),
          muted: null,
          revision: Math.max(this.#routeRevisionFloors.get(route.id) ?? 0, error?.revision ?? 0),
          volumePercent: null
        });
      });
    }

    const actual = this.#readVlcState(status);

    return localAgentAudioRouteDefinitions.map((route) => {
      const reported = actual?.routes.find((candidate) => candidate.id === route.id);
      const acknowledged = this.#acknowledgedAudioRoutes.get(route.id);
      let projected: LocalAgentAudioRouteStatus = reported
        ? this.#completeRouteStatus(reported)
        : {
        ...route,
        controlState: "unavailable" as const,
        state: "unavailable" as const,
        detail: "Route was not reported by the Local Agent",
        muted: null,
        revision: 0,
        volumePercent: null
      };
      if (acknowledged && acknowledged.revision > projected.revision) {
        projected = acknowledged;
      }
      const newestPending = [...this.#pendingAudioRouteControls.values()]
        .filter((pending) => pending.audioRouteId === route.id && pending.revision > projected.revision)
        .sort((left, right) => right.revision - left.revision)[0];
      if (newestPending) {
        projected = {
          ...projected,
          controlState: "pending",
          ...(newestPending.muted === undefined ? {} : { muted: newestPending.muted }),
          revision: newestPending.revision,
          ...(newestPending.volumePercent === undefined ? {} : { volumePercent: newestPending.volumePercent })
        };
      } else {
        const error = this.#audioRouteErrors.get(route.id);
        if (error) {
          projected = {
            ...projected,
            controlState: "error",
            lastError: error.detail,
            revision: Math.max(projected.revision, error.revision)
          };
        }
      }
      return this.#recordProjectedRoute(projected);
    });
  }

  #completeRouteStatus(reported: z.infer<typeof routeStateSchema>): LocalAgentAudioRouteStatus {
    const route = localAgentAudioRouteDefinitions.find((candidate) => candidate.id === reported.id)!;
    const controlState = reported.controlState
      ?? (reported.state === "available" ? "acknowledged" : reported.state);
    return {
      ...route,
      controlState,
      state: reported.state,
      ...(reported.detail ? { detail: reported.detail } : {}),
      ...(reported.lastError ? { lastError: reported.lastError } : {}),
      muted: reported.muted,
      revision: Math.max(reported.revision, this.#routeRevisionFloors.get(reported.id) ?? 0),
      volumePercent: reported.volumePercent
    };
  }

  #recordProjectedRoute(route: LocalAgentAudioRouteStatus): LocalAgentAudioRouteStatus {
    const previous = this.#lastProjectedRouteRevisions.get(route.id) ?? 0;
    this.#lastProjectedRouteRevisions.set(route.id, Math.max(previous, route.revision));
    return route;
  }

  #nextAudioRouteRevision(
    audioRouteId: MusicPlaybackSnapshot["audioRouteId"],
    routes: readonly LocalAgentAudioRouteStatus[]
  ): number {
    const revisions = [
      routes.find((route) => route.id === audioRouteId)?.revision ?? 0,
      this.#acknowledgedAudioRoutes.get(audioRouteId)?.revision ?? 0,
      ...[...this.#pendingAudioRouteControls.values()]
        .filter((pending) => pending.audioRouteId === audioRouteId)
        .map((pending) => pending.revision)
    ];
    return Math.max(...revisions) + 1;
  }

  #enqueue(operation: () => Promise<void>): void {
    if (this.#disposed) {
      return;
    }
    this.#queue = this.#queue.then(operation).catch((error: unknown) => this.#reportError(error));
  }
}
