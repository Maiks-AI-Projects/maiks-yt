import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerMusicRoutes } from "../../src/music/music.route.js";
import type { MusicPlaybackService } from "../../src/music/music-playback.service.js";

const playbackService = {
  getCurrentAudioTrack: () => null
} as unknown as MusicPlaybackService;

describe("music playback media route", () => {
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
