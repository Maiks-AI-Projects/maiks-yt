import type { DatabasePool } from "@maiks-yt/database";
import type { AgentStatus, CommandAcknowledgement, CommandEnvelope } from "@maiks-yt/events";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerMusicRoutes } from "../../src/music/music.route.js";
import type {
  LocalAgentAcknowledgementListener,
  LocalAgentRuntimeStatus,
  LocalAgentStatusListener
} from "../../src/local-agent/local-agent-runtime.service.js";
import type { MusicLocalAgentRuntime } from "../../src/music/music-local-agent-playback.service.js";
import type { MusicPlaybackService } from "../../src/music/music-playback.service.js";
import type { MusicPlaybackSnapshot } from "../../src/music/music-playback.service.js";
import { musicPlaybackControlPayloadSchema } from "../../src/music/music-route.schema.js";

const playbackService = {
  getCurrentAudioTrack: () => null
} as unknown as MusicPlaybackService;

const controlState: MusicPlaybackSnapshot = {
  ok: true,
  status: "idle",
  audioRouteId: "private",
  audioRoutes: [{
    id: "private",
    label: "Private",
    mediaRole: "Private",
    pipeWireSink: "stream_private",
    state: "reconnecting"
  }],
  playbackId: null,
  currentTrack: null,
  audioUrl: null,
  startedAt: null,
  updatedAt: "2026-09-01T00:00:00.000Z",
  player: {
    connected: false,
    owned: false,
    blockedReason: null
  },
  reason: null
};

const routeAgentStatus = (connectedAt: string | null): LocalAgentRuntimeStatus => {
  const connected = connectedAt !== null;
  const status: AgentStatus = {
    startedAt: "2026-09-01T10:00:00.000Z",
    observedAt: "2026-09-01T10:00:00.000Z",
    modules: [{
      capabilityId: "vlc-music",
      availability: "available",
      state: {
        activeAudioRouteId: "music",
        available: true,
        playbackId: null,
        positionSeconds: 0,
        routes: [],
        status: "idle"
      }
    }]
  };
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
    status: connected ? status : null,
    connectedAt,
    lastSeenAt: connectedAt,
    pendingCommands: 0
  };
};

class RouteRuntimeFixture implements MusicLocalAgentRuntime {
  status = routeAgentStatus("2026-09-01T10:00:00.000Z");
  readonly commands: CommandEnvelope[] = [];
  readonly #statusListeners = new Set<LocalAgentStatusListener>();
  readonly #acknowledgementListeners = new Set<LocalAgentAcknowledgementListener>();

  getStatus(): LocalAgentRuntimeStatus {
    return structuredClone(this.status);
  }

