import type {
  AgentStatus,
  CommandAcknowledgement,
  CommandEnvelope
} from "@maiks-yt/events";
import { describe, expect, it, vi } from "vitest";

import type {
  LocalAgentAcknowledgementListener,
  LocalAgentRuntimeStatus,
  LocalAgentStatusListener
} from "../../src/local-agent/local-agent-runtime.service.js";
import {
  MusicLocalAgentPlaybackCoordinator,
  type MusicLocalAgentRuntime
} from "../../src/music/music-local-agent-playback.service.js";
import type { MusicPlaybackSnapshot } from "../../src/music/music-playback.service.js";
import type { MusicSelectableTrack } from "../../src/music/music.types.js";

const track = (id: string): MusicSelectableTrack => ({
  id,
  trackId: id,
  sourceId: `${id}-source`,
  title: `Track ${id}`,
  artist: "Artist",
  durationSeconds: 180,
  providerKey: "youtube-audio-library",
  providerName: "YouTube Audio Library",
  sourceType: "local_audio",
  sourceLabel: "Imported audio",
  sourceExternalId: id,
  previewUrl: null,
  previewMimeType: null,
  sourceUrl: null,
  sourceStorageRef: `music-audio:${"a".repeat(64)}:${id}.mp3`,
  sourceSha256: "a".repeat(64),
  safetyTags: [],
  explicitContent: false,
  instrumental: true,
  attributionText: null,
  licenseName: "YouTube Audio Library",
  licenseKind: "platform-library",
  licenseUrl: null,
  providerPolicyUrl: null,
  providerTermsUrl: null,
  providerPolicyState: "allowed",
  eligibilityState: "eligible",
  reviewState: "approved",
  liveSafe: true,
  vodSafe: true,
  hasActiveBlacklist: false
});

const snapshot = (
  playbackId: string | null,
  status: MusicPlaybackSnapshot["status"] = playbackId ? "loading" : "idle"
): MusicPlaybackSnapshot => ({
  ok: true,
  status,
  playbackId,
  currentTrack: playbackId ? {
    trackId: playbackId,
    sourceId: `${playbackId}-source`,
    title: `Track ${playbackId}`,
    artist: "Artist",
    durationSeconds: 180,
    providerKey: "youtube-audio-library",
    providerName: "YouTube Audio Library",
    sourceLabel: "Imported audio",
    attributionText: null,
    licenseName: "YouTube Audio Library",
    licenseKind: "platform-library"
  } : null,
  audioUrl: null,
  startedAt: status === "playing" ? "2026-08-27T12:00:00.000Z" : null,
  updatedAt: "2026-08-27T12:00:00.000Z",
  player: { connected: false, owned: false, blockedReason: null },
  reason: null
});

const agentStatus = (input: {
  connected?: boolean;
  playbackId?: string | null;
  status?: "idle" | "loading" | "playing" | "paused" | "stopped" | "ended" | "error";
} = {}): LocalAgentRuntimeStatus => {
  const moduleStatus: AgentStatus = {
    startedAt: "2026-08-27T12:00:00.000Z",
    observedAt: "2026-08-27T12:00:00.000Z",
    modules: [{
      capabilityId: "vlc-music",
      availability: "available",
      state: {
        available: true,
        playbackId: input.playbackId ?? null,
        positionSeconds: 0,
        status: input.status ?? "idle",
        volumePercent: 70
      }
    }]
  };
  const connected = input.connected ?? true;
  return {
    connected,
    identity: connected ? {
      agentId: "agent",
      deviceId: "device",
      protocolVersion: 1,
      serviceVersion: "test"
    } : null,
    capabilities: connected ? [{
      id: "vlc-music",
      version: 1,
      actions: ["track.play", "track.pause", "track.resume", "track.stop"],
      availability: "available"
    }] : [],
    status: connected ? moduleStatus : null,
    connectedAt: connected ? "2026-08-27T12:00:00.000Z" : null,
    lastSeenAt: connected ? "2026-08-27T12:00:00.000Z" : null,
    pendingCommands: 0
  };
};

class RuntimeFixture implements MusicLocalAgentRuntime {
  status = agentStatus();
  readonly commands: CommandEnvelope[] = [];
  readonly #statusListeners = new Set<LocalAgentStatusListener>();
  readonly #acknowledgementListeners = new Set<LocalAgentAcknowledgementListener>();

  getStatus(): LocalAgentRuntimeStatus {
    return structuredClone(this.status);
  }

  issueCommand(input: Parameters<MusicLocalAgentRuntime["issueCommand"]>[0]) {
    const command: CommandEnvelope = {
      type: "command",
      eventId: `event-${this.commands.length + 1}`,
      commandId: `command-${this.commands.length + 1}`,
      issuedAt: new Date().toISOString(),
      capability: input.capability,
      action: input.action,
      payload: input.payload,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
    };
    this.commands.push(command);
    return { ok: true as const, command };
  }

