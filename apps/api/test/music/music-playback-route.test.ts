import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerMusicRoutes } from "../../src/music/music.route.js";
import type { MusicPlaybackService } from "../../src/music/music-playback.service.js";
import type { MusicPlaybackSnapshot } from "../../src/music/music-playback.service.js";

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

describe("music playback media route", () => {
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