  issueCommand(input: Parameters<MusicLocalAgentRuntime["issueCommand"]>[0]) {
    const command: CommandEnvelope = {
      type: "command",
      eventId: `route-event-${this.commands.length + 1}`,
      commandId: `route-command-${this.commands.length + 1}`,
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

  publishStatus(status: LocalAgentRuntimeStatus): void {
    this.status = status;
    for (const listener of this.#statusListeners) {
      listener(structuredClone(status));
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

describe("music playback media route", () => {
  it("awaits the new Local Agent play command before projecting a Play response", async () => {
    const runtime = new RouteRuntimeFixture();
    let state = controlState;
    let playbackSequence = 0;
    const control = vi.fn(async (input: { action: string }) => {
      if (input.action === "play") {
        playbackSequence += 1;
        state = {
          ...controlState,
          status: "loading",
          audioRouteId: "music",
          playbackId: `playback-${playbackSequence}`,
          currentTrack: {
            trackId: `track-${playbackSequence}`,
            sourceId: `source-${playbackSequence}`,
            title: `Track ${playbackSequence}`,
            artist: "Artist",
            durationSeconds: 60,
            providerKey: "youtube-audio-library",
            providerName: "YouTube Audio Library",
            sourceLabel: "Imported audio",
            attributionText: null,
            licenseName: "YouTube Audio Library",
            licenseKind: "platform-library"
          }
        };
      } else if (input.action === "stop") {
        state = { ...controlState, audioRouteId: "music" };
      }
      return state;
    });
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      createPlaybackService: () => ({
        control,
        getControlState: vi.fn(async () => state),
        getCurrentAudioTrack: vi.fn(),
        getInternalState: vi.fn(() => state),
        getPlayerState: vi.fn(() => ({
          ...state,
          audioUrl: state.playbackId ? `https://api.maiks.yt/music/playback/audio/${state.playbackId}` : null,
          player: {
            authority: "local-agent",
            connected: true,
            kind: "local-agent",
            lastCommand: null,
            owned: true,
            blockedReason: null,
            state: "pending"
          }
        })),
        recordPlayerEvent: vi.fn(async () => state),
        failAuthoritativePlayer: vi.fn(),
        releasePlayerLease: vi.fn(),
        setAuthoritativePlayer: vi.fn()
      }) as unknown as MusicPlaybackService,
      getAuthSession: async () => ({ user: { id: "owner-auth-user" } }),
      getDatabasePool: () => ({}) as DatabasePool,
      localAgentRuntime: runtime,
      publicApiBaseUrl: "https://api.maiks.yt"
    });

    await server.inject({
      method: "POST",
      url: "/admin/music/play-control/control",
      payload: { action: "play", audioRouteId: "music" }
    });
    await settle();
    runtime.acknowledge(runtime.commands[0]!, "failed");
    await server.inject({
      method: "POST",
      url: "/admin/music/play-control/control",
      payload: { action: "stop" }
    });
    await settle();
    runtime.publishStatus(routeAgentStatus(null));
    runtime.publishStatus(routeAgentStatus("2026-09-01T10:01:00.000Z"));
    await settle();

    const response = await server.inject({
      method: "POST",
      url: "/admin/music/play-control/control",
      payload: { action: "play", audioRouteId: "music" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      playbackId: "playback-2",
      player: {
        authority: "local-agent",
        lastCommand: {
          eventId: "route-event-2",
          status: "pending"
        },
        state: "pending"
      }
    });
    expect(runtime.commands.filter((command) => command.action === "track.play")).toHaveLength(2);
    await server.close();
  });

  it("requires typed values for logical route gain and mute actions", () => {
    expect(musicPlaybackControlPayloadSchema.parse({
      action: "route.volume.set",
      audioRouteId: "communication",
      volumePercent: 35
    })).toEqual({
      action: "route.volume.set",
      audioRouteId: "communication",
      volumePercent: 35
    });
    expect(musicPlaybackControlPayloadSchema.parse({
      action: "route.mute.set",
      audioRouteId: "private",
      muted: true
    })).toEqual({
      action: "route.mute.set",
      audioRouteId: "private",
      muted: true
    });
    expect(() => musicPlaybackControlPayloadSchema.parse({
      action: "route.volume.set",
      audioRouteId: "stream_music",
      volumePercent: 35
    })).toThrow();
    expect(() => musicPlaybackControlPayloadSchema.parse({
      action: "route.mute.set",
      audioRouteId: "music"
    })).toThrow();
  });

  it("accepts only typed play-control route ids and passes them to playback", async () => {
    const control = vi.fn(async () => controlState);
    const getInternalState = vi.fn(() => ({ ...controlState, audioRouteId: "music" as const }));
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      createPlaybackService: () => ({
        control,
        getControlState: vi.fn(async () => controlState),
        getCurrentAudioTrack: () => null,
        getInternalState,
        getPlayerState: vi.fn(),
        recordPlayerEvent: vi.fn(),
        releasePlayerLease: vi.fn()
      }) as unknown as MusicPlaybackService,
      getAuthSession: async () => ({ user: { id: "owner-auth-user" } }),
      getDatabasePool: () => ({}) as DatabasePool
    });

    const invalid = await server.inject({
      method: "POST",
      url: "/admin/music/play-control/control",
      payload: { action: "play", audioRouteId: "stream_music;bad" }
    });
    const valid = await server.inject({
      method: "POST",
      url: "/admin/music/play-control/control",
      payload: { action: "play", audioRouteId: "private" }
    });

    expect(invalid.statusCode).toBe(400);
    expect(valid.statusCode).toBe(200);
    expect(control).toHaveBeenCalledTimes(1);
    expect(control).toHaveBeenCalledWith({
      action: "play",
      audioRouteId: "private",
      authUserId: "owner-auth-user",
      trackId: undefined
    });
    await server.close();
  });

  it("accepts the dedicated local-agent bearer without exposing it in the URL", async () => {
    const validateLocalAgent = vi.fn((authorization: string | undefined) =>
      authorization === "Bearer dedicated-local-agent-secret"
    );
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      createPlaybackService: () => playbackService,
      getAuthSession: async () => null,
      getDatabasePool: () => ({}) as DatabasePool,
      validateLocalAgentAuthorizationForRequest: validateLocalAgent
    });

    const denied = await server.inject({
      method: "GET",
      url: "/music/playback/audio/playback-1"
    });
    const accepted = await server.inject({
      method: "GET",
      url: "/music/playback/audio/playback-1",
      headers: { authorization: "Bearer dedicated-local-agent-secret" }
    });

    expect(denied.statusCode).toBe(403);
    expect(accepted.statusCode).toBe(404);
    expect(accepted.json()).toEqual({ ok: false, reason: "music_audio_not_found" });
    expect(validateLocalAgent).toHaveBeenCalledWith("Bearer dedicated-local-agent-secret");
    await server.close();
  });

  it("preserves the existing overlay-token browser fallback", async () => {
    const validateOverlay = vi.fn(async () => ({ valid: true, requiresLogin: false }));
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      createPlaybackService: () => playbackService,
      getAuthSession: async () => null,
      getDatabasePool: () => ({}) as DatabasePool,
      validateUrlAccessTokenForRequest: validateOverlay
    });

    const response = await server.inject({
      method: "GET",
      url: "/music/playback/audio/playback-1?accessToken=existing-overlay-token"
    });

    expect(response.statusCode).toBe(404);
    expect(validateOverlay).toHaveBeenCalledWith({
      scope: "overlay:connect",
      surface: "overlay",
      token: "existing-overlay-token"
    });
    await server.close();
  });
});
