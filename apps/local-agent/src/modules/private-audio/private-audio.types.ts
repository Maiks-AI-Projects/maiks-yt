import type { AgentModule } from "../agent-module.types.js";

export const PRIVATE_AUDIO_CAPABILITY = "private-audio" as const;
export const PRIVATE_PIPEWIRE_SINK = "stream_private" as const;

export type PrivateCueRequest = {
  frequencyHz: number;
  durationMs: number;
  volume: number;
};

export type PrivateSpeechRequest = {
  text: string;
  rate: number;
  voice?: string | undefined;
};

export type PrivateAudioAvailability = {
  cue: boolean;
  tts: boolean;
  detail?: string | undefined;
};

export interface PrivateAudioBackend {
  inspect(): Promise<PrivateAudioAvailability>;
  playCue(request: PrivateCueRequest, signal: AbortSignal): Promise<void>;
  speak(request: PrivateSpeechRequest, signal: AbortSignal): Promise<void>;
}

export interface PrivateAudioAgentModule extends AgentModule {
  readonly capabilityId: typeof PRIVATE_AUDIO_CAPABILITY;
}
