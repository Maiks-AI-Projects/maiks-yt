import type { AgentModule } from "../agent-module.types.js";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  LOCAL_AGENT_VLC_MUSIC_CAPABILITY,
  getLocalAgentAudioRouteDefinition,
  type LocalAgentAudioRouteId,
  type LocalAgentAudioRouteStatus,
  type VlcMusicPlaybackStatus
} from "@maiks-yt/events";

export const VLC_MUSIC_CAPABILITY = LOCAL_AGENT_VLC_MUSIC_CAPABILITY;
export const DEFAULT_VLC_AUDIO_ROUTE_ID = DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID;
export const MUSIC_PIPEWIRE_SINK = getLocalAgentAudioRouteDefinition(DEFAULT_VLC_AUDIO_ROUTE_ID).pipeWireSink;

export type { LocalAgentAudioRouteId, LocalAgentAudioRouteStatus, VlcMusicPlaybackStatus };

export type VlcMusicSnapshot = {
  activeAudioRouteId: LocalAgentAudioRouteId;
  available: boolean;
  detail?: string;
  playbackId: string | null;
  positionSeconds: number | null;
  routes: readonly LocalAgentAudioRouteStatus[];
  status: VlcMusicPlaybackStatus;
  volumePercent: number;
};

export type VlcMusicPlayRequest = {
  playbackId: string;
  sourceUrl: string;
  audioRouteId: LocalAgentAudioRouteId;
  startPaused: boolean;
  startAtSeconds: number;
  volumePercent: number;
};

export interface VlcMusicBackend {
  inspect(): Promise<{ available: boolean; detail?: string }>;
  play(request: VlcMusicPlayRequest, signal: AbortSignal): Promise<VlcMusicSnapshot>;
  pause(playbackId: string): Promise<VlcMusicSnapshot>;
  resume(playbackId: string): Promise<VlcMusicSnapshot>;
  stop(playbackId: string | null): Promise<VlcMusicSnapshot>;
  seek(playbackId: string, positionSeconds: number): Promise<VlcMusicSnapshot>;
  setVolume(volumePercent: number): Promise<VlcMusicSnapshot>;
  getSnapshot(): VlcMusicSnapshot;
  subscribe(listener: (snapshot: VlcMusicSnapshot) => void): () => void;
  shutdown(): Promise<void>;
}

export interface VlcMusicAgentModule extends AgentModule {
  readonly capabilityId: typeof VLC_MUSIC_CAPABILITY;
}
