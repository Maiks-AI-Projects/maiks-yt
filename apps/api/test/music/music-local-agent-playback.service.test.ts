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
import type { MusicPlaybackControlAction, MusicPlaybackSnapshot } from "../../src/music/music-playback.service.js";
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
  status: MusicPlaybackSnapshot["status"] = playbackId ? "loading" : "idle",
  audioRouteId: MusicPlaybackSnapshot["audioRouteId"] = "music"
): MusicPlaybackSnapshot => ({
  ok: true,
  status,
  audioRouteId,
  audioRoutes: [{
    id: "music",
    label: "Music",
    mediaRole: "Music",
    pipeWireSink: "stream_music",
    controlState: "reconnecting",
    muted: null,
    revision: 0,
    state: "reconnecting",
    volumePercent: null
  }],
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
  player: {
    authority: "none",
    connected: false,
    kind: null,
    lastCommand: null,
    owned: false,
    blockedReason: null,
    state: "idle"
  },
  reason: null
});

const agentStatus = (input: {
  audioRouteId?: "communication" | "music" | "private" | "game";
  connected?: boolean;
  connectedAt?: string;
  playbackId?: string | null;
  routes?: readonly {
    controlState?: "acknowledged" | "pending" | "error" | "unavailable" | "reconnecting";
    id: "communication" | "music" | "private" | "game";
    muted?: boolean | null;
    revision?: number;
    state: "available" | "unavailable" | "error" | "reconnecting";
    volumePercent?: number | null;
  }[];
  status?: "idle" | "loading" | "playing" | "paused" | "stopped" | "ended" | "error";
} = {}): LocalAgentRuntimeStatus => {
  const moduleStatus: AgentStatus = {
    startedAt: "2026-08-27T12:00:00.000Z",
    observedAt: "2026-08-27T12:00:00.000Z",
    modules: [{
      capabilityId: "vlc-music",
      availability: "available",
      state: {
        activeAudioRouteId: input.audioRouteId ?? "music",
        available: true,
        playbackId: input.playbackId ?? null,
        positionSeconds: 0,
        routes: (input.routes ?? [{
          id: "music",
          state: "available"
        }, {
          id: "game",
          state: "unavailable"
        }]).map((route) => ({
          controlState: route.controlState ?? (route.state === "available" ? "acknowledged" : route.state),
          muted: route.muted ?? (route.state === "available" ? false : null),
          revision: route.revision ?? 0,
          volumePercent: route.volumePercent ?? (route.state === "available" ? 70 : null),
          ...route
        })),
        status: input.status ?? "idle"
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
      actions: [
        "track.play",
        "track.pause",
        "track.resume",
        "track.stop",
        "audio-route.volume.set",
        "audio-route.mute.set"
      ],
      availability: "available"
    }] : [],
    status: connected ? moduleStatus : null,
    connectedAt: connected ? input.connectedAt ?? "2026-08-27T12:00:00.000Z" : null,
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

  acknowledge(command: CommandEnvelope, status: CommandAcknowledgement["status"], result?: CommandAcknowledgement["result"]): void {
    const acknowledgement: CommandAcknowledgement = {
      eventId: command.eventId,
      commandId: command.commandId,
      status,
      acknowledgedAt: new Date().toISOString(),
      replayed: false,
      ...(result === undefined ? {} : { result })
    };
    for (const listener of this.#acknowledgementListeners) {
      listener(acknowledgement, command);
    }
  }
}

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const ownedLocalPlayer = (): MusicPlaybackSnapshot["player"] => ({
  authority: "local-agent",
  connected: true,
  kind: "local-agent",
  lastCommand: null,
  owned: true,
  blockedReason: null,
  state: "pending"
});

const createPlaybackFixture = (initialState: MusicPlaybackSnapshot = snapshot("playback-1", "playing")) => {
  const fixture = {
    state: initialState,
    control: vi.fn(async (input: {
      action: MusicPlaybackControlAction;
      audioRouteId?: MusicPlaybackSnapshot["audioRouteId"];
      authUserId: string;
      trackId?: string;
    }) => {
      if (input.action === "route.select" && input.audioRouteId) {
        fixture.state = {
          ...fixture.state,
          audioRouteId: input.audioRouteId,
          updatedAt: "2026-08-27T12:00:01.000Z"
        };
        return fixture.state;
      }

      const playbackId = input.action === "select" && input.trackId ? input.trackId : "playback-2";
      fixture.state = snapshot(playbackId, "loading", input.audioRouteId ?? fixture.state.audioRouteId);
      return fixture.state;
    }),
    getCurrentAudioTrack: vi.fn((playbackId: string) => track(playbackId)),
    getControlState: vi.fn(async () => fixture.state),
    getInternalState: vi.fn(() => fixture.state),
    getPlayerState: vi.fn((input: { createAudioUrl: (id: string, value: MusicSelectableTrack) => string | null }) => ({
      ...fixture.state,
      audioUrl: fixture.state.playbackId
        ? input.createAudioUrl(fixture.state.playbackId, track(fixture.state.playbackId))
        : null,
      player: ownedLocalPlayer()
    })),
    recordPlayerEvent: vi.fn(async (input: {
      event: "started" | "ended" | "failed";
      playbackId: string;
      positionSeconds: number | null;
    }) => {
      fixture.state = input.event === "failed"
        ? { ...snapshot(null), reason: "music_audio_failed_before_start" }
        : snapshot(input.playbackId, "playing", fixture.state.audioRouteId);
      return fixture.state;
    }),
    failAuthoritativePlayer: vi.fn(),
    setAuthoritativePlayer: vi.fn(),
    releasePlayerLease: vi.fn()
  };

  return fixture;
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
      failAuthoritativePlayer: vi.fn(),
      setAuthoritativePlayer: vi.fn(),
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
    expect(playback.failAuthoritativePlayer).toHaveBeenCalledWith(
      "local-agent-vlc",
      "music_local_agent_disconnected"
    );
    coordinator.dispose();
  });

  it("marks an unclaimable Local Agent play as failed instead of suppressing track.play silently", async () => {
    const runtime = new RuntimeFixture();
    const playback = {
      getCurrentAudioTrack: vi.fn(() => track("playback-1")),
      getInternalState: vi.fn(() => snapshot("playback-1")),
      getPlayerState: vi.fn(() => ({
        ...snapshot("playback-1"),
        audioUrl: null,
        player: {
          authority: "browser-fallback" as const,
          connected: true,
          kind: "local-agent" as const,
          lastCommand: null,
          owned: false,
          blockedReason: "music_player_already_connected",
          state: "blocked" as const
        }
      })),
      recordPlayerEvent: vi.fn(),
      failAuthoritativePlayer: vi.fn(),
      setAuthoritativePlayer: vi.fn(),
      releasePlayerLease: vi.fn()
    };
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    coordinator.handleControl({ action: "play", before: snapshot(null), after: snapshot("playback-1") });
    await settle();

    expect(playback.getPlayerState).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "local-agent-vlc",
      playerKind: "local-agent"
    }));
    expect(runtime.commands).toHaveLength(0);
    expect(playback.failAuthoritativePlayer).toHaveBeenCalledWith(
      "local-agent-vlc",
      "music_local_agent_lease_unavailable"
    );
    expect(coordinator.projectControlState(snapshot("playback-1"))).toMatchObject({
      player: {
        authority: "browser-fallback",
        lastCommand: {
          action: "track.play",
          error: "music_local_agent_lease_unavailable",
          status: "failed"
        },
        state: "error"
      },
      reason: "music_local_agent_lease_unavailable"
    });
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
        player: ownedLocalPlayer()
      })),
      recordPlayerEvent: vi.fn(async (input: { event: "started" | "ended" | "failed" }) => {
        playback.state = input.event === "started"
          ? snapshot("playback-1", "playing")
          : snapshot("playback-2", "loading");
        return playback.state;
      }),
      failAuthoritativePlayer: vi.fn(),
      setAuthoritativePlayer: vi.fn(),
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
        audioRouteId: "music",
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

  it.each(["failed", "expired"] as const)(
    "opens browser fallback when local playback %s",
    async (acknowledgementStatus) => {
      const runtime = new RuntimeFixture();
      const playback = {
        getCurrentAudioTrack: vi.fn(() => track("playback-1")),
        getInternalState: vi.fn(() => snapshot("playback-1")),
        getPlayerState: vi.fn((input: { createAudioUrl: (id: string, value: MusicSelectableTrack) => string | null }) => ({
          ...snapshot("playback-1"),
          audioUrl: input.createAudioUrl("playback-1", track("playback-1")),
          player: ownedLocalPlayer()
        })),
        recordPlayerEvent: vi.fn(),
        failAuthoritativePlayer: vi.fn(),
        setAuthoritativePlayer: vi.fn(),
        releasePlayerLease: vi.fn()
      };
      const coordinator = new MusicLocalAgentPlaybackCoordinator({
        playback,
        publicApiBaseUrl: "https://api.maiks.yt",
        runtime
      });
      coordinator.handleControl({ action: "play", before: snapshot(null), after: snapshot("playback-1") });
      await settle();

      runtime.acknowledge(runtime.commands[0]!, acknowledgementStatus);
      await settle();

      expect(playback.failAuthoritativePlayer).toHaveBeenCalledWith(
        "local-agent-vlc",
        "music_local_agent_play_failed"
      );
      coordinator.dispose();
    }
  );

  it("keeps an identical play pending when pre-readiness idle status is published", async () => {
    const runtime = new RuntimeFixture();
    const playback = createPlaybackFixture(snapshot("playback-1", "loading"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleControl({
      action: "play",
      before: snapshot(null),
      after: playback.state
    });
    runtime.publishStatus(agentStatus({ playbackId: null, status: "idle" }));
    await settle();

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    expect(playback.failAuthoritativePlayer).not.toHaveBeenCalledWith(
      "local-agent-vlc",
      "music_local_agent_command_unavailable"
    );
    expect(coordinator.projectControlState(playback.state)).toMatchObject({
      player: {
        authority: "local-agent",
        lastCommand: {
          eventId: runtime.commands[0]!.eventId,
          status: "pending"
        },
        state: "pending"
      }
    });
    coordinator.dispose();
  });

  it("refreshes Local Agent authority when the exact active play succeeds", async () => {
    const runtime = new RuntimeFixture();
    const playback = createPlaybackFixture(snapshot("playback-1", "loading"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });
    playback.setAuthoritativePlayer.mockClear();

    await coordinator.handleControl({
      action: "play",
      before: snapshot(null),
      after: playback.state
    });
    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    await settle();

    expect(playback.setAuthoritativePlayer).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "local-agent-vlc"
    }));
    expect(coordinator.projectControlState(playback.state)).toMatchObject({
      player: {
        authority: "local-agent",
        lastCommand: {
          eventId: runtime.commands[0]!.eventId,
          status: "succeeded"
        }
      }
    });
    coordinator.dispose();
  });

  it("does not duplicate an exact successful play while Agent status is still idle", async () => {
    const runtime = new RuntimeFixture();
    const playback = createPlaybackFixture(snapshot("playback-1", "loading"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleControl({
      action: "play",
      before: snapshot(null),
      after: playback.state
    });
    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    runtime.publishStatus(agentStatus({ playbackId: null, status: "idle" }));
    await settle();

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    coordinator.dispose();
  });

  it("ignores a stale failed play acknowledgement after a newer connection issues a play", async () => {
    const runtime = new RuntimeFixture();
    const playback = createPlaybackFixture(snapshot("playback-old", "loading"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleControl({
      action: "play",
      before: snapshot(null),
      after: playback.state
    });
    const oldCommand = runtime.commands[0]!;
    runtime.publishStatus(agentStatus({ connected: false }));
    runtime.acknowledge(oldCommand, "failed");
    expect(playback.failAuthoritativePlayer).not.toHaveBeenLastCalledWith(
      "local-agent-vlc",
      "music_local_agent_play_failed"
    );
    playback.state = snapshot("playback-new", "loading", "private");
    runtime.publishStatus(agentStatus({
      connectedAt: "2026-08-27T12:01:00.000Z",
      playbackId: null,
      status: "idle"
    }));
    await settle();
    const newCommand = runtime.commands.find((command) => command.eventId !== oldCommand.eventId)!;

    runtime.acknowledge(oldCommand, "failed");
    await settle();

    expect(coordinator.projectControlState(playback.state)).toMatchObject({
      player: {
        authority: "local-agent",
        lastCommand: {
          eventId: newCommand.eventId,
          status: "pending"
        }
      }
    });
    expect(playback.failAuthoritativePlayer).not.toHaveBeenLastCalledWith(
      "local-agent-vlc",
      "music_local_agent_play_failed"
    );
    coordinator.dispose();
  });

  it("stops actual Agent playback from desired idle even after the current play failed", async () => {
    const runtime = new RuntimeFixture();
    const playback = createPlaybackFixture(snapshot("playback-1", "loading"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleControl({
      action: "play",
      before: snapshot(null),
      after: playback.state
    });
    runtime.acknowledge(runtime.commands[0]!, "failed");
    runtime.status = agentStatus({ playbackId: "playback-1", status: "playing" });
    playback.state = snapshot(null);

    await coordinator.handleControl({
      action: "stop",
      before: snapshot("playback-1", "playing"),
      after: playback.state
    });

    expect(runtime.commands.at(-1)).toMatchObject({
      action: "track.stop",
      payload: { playbackId: "playback-1" }
    });
    coordinator.dispose();
  });

  it("does not replay when an idle desired state reconnects", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ connected: false });
    const playback = createPlaybackFixture(snapshot(null));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    runtime.publishStatus(agentStatus({
      connectedAt: "2026-08-27T12:01:00.000Z",
      playbackId: null,
      status: "idle"
    }));
    await settle();

    expect(runtime.commands).toHaveLength(0);
    coordinator.dispose();
  });

  it("passes the selected audio route to local-agent play commands and returns route truth", async () => {
    const runtime = new RuntimeFixture();
    const playback = {
      state: snapshot("playback-1", "loading", "game"),
      getCurrentAudioTrack: vi.fn((playbackId: string) => track(playbackId)),
      getInternalState: vi.fn(() => playback.state),
      getPlayerState: vi.fn((input: { createAudioUrl: (id: string, value: MusicSelectableTrack) => string | null }) => ({
        ...playback.state,
        audioUrl: input.createAudioUrl("playback-1", track("playback-1")),
        player: ownedLocalPlayer()
      })),
      recordPlayerEvent: vi.fn(),
      failAuthoritativePlayer: vi.fn(),
      setAuthoritativePlayer: vi.fn(),
      releasePlayerLease: vi.fn()
    };
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    coordinator.handleControl({ action: "play", before: snapshot(null), after: playback.state });
    await settle();

    expect(runtime.commands[0]).toMatchObject({
      action: "track.play",
      payload: {
        audioRouteId: "game",
        playbackId: "playback-1"
      }
    });
    expect(coordinator.projectControlState(playback.state).audioRoutes).toEqual([{
      id: "communication",
      label: "Communication",
      mediaRole: "Communication",
      pipeWireSink: "stream_communication",
      controlState: "unavailable",
      muted: null,
      revision: 0,
      state: "unavailable",
      detail: "Route was not reported by the Local Agent",
      volumePercent: null
    }, {
      id: "music",
      label: "Music",
      mediaRole: "Music",
      pipeWireSink: "stream_music",
      controlState: "acknowledged",
      muted: false,
      revision: 0,
      state: "available",
      volumePercent: 70
    }, {
      id: "private",
      label: "Private",
      mediaRole: "Private",
      pipeWireSink: "stream_private",
      controlState: "unavailable",
      muted: null,
      revision: 0,
      state: "unavailable",
      detail: "Route was not reported by the Local Agent",
      volumePercent: null
    }, {
      id: "game",
      label: "Game",
      mediaRole: "Game",
      pipeWireSink: "stream_game",
      controlState: "unavailable",
      muted: null,
      revision: 0,
      state: "unavailable",
      volumePercent: null
    }]);
    coordinator.dispose();
  });

  it("replays the current track on a new route when the owner changes output mid-playback", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    const playback = {
      state: snapshot("playback-1", "playing", "private"),
      getCurrentAudioTrack: vi.fn((playbackId: string) => track(playbackId)),
      getInternalState: vi.fn(() => playback.state),
      getPlayerState: vi.fn((input: { createAudioUrl: (id: string, value: MusicSelectableTrack) => string | null }) => ({
        ...playback.state,
        audioUrl: input.createAudioUrl("playback-1", track("playback-1")),
        player: ownedLocalPlayer()
      })),
      recordPlayerEvent: vi.fn(),
      failAuthoritativePlayer: vi.fn(),
      setAuthoritativePlayer: vi.fn(),
      releasePlayerLease: vi.fn()
    };
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    coordinator.handleControl({ action: "route.select", before: snapshot("playback-1", "playing"), after: playback.state });
    await settle();

    expect(runtime.commands[0]).toMatchObject({
      action: "track.play",
      payload: {
        audioRouteId: "private",
        playbackId: "playback-1",
        startAtSeconds: 0
      }
    });
    coordinator.dispose();
  });

  it.each([
    ["next", undefined],
    ["skip", undefined],
    ["select", "playback-selected"]
  ] as const)(
    "defers %s until the old VLC playback stop succeeds",
    async (action, trackId) => {
      const runtime = new RuntimeFixture();
      runtime.status = agentStatus({ playbackId: "playback-1", status: "playing" });
      const playback = createPlaybackFixture(snapshot("playback-1", "playing"));
      const coordinator = new MusicLocalAgentPlaybackCoordinator({
        playback,
        publicApiBaseUrl: "https://api.maiks.yt",
        runtime
      });

      const result = await coordinator.handleOwnerControl({
        action,
        authUserId: "owner-auth-user",
        trackId
      });
      await settle();

      expect(result).toMatchObject({
        handled: true,
        result: {
          ok: true,
          playbackId: "playback-1",
          reason: "music_local_agent_transition_pending"
        }
      });
      expect(playback.control).not.toHaveBeenCalled();
      expect(runtime.commands).toHaveLength(1);
      expect(runtime.commands[0]).toMatchObject({
        action: "track.stop",
        payload: { playbackId: "playback-1" }
      });

      runtime.acknowledge(runtime.commands[0]!, "succeeded");
      await settle();

      expect(playback.control).toHaveBeenCalledWith({
        action,
        authUserId: "owner-auth-user",
        audioRouteId: undefined,
        trackId
      });
      expect(runtime.commands[1]).toMatchObject({
        action: "track.play",
        payload: {
          playbackId: action === "select" ? "playback-selected" : "playback-2"
        }
      });
      coordinator.dispose();
    }
  );

  it.each(["failed", "expired"] as const)(
    "keeps the old state when a %s old-stop acknowledgement blocks a superseding next",
    async (acknowledgementStatus) => {
      const runtime = new RuntimeFixture();
      runtime.status = agentStatus({ playbackId: "playback-1", status: "playing" });
      const playback = createPlaybackFixture(snapshot("playback-1", "playing"));
      const coordinator = new MusicLocalAgentPlaybackCoordinator({
        playback,
        publicApiBaseUrl: "https://api.maiks.yt",
        runtime
      });

      await coordinator.handleOwnerControl({ action: "next", authUserId: "owner-auth-user" });
      runtime.acknowledge(runtime.commands[0]!, acknowledgementStatus);
      await settle();

      expect(playback.control).not.toHaveBeenCalled();
      expect(playback.state.playbackId).toBe("playback-1");
      expect(runtime.commands).toHaveLength(1);
      coordinator.dispose();
    }
  );

  it("ignores duplicate successful stop acknowledgements for a deferred next", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ playbackId: "playback-1", status: "playing" });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleOwnerControl({ action: "next", authUserId: "owner-auth-user" });
    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    await settle();

    expect(playback.control).toHaveBeenCalledTimes(1);
    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    coordinator.dispose();
  });

  it.each(["next", "skip", "select"] as const)(
    "marks the new state failed when %s stops old VLC but new play expires",
    async (action) => {
      const runtime = new RuntimeFixture();
      runtime.status = agentStatus({ playbackId: "playback-1", status: "playing" });
      const playback = createPlaybackFixture(snapshot("playback-1", "playing"));
      const coordinator = new MusicLocalAgentPlaybackCoordinator({
        playback,
        publicApiBaseUrl: "https://api.maiks.yt",
        runtime
      });

      await coordinator.handleOwnerControl({
        action,
        authUserId: "owner-auth-user",
        trackId: action === "select" ? "playback-selected" : undefined
      });
      runtime.acknowledge(runtime.commands[0]!, "succeeded");
      await settle();
      runtime.acknowledge(runtime.commands[1]!, "expired");
      await settle();

      expect(playback.recordPlayerEvent).not.toHaveBeenCalled();
      expect(playback.failAuthoritativePlayer).toHaveBeenCalledWith(
        "local-agent-vlc",
        "music_local_agent_play_failed"
      );
      expect(playback.state.playbackId).toBe(action === "select" ? "playback-selected" : "playback-2");
      coordinator.dispose();
    }
  );

  it("commits an active route change only after the replacement play succeeds", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing", "music"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    const result = await coordinator.handleOwnerControl({
      action: "route.select",
      audioRouteId: "private",
      authUserId: "owner-auth-user"
    });
    await settle();

    expect(result).toMatchObject({
      handled: true,
      result: {
        ok: true,
        audioRouteId: "music",
        reason: "music_local_agent_transition_pending"
      }
    });
    expect(playback.control).not.toHaveBeenCalled();
    expect(runtime.commands[0]).toMatchObject({
      action: "track.play",
      payload: {
        audioRouteId: "private",
        playbackId: "playback-1"
      }
    });

    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    await settle();

    expect(playback.control).toHaveBeenCalledWith({
      action: "route.select",
      authUserId: "owner-auth-user",
      audioRouteId: "private",
      trackId: undefined
    });
    coordinator.dispose();
  });

  it("does not issue a duplicate active route replacement from stale status after success", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing", "music"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleOwnerControl({
      action: "route.select",
      audioRouteId: "private",
      authUserId: "owner-auth-user"
    });
    const firstReplacement = runtime.commands[0]!;

    runtime.acknowledge(firstReplacement, "succeeded");
    await settle();

    const duplicateReplacement = runtime.commands[1];
    if (duplicateReplacement) {
      runtime.acknowledge(duplicateReplacement, "expired");
      await settle();
    }

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    expect(playback.recordPlayerEvent).not.toHaveBeenCalled();
    expect(playback.state).toMatchObject({
      audioRouteId: "private",
      playbackId: "playback-1",
      status: "playing"
    });
    coordinator.dispose();
  });

  it("does not reassert the old route when replacement status arrives before its acknowledgement", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing", "music"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleOwnerControl({
      action: "route.select",
      audioRouteId: "communication",
      authUserId: "owner-auth-user"
    });
    const replacement = runtime.commands[0]!;

    runtime.publishStatus(agentStatus({
      audioRouteId: "communication",
      playbackId: "playback-1",
      status: "playing"
    }));
    await settle();

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    expect(runtime.commands[0]).toBe(replacement);

    runtime.acknowledge(replacement, "succeeded");
    await settle();

    expect(playback.state).toMatchObject({
      audioRouteId: "communication",
      playbackId: "playback-1",
      status: "playing"
    });
    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    coordinator.dispose();
  });

  it("delivers pause, resume, and stop after an acknowledged route switch while status is stale", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing", "music"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleOwnerControl({
      action: "route.select",
      audioRouteId: "private",
      authUserId: "owner-auth-user"
    });
    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    await settle();

    playback.state = snapshot("playback-1", "paused", "private");
    coordinator.handleControl({
      action: "pause",
      before: snapshot("playback-1", "playing", "private"),
      after: playback.state
    });
    await settle();

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    expect(runtime.commands.at(-1)).toMatchObject({
      action: "track.pause",
      payload: { playbackId: "playback-1" }
    });

    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "paused" });
    playback.state = snapshot("playback-1", "playing", "private");
    coordinator.handleControl({
      action: "resume",
      before: snapshot("playback-1", "paused", "private"),
      after: playback.state
    });
    await settle();

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    expect(runtime.commands.at(-1)).toMatchObject({
      action: "track.resume",
      payload: { playbackId: "playback-1" }
    });

    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    playback.state = snapshot(null);
    coordinator.handleControl({
      action: "stop",
      before: snapshot("playback-1", "playing", "private"),
      after: playback.state
    });
    await settle();

    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(1);
    expect(runtime.commands.at(-1)).toMatchObject({
      action: "track.stop",
      payload: { playbackId: "playback-1" }
    });
    coordinator.dispose();
  });

  it("clears acknowledged route suppression on aligned status and allows a later route replacement", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing", "music"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    await coordinator.handleOwnerControl({
      action: "route.select",
      audioRouteId: "private",
      authUserId: "owner-auth-user"
    });
    runtime.acknowledge(runtime.commands[0]!, "succeeded");
    await settle();

    runtime.publishStatus(agentStatus({ audioRouteId: "private", playbackId: "playback-1", status: "playing" }));
    await settle();

    const result = await coordinator.handleOwnerControl({
      action: "route.select",
      audioRouteId: "game",
      authUserId: "owner-auth-user"
    });
    await settle();

    expect(result).toMatchObject({
      handled: true,
      result: {
        ok: true,
        audioRouteId: "private",
        reason: "music_local_agent_transition_pending"
      }
    });
    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(2);
    expect(runtime.commands.at(-1)).toMatchObject({
      action: "track.play",
      payload: {
        audioRouteId: "game",
        playbackId: "playback-1"
      }
    });
    coordinator.dispose();
  });

  it.each(["failed", "expired"] as const)(
    "does not commit an active route change when replacement play %s",
    async (acknowledgementStatus) => {
      const runtime = new RuntimeFixture();
      runtime.status = agentStatus({ audioRouteId: "music", playbackId: "playback-1", status: "playing" });
      const playback = createPlaybackFixture(snapshot("playback-1", "playing", "music"));
      const coordinator = new MusicLocalAgentPlaybackCoordinator({
        playback,
        publicApiBaseUrl: "https://api.maiks.yt",
        runtime
      });

      await coordinator.handleOwnerControl({
        action: "route.select",
        audioRouteId: "private",
        authUserId: "owner-auth-user"
      });
      runtime.acknowledge(runtime.commands[0]!, acknowledgementStatus);
      await settle();

      expect(playback.control).not.toHaveBeenCalled();
      expect(playback.recordPlayerEvent).not.toHaveBeenCalled();
      expect(playback.failAuthoritativePlayer).toHaveBeenCalledWith(
        "local-agent-vlc",
        "music_local_agent_play_failed"
      );
      coordinator.dispose();
    }
  );

  it("does not guess an unreported selected route is available", () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({
      playbackId: "playback-1",
      routes: [{ id: "music", state: "available" }]
    });
    const playback = createPlaybackFixture(snapshot("playback-1", "playing", "private"));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    const projected = coordinator.projectControlState(playback.state);

    expect(projected.audioRoutes.find((route) => route.id === "private")).toMatchObject({
      id: "private",
      state: "unavailable",
      detail: "Route was not reported by the Local Agent"
    });
    coordinator.dispose();
  });

  it("returns pending route gain immediately and acknowledges the exact read-back revision", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({
      routes: [{
        id: "music",
        state: "available",
        controlState: "acknowledged",
        muted: false,
        revision: 3,
        volumePercent: 70
      }]
    });
    const playback = createPlaybackFixture(snapshot(null));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({
      playback,
      publicApiBaseUrl: "https://api.maiks.yt",
      runtime
    });

    const pending = await coordinator.handleOwnerControl({
      action: "route.volume.set",
      audioRouteId: "music",
      authUserId: "owner-auth-user",
      volumePercent: 42
    });

    expect(runtime.commands[0]).toMatchObject({
      action: "audio-route.volume.set",
      payload: {
        audioRouteId: "music",
        revision: 4,
        volumePercent: 42
      }
    });
    expect(pending).toMatchObject({
      handled: true,
      result: {
        audioRoutes: expect.arrayContaining([expect.objectContaining({
          controlState: "pending",
          id: "music",
          muted: false,
          revision: 4,
          volumePercent: 42
        })])
      }
    });

    runtime.acknowledge(runtime.commands[0]!, "succeeded", {
      activeAudioRouteId: "music",
      available: true,
      playbackId: null,
      positionSeconds: null,
      routes: [{
        id: "music",
        state: "available",
        controlState: "acknowledged",
        muted: false,
        revision: 4,
        volumePercent: 42
      }],
      status: "idle"
    });
    await settle();

    expect(coordinator.projectControlState(playback.state).audioRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        controlState: "acknowledged",
        id: "music",
        muted: false,
        revision: 4,
        volumePercent: 42
      })
    ]));
    coordinator.dispose();
  });

  it("keeps the newest route acknowledgement when an older command arrives late", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ routes: [{ id: "music", state: "available", revision: 5, volumePercent: 50 }] });
    const playback = createPlaybackFixture(snapshot(null));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({ playback, publicApiBaseUrl: "https://api.maiks.yt", runtime });

    await coordinator.handleOwnerControl({
      action: "route.volume.set",
      audioRouteId: "music",
      authUserId: "owner-auth-user",
      volumePercent: 35
    });
    await coordinator.handleOwnerControl({
      action: "route.mute.set",
      audioRouteId: "music",
      authUserId: "owner-auth-user",
      muted: true
    });
    const newer = runtime.commands[1]!;
    const older = runtime.commands[0]!;
    const result = (revision: number, muted: boolean, volumePercent: number) => ({
      activeAudioRouteId: "music",
      available: true,
      playbackId: null,
      positionSeconds: null,
      routes: [{ id: "music", state: "available", controlState: "acknowledged", muted, revision, volumePercent }],
      status: "idle"
    });

    runtime.acknowledge(newer, "succeeded", result(7, true, 35));
    runtime.acknowledge(older, "succeeded", result(6, false, 35));
    await settle();

    expect(coordinator.projectControlState(playback.state).audioRoutes.find((route) => route.id === "music")).toMatchObject({
      controlState: "acknowledged",
      muted: true,
      revision: 7,
      volumePercent: 35
    });
    coordinator.dispose();
  });

  it("reports route control unavailable without issuing a command when the Agent is disconnected", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ connected: false });
    const playback = createPlaybackFixture(snapshot(null));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({ playback, publicApiBaseUrl: "https://api.maiks.yt", runtime });

    const result = await coordinator.handleOwnerControl({
      action: "route.mute.set",
      audioRouteId: "private",
      authUserId: "owner-auth-user",
      muted: true
    });

    expect(runtime.commands).toHaveLength(0);
    expect(result).toMatchObject({
      handled: true,
      result: {
        audioRoutes: expect.arrayContaining([expect.objectContaining({
          controlState: "reconnecting",
          id: "private",
          muted: null,
          state: "reconnecting",
          volumePercent: null
        })]),
        reason: "music_local_agent_unavailable"
      }
    });
    coordinator.dispose();
  });

  it("keeps the last applied route value and exposes a failed acknowledgement", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ routes: [{ id: "game", state: "available", revision: 2, volumePercent: 60 }] });
    const playback = createPlaybackFixture(snapshot(null));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({ playback, publicApiBaseUrl: "https://api.maiks.yt", runtime });

    await coordinator.handleOwnerControl({
      action: "route.volume.set",
      audioRouteId: "game",
      authUserId: "owner-auth-user",
      volumePercent: 25
    });
    runtime.acknowledge(runtime.commands[0]!, "failed");
    await settle();

    expect(coordinator.projectControlState(playback.state).audioRoutes.find((route) => route.id === "game"))
      .toMatchObject({
        controlState: "error",
        lastError: "music_audio_route_command_failed",
        revision: 3,
        volumePercent: 60
      });
    coordinator.dispose();
  });

  it("turns an in-flight route command into an error on disconnect and rehydrates newer truth on reconnect", async () => {
    const runtime = new RuntimeFixture();
    runtime.status = agentStatus({ routes: [{ id: "communication", state: "available", revision: 3, volumePercent: 70 }] });
    const playback = createPlaybackFixture(snapshot(null));
    const coordinator = new MusicLocalAgentPlaybackCoordinator({ playback, publicApiBaseUrl: "https://api.maiks.yt", runtime });

    await coordinator.handleOwnerControl({
      action: "route.volume.set",
      audioRouteId: "communication",
      authUserId: "owner-auth-user",
      volumePercent: 40
    });
    runtime.publishStatus(agentStatus({ connected: false }));
    await settle();

    expect(coordinator.projectControlState(playback.state).audioRoutes.find((route) => route.id === "communication"))
      .toMatchObject({
        controlState: "error",
        lastError: "music_local_agent_disconnected",
        revision: 5,
        state: "reconnecting",
        volumePercent: null
      });

    runtime.publishStatus(agentStatus({
      routes: [{ id: "communication", state: "available", revision: 0, volumePercent: 70 }]
    }));
    await settle();

    const reconnectedRoute = coordinator.projectControlState(playback.state).audioRoutes
      .find((route) => route.id === "communication");
    expect(reconnectedRoute).toMatchObject({
        controlState: "acknowledged",
        revision: 6,
        state: "available",
        volumePercent: 70
      });
    expect(reconnectedRoute).not.toHaveProperty("lastError");
    coordinator.dispose();
  });
});
