import type { AgentModule } from "../agent-module.types.js";

export const VLC_MUSIC_CAPABILITY = "vlc-music" as const;
export const MUSIC_PIPEWIRE_SINK = "stream_music" as const;

export type VlcMusicPlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "stopped"
  | "ended"
  | "error";

export type VlcMusicSnapshot = {
  available: boolean;
  detail?: string;
  playbackId: string | null;
  positionSeconds: number | null;
  status: VlcMusicPlaybackStatus;
  volumePercent: number;
};

export type VlcMusicPlayRequest = {
  playbackId: string;
  sourceUrl: string;
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
  shutdown(): Promise<void>;
}

export interface VlcMusicAgentModule extends AgentModule {
  readonly capabilityId: typeof VLC_MUSIC_CAPABILITY;
}