  subscribeToStatus(listener: LocalAgentStatusListener): () => void {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  }

  subscribeToAcknowledgements(listener: LocalAgentAcknowledgementListener): () => void {
    this.#acknowledgementListeners.add(listener);
    return () => this.#acknowledgementListeners.delete(listener);
  }

  publishStatus(next: LocalAgentRuntimeStatus): void {
    this.status = next;
    for (const listener of this.#statusListeners) {
      listener(structuredClone(next));
    }
  }

  acknowledge(command: CommandEnvelope, status: CommandAcknowledgement["status"]): void {
    const acknowledgement: CommandAcknowledgement = {
      eventId: command.eventId,
      commandId: command.commandId,
      status,
      acknowledgedAt: new Date().toISOString(),
      replayed: false
    };
    for (const listener of this.#acknowledgementListeners) {
      listener(acknowledgement, command);
    }
  }
}

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("MusicLocalAgentPlaybackCoordinator", () => {
  it("keeps browser fallback available while the local player is disconnected", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ connected: false });
    const playback = {
      getCurrentAudioTrack: vi.fn(() => track("playback-1")),
      getInternalState: vi.fn(() => snapshot("playback-1")),
      getPlayerState: vi.fn(),
      recordPlayerEvent: vi.fn(),
      releasePlayerLease: vi.fn()
    };
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    coordinator.handleControl({
      action: "play",
      before: snapshot(null),
      after: snapshot("playback-1")
    });
    await settle();

    expect(runtime.commands).toHaveLength(0);
    expect(playback.getPlayerState).not.toHaveBeenCalled();
    expect(playback.releasePlayerLease).toHaveBeenCalledWith("local-agent-vlc");
    coordinator.dispose();
  });

  it("projects local audio to a private token-free API URL and records VLC lifecycle", async () => {
    const runtime = new RuntimeFixture();
    const playback = {
      state: snapshot("playback-1"),
      getCurrentAudioTrack: vi.fn((playbackId: string) => track(playbackId)),
      getInternalState: vi.fn(() => playback.state),
      getPlayerState: vi.fn((input: { createAudioUrl: (id: string, value: MusicSelectableTrack) => string | null }) => ({
        ...playback.state,
        audioUrl: input.createAudioUrl("playback-1", track("playback-1")),
        player: { connected: true, owned: true, blockedReason: null }
      })),
      recordPlayerEvent: vi.fn(async (input: { event: "started" | "ended" | "failed" }) => {
        playback.state = input.event === "started"
          ? snapshot("playback-1", "playing")
          : snapshot("playback-2", "loading");
        return playback.state;
      }),
      releasePlayerLease: vi.fn()
    };
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt/base-path",
      runtime
    });

    coordinator.handleControl({ action: "play", before: snapshot(null), after: playback.state });
    await settle();
    expect(runtime.commands[0]).toMatchObject({
      action: "track.play",
      payload: {
        playbackId: "playback-1",
        sourceUrl: "https://api.maiks.yt/music/playback/audio/playback-1"
      }
    });
    expect(JSON.stringify(runtime.commands[0])).not.toContain("token");

    runtime.publishStatus(agentStatus({ playbackId: "playback-1", status: "playing" }));
    await settle();
    expect(playback.recordPlayerEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "started" }));

    runtime.publishStatus(agentStatus({ playbackId: "playback-1", status: "ended" }));
    await settle();
    expect(playback.recordPlayerEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "ended" }));
    expect(runtime.commands.at(-1)).toMatchObject({
      action: "track.play",
      payload: { playbackId: "playback-2" }
    });
    coordinator.dispose();
  });

  it("releases the player lease when local playback fails", async () => {
    const runtime = new RuntimeFixture();
    const playback = {
      getCurrentAudioTrack: vi.fn(() => track("playback-1")),
      getInternalState: vi.fn(() => snapshot("playback-1")),
      getPlayerState: vi.fn((input: { createAudioUrl: (id: string, value: MusicSelectableTrack) => string | null }) => ({
        ...snapshot("playback-1"),
        audioUrl: input.createAudioUrl("playback-1", track("playback-1")),
        player: { connected: true, owned: true, blockedReason: null }
      })),
      recordPlayerEvent: vi.fn(),
      releasePlayerLease: vi.fn()
    };
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });
    coordinator.handleControl({ action: "play", before: snapshot(null), after: snapshot("playback-1") });
    await settle();

    runtime.acknowledge(runtime.commands[0]!, "failed");

    expect(playback.releasePlayerLease).toHaveBeenCalledWith("local-agent-vlc");
    coordinator.dispose();
  });
});
