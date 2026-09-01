import { z } from "zod";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  localAgentAudioRouteIds,
  vlcMusicActions
} from "@maiks-yt/events";

import type { CommandEnvelope, JsonValue, ModuleStatus } from "../../protocol/agent-protocol.types.js";
import {
  ModuleCommandError,
  type ModuleContext,
  type ModuleExecutionContext
} from "../agent-module.types.js";
import {
  VLC_MUSIC_CAPABILITY,
  type VlcMusicAgentModule,
  type VlcMusicBackend,
  type VlcMusicSnapshot
} from "./vlc-music.types.js";

const playbackIdSchema = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);
const sourceUrlSchema = z.url().max(2_048).refine((value) => {
  const url = new URL(value);
  return !url.username
    && !url.password
    && (url.protocol === "https:"
      || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
}, "Music source must use HTTPS or loopback HTTP");
const playSchema = z.object({
  playbackId: playbackIdSchema,
  sourceUrl: sourceUrlSchema,
  audioRouteId: z.enum(localAgentAudioRouteIds).default(DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID),
  startPaused: z.boolean().default(false),
  startAtSeconds: z.number().min(0).max(24 * 60 * 60).default(0)
}).strict();
const playbackSchema = z.object({ playbackId: playbackIdSchema }).strict();
const stopSchema = z.object({ playbackId: playbackIdSchema.nullable().default(null) }).strict();
const seekSchema = z.object({
  playbackId: playbackIdSchema,
  positionSeconds: z.number().min(0).max(24 * 60 * 60)
}).strict();
const routeVolumeSchema = z.object({
  audioRouteId: z.enum(localAgentAudioRouteIds),
  revision: z.number().int().positive(),
  volumePercent: z.number().min(0).max(100)
}).strict();
const routeMuteSchema = z.object({
  audioRouteId: z.enum(localAgentAudioRouteIds),
  muted: z.boolean(),
  revision: z.number().int().positive()
}).strict();
const emptySchema = z.object({}).strict();

const toVlcMusicJson = (snapshot: VlcMusicSnapshot): JsonValue => ({
  activeAudioRouteId: snapshot.activeAudioRouteId,
  available: snapshot.available,
  ...(snapshot.detail ? { detail: snapshot.detail } : {}),
  playbackId: snapshot.playbackId,
  positionSeconds: snapshot.positionSeconds,
  routes: snapshot.routes.map((route) => ({
    id: route.id,
    label: route.label,
    mediaRole: route.mediaRole,
    pipeWireSink: route.pipeWireSink,
    controlState: route.controlState,
    muted: route.muted,
    revision: route.revision,
    state: route.state,
    volumePercent: route.volumePercent,
    ...(route.lastError ? { lastError: route.lastError } : {}),
    ...(route.detail ? { detail: route.detail } : {})
  })),
  status: snapshot.status
});

export class VlcMusicModule implements VlcMusicAgentModule {
  readonly capabilityId = VLC_MUSIC_CAPABILITY;
  readonly #backend: VlcMusicBackend;
  #available = false;
  #detail = "Module has not started";
  #queue: Promise<unknown> = Promise.resolve();
  #removeBackendListener: (() => void) | null = null;
  #snapshot: VlcMusicSnapshot = {
    activeAudioRouteId: DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
    available: false,
    playbackId: null,
    positionSeconds: null,
    routes: [],
    status: "idle" as const
  };

  constructor(backend: VlcMusicBackend) {
    this.#backend = backend;
  }

  async start(context: ModuleContext): Promise<void> {
    const availability = await this.#backend.inspect();
    this.#available = availability.available;
    this.#detail = availability.detail ?? (availability.available ? "VLC ready" : "VLC unavailable");
    this.#snapshot = this.#backend.getSnapshot();
    this.#removeBackendListener = this.#backend.subscribe((snapshot) => {
      this.#snapshot = snapshot;
      context.reportStatus();
    });
  }

  async stop(): Promise<void> {
    this.#removeBackendListener?.();
    this.#removeBackendListener = null;
    await this.#queue.catch(() => undefined);
    await this.#backend.shutdown();
  }

  getCapability() {
    return {
      id: this.capabilityId,
      version: 1,
      actions: this.#available ? vlcMusicActions : [],
      availability: this.#available ? "available" as const : "unavailable" as const,
      detail: this.#detail
    };
  }

  getStatus(): ModuleStatus {
    return {
      capabilityId: this.capabilityId,
      availability: this.#available ? "available" : "unavailable",
      detail: this.#detail,
      state: toVlcMusicJson(this.#snapshot)
    };
  }

  execute(command: CommandEnvelope, context: ModuleExecutionContext): Promise<JsonValue> {
    const operation = this.#queue.then(() => this.#executeNow(command, context.signal));
    this.#queue = operation.catch(() => undefined);
    return operation;
  }

  async #executeNow(command: CommandEnvelope, signal: AbortSignal): Promise<JsonValue> {
    if (!this.#available) {
      throw new ModuleCommandError("VLC_MUSIC_UNAVAILABLE", "VLC music playback is unavailable", true);
    }

    try {
      if (command.action === "track.play") {
        return toVlcMusicJson(await this.#backend.play(playSchema.parse(command.payload), signal));
      }
      if (command.action === "track.pause") {
        return toVlcMusicJson(await this.#backend.pause(playbackSchema.parse(command.payload).playbackId));
      }
      if (command.action === "track.resume") {
        return toVlcMusicJson(await this.#backend.resume(playbackSchema.parse(command.payload).playbackId));
      }
      if (command.action === "track.stop") {
        return toVlcMusicJson(await this.#backend.stop(stopSchema.parse(command.payload).playbackId));
      }
      if (command.action === "track.seek") {
        const request = seekSchema.parse(command.payload);
        return toVlcMusicJson(await this.#backend.seek(request.playbackId, request.positionSeconds));
      }
      if (command.action === "audio-route.volume.set") {
        const route = await this.#backend.setAudioRouteVolume(routeVolumeSchema.parse(command.payload));
        return toVlcMusicJson(this.#snapshotWithRoute(route));
      }
      if (command.action === "audio-route.mute.set") {
        const route = await this.#backend.setAudioRouteMute(routeMuteSchema.parse(command.payload));
        return toVlcMusicJson(this.#snapshotWithRoute(route));
      }
      if (command.action === "status.get") {
        emptySchema.parse(command.payload);
        return toVlcMusicJson(this.#backend.getSnapshot());
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error;
      }
      throw new ModuleCommandError(
        "VLC_COMMAND_FAILED",
        error instanceof Error ? error.message : "VLC command failed",
        true
      );
    }

    throw new ModuleCommandError("ACTION_NOT_REGISTERED", `VLC action ${command.action} is not registered`);
  }

  #snapshotWithRoute(route: VlcMusicSnapshot["routes"][number]): VlcMusicSnapshot {
    this.#snapshot = {
      ...this.#backend.getSnapshot(),
      routes: this.#backend.getSnapshot().routes.map((current) => current.id === route.id ? route : current)
    };
    return this.#snapshot;
  }

}
