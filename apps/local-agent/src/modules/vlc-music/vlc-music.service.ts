import { z } from "zod";

import type { CommandEnvelope, JsonValue, ModuleStatus } from "../../protocol/agent-protocol.types.js";
import {
  ModuleCommandError,
  type ModuleContext,
  type ModuleExecutionContext
} from "../agent-module.types.js";
import {
  VLC_MUSIC_CAPABILITY,
  type VlcMusicAgentModule,
  type VlcMusicBackend
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
  startAtSeconds: z.number().min(0).max(24 * 60 * 60).default(0),
  volumePercent: z.number().min(0).max(100).default(70)
}).strict();
const playbackSchema = z.object({ playbackId: playbackIdSchema }).strict();
const stopSchema = z.object({ playbackId: playbackIdSchema.nullable().default(null) }).strict();
const seekSchema = z.object({
  playbackId: playbackIdSchema,
  positionSeconds: z.number().min(0).max(24 * 60 * 60)
}).strict();
const volumeSchema = z.object({ volumePercent: z.number().min(0).max(100) }).strict();
const emptySchema = z.object({}).strict();

export class VlcMusicModule implements VlcMusicAgentModule {
  readonly capabilityId = VLC_MUSIC_CAPABILITY;
  readonly #backend: VlcMusicBackend;
  #available = false;
  #detail = "Module has not started";
  #queue: Promise<unknown> = Promise.resolve();

  constructor(backend: VlcMusicBackend) {
    this.#backend = backend;
  }

  async start(_context: ModuleContext): Promise<void> {
    const availability = await this.#backend.inspect();
    this.#available = availability.available;
    this.#detail = availability.detail ?? (availability.available ? "VLC ready" : "VLC unavailable");
  }

  async stop(): Promise<void> {
    await this.#queue.catch(() => undefined);
    await this.#backend.shutdown();
  }

  getCapability() {
    return {
      id: this.capabilityId,
      version: 1,
      actions: this.#available
        ? ["track.play", "track.pause", "track.resume", "track.stop", "track.seek", "volume.set", "status.get"]
        : [],
      availability: this.#available ? "available" as const : "unavailable" as const,
      detail: this.#detail
    };
  }

  getStatus(): ModuleStatus {
    return {
      capabilityId: this.capabilityId,
      availability: this.#available ? "available" : "unavailable",
      detail: this.#detail
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
        return await this.#backend.play(playSchema.parse(command.payload), signal);
      }
      if (command.action === "track.pause") {
        return await this.#backend.pause(playbackSchema.parse(command.payload).playbackId);
      }
      if (command.action === "track.resume") {
        return await this.#backend.resume(playbackSchema.parse(command.payload).playbackId);
      }
      if (command.action === "track.stop") {
        return await this.#backend.stop(stopSchema.parse(command.payload).playbackId);
      }
      if (command.action === "track.seek") {
        const request = seekSchema.parse(command.payload);
        return await this.#backend.seek(request.playbackId, request.positionSeconds);
      }
      if (command.action === "volume.set") {
        return await this.#backend.setVolume(volumeSchema.parse(command.payload).volumePercent);
      }
      if (command.action === "status.get") {
        emptySchema.parse(command.payload);
        return this.#backend.getSnapshot();
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
}
