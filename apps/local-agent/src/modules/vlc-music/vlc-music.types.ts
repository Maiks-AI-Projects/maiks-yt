import type { AgentModule, ModuleExecutionContext } from "../agent-module.types.js";
import type { JsonValue } from "../../protocol/agent-protocol.types.js";

export const VLC_MUSIC_CAPABILITY = "vlc-music" as const;
export const MUSIC_PIPEWIRE_SINK = "stream_music" as const;

export type VlcMusicCommand =
  | { action: "play"; playbackId: string; sourceUrl: string; startAtSeconds?: number }
  | { action: "pause"; playbackId: string }
  | { action: "resume"; playbackId: string }
  | { action: "stop"; playbackId: string }
  | { action: "seek"; playbackId: string; positionSeconds: number };

export interface VlcMusicModule extends AgentModule {
  readonly capabilityId: typeof VLC_MUSIC_CAPABILITY;
  executeMusic(command: VlcMusicCommand, context: ModuleExecutionContext): Promise<JsonValue>;
}
