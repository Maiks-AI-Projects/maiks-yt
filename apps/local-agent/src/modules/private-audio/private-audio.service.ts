import { z } from "zod";
import type { CommandEnvelope, JsonValue, ModuleStatus } from "../../protocol/agent-protocol.types.js";
import {
  ModuleCommandError,
  type ModuleContext,
  type ModuleExecutionContext
} from "../agent-module.types.js";
import {
  PRIVATE_AUDIO_CAPABILITY,
  type PrivateAudioAgentModule,
  type PrivateAudioAvailability,
  type PrivateAudioBackend
} from "./private-audio.types.js";

const cueSchema = z.object({
  frequencyHz: z.number().min(160).max(2_000).default(660),
  durationMs: z.number().int().min(40).max(2_000).default(140),
  volume: z.number().min(0).max(1).default(0.2)
}).strict();

const speechSchema = z.object({
  text: z.string().trim().min(1).max(500),
  rate: z.number().int().min(80).max(450).default(175),
  voice: z.string().regex(/^[a-zA-Z0-9+_-]{1,32}$/).optional()
}).strict();

export class PrivateAudioModule implements PrivateAudioAgentModule {
  readonly capabilityId = PRIVATE_AUDIO_CAPABILITY;
  readonly #backend: PrivateAudioBackend;
  #availability: PrivateAudioAvailability = {
    cue: false,
    tts: false,
    detail: "Module has not started"
  };
  #queue: Promise<unknown> = Promise.resolve();

  constructor(backend: PrivateAudioBackend) {
    this.#backend = backend;
  }

  async start(_context: ModuleContext): Promise<void> {
    this.#availability = await this.#backend.inspect();
  }

  async stop(): Promise<void> {
    await this.#queue.catch(() => undefined);
  }

  getCapability() {
    const actions = [
      ...(this.#availability.cue ? ["cue.play"] : []),
      ...(this.#availability.tts ? ["tts.speak"] : [])
    ];
    return {
      id: this.capabilityId,
      version: 1,
      actions,
      availability: this.#availability.tts
        ? "available" as const
        : this.#availability.cue
          ? "degraded" as const
          : "unavailable" as const,
      ...(this.#availability.detail ? { detail: this.#availability.detail } : {})
    };
  }

  getStatus(): ModuleStatus {
    const capability = this.getCapability();
    return {
      capabilityId: capability.id,
      availability: capability.availability,
      ...(capability.detail ? { detail: capability.detail } : {})
    };
  }

  execute(command: CommandEnvelope, context: ModuleExecutionContext): Promise<JsonValue> {
    const operation = this.#queue.then(() => this.#executeNow(command, context.signal));
    this.#queue = operation.catch(() => undefined);
    return operation;
  }

  async #executeNow(command: CommandEnvelope, signal: AbortSignal): Promise<JsonValue> {
    if (command.action === "cue.play") {
      if (!this.#availability.cue) {
        throw new ModuleCommandError("PRIVATE_CUE_UNAVAILABLE", "Private cue playback is unavailable", true);
      }
      const request = cueSchema.parse(command.payload);
      await this.#backend.playCue(request, signal);
      return { sink: "stream_private", played: true };
    }
    if (command.action === "tts.speak") {
      if (!this.#availability.tts) {
        throw new ModuleCommandError("PRIVATE_TTS_UNAVAILABLE", "Private TTS playback is unavailable", true);
      }
      const request = speechSchema.parse(command.payload);
      await this.#backend.speak(request, signal);
      return { sink: "stream_private", spoken: true };
    }
    throw new ModuleCommandError(
      "ACTION_NOT_REGISTERED",
      `Private audio action ${command.action} is not registered`
    );
  }
}
