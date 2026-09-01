import { createReadStream } from "node:fs";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createMusicRepository } from "./music-store.service.js";
import { createMusicService, getMusicSession } from "./music-route-helpers.service.js";
import {
  idParamsSchema,
  musicPlaybackAudioQuerySchema,
  musicPlaybackControlPayloadSchema,
  musicPlaybackPlayerEventPayloadSchema,
  musicPlaybackPlayerQuerySchema
} from "./music-route.schema.js";
import type { MusicRouteDependencies } from "./music-route.types.js";
import { resolveStoredMusicAudioFile } from "./music-audio-upload.service.js";
import { MusicPlaybackService } from "./music-playback.service.js";
import { MusicLocalAgentPlaybackCoordinator } from "./music-local-agent-playback.service.js";
import { safeHttpUrlOrNull } from "./music-service-catalog.service.js";
import type { MusicSelectableTrack } from "./music.types.js";

const getRequestOrigin = (request: FastifyRequest): string => {
  const host = request.headers.host ?? "localhost";
  return `${request.protocol}://${host}`;
};

const validateOverlayToken = async (
  accessToken: string,
  reply: FastifyReply,
  dependencies: MusicRouteDependencies
): Promise<boolean> => {
  if (!dependencies.validateUrlAccessTokenForRequest) {
    reply.code(503);
    return false;
  }

  const tokenValidation = await dependencies.validateUrlAccessTokenForRequest({
    token: accessToken,
    surface: "overlay",
    scope: "overlay:connect"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return false;
  }

  return true;
};

const validateMusicAudioAccess = async (
  request: FastifyRequest,
  accessToken: string | undefined,
  reply: FastifyReply,
  dependencies: MusicRouteDependencies
): Promise<boolean> => {
  if (dependencies.validateLocalAgentAuthorizationForRequest?.(request.headers.authorization)) {
    return true;
  }
  if (!accessToken) {
    reply.code(403);
    return false;
  }
  return validateOverlayToken(accessToken, reply, dependencies);
};

export const registerMusicPlaybackRoutes = (
  server: FastifyInstance,
  dependencies: MusicRouteDependencies
): void => {
  let playbackService: MusicPlaybackService | null = null;
  let localAgentCoordinator: MusicLocalAgentPlaybackCoordinator | null = null;
  const getPlaybackService = (): MusicPlaybackService => {
    if (!playbackService) {
      playbackService = dependencies.createPlaybackService?.()
        ?? new MusicPlaybackService(
          createMusicRepository(dependencies.getDatabasePool()),
          createMusicService(dependencies)
        );
    }

    return playbackService;
  };
  const getLocalAgentCoordinator = (): MusicLocalAgentPlaybackCoordinator | null => {
    if (!dependencies.localAgentRuntime || !dependencies.publicApiBaseUrl) {
      return null;
    }
    localAgentCoordinator ??= new MusicLocalAgentPlaybackCoordinator({
      playback: getPlaybackService(),
      publicApiBaseUrl: dependencies.publicApiBaseUrl,
      runtime: dependencies.localAgentRuntime,
      reportError: (error) => server.log.warn({ err: error }, "Local-agent music coordination failed.")
    });
    return localAgentCoordinator;
  };
  server.addHook("onClose", async () => {
    localAgentCoordinator?.dispose();
  });
  const getSession = async (request: FastifyRequest, reply: FastifyReply) =>
    await getMusicSession(request, reply, dependencies, server);

  server.get("/admin/music/play-control/state", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_play_control_unavailable" : "not_authenticated" };
    }

    try {
      const result = await getPlaybackService().getControlState(session.user.id);

      if (!result.ok) {
        reply.code(403);
        return result;
      }

      return getLocalAgentCoordinator()?.projectControlState(result) ?? result;
    } catch (error) {
      server.log.warn({ err: error }, "Music playback state read failed.");
      reply.code(503);
      return { ok: false, reason: "music_play_control_unavailable" };
    }
  });

  server.post("/admin/music/play-control/control", async (request, reply) => {
    const session = await getSession(request, reply);
    const parsedBody = musicPlaybackControlPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_play_control_unavailable" : "not_authenticated" };
    }
    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const playback = getPlaybackService();
      const coordinator = getLocalAgentCoordinator();
      if (coordinator) {
        const coordinated = await coordinator.handleOwnerControl({
          action: parsedBody.data.action,
          audioRouteId: parsedBody.data.audioRouteId,
          authUserId: session.user.id,
          muted: parsedBody.data.muted,
          trackId: parsedBody.data.trackId,
          volumePercent: parsedBody.data.volumePercent
        });
        if (coordinated.handled) {
          if (!coordinated.result.ok) {
            reply.code(403);
            return coordinated.result;
          }

          return coordinator.projectControlState(coordinated.result);
        }
      }

      const before = playback.getInternalState();
      const result = await playback.control({
          action: parsedBody.data.action,
          audioRouteId: parsedBody.data.audioRouteId,
          authUserId: session.user.id,
          trackId: parsedBody.data.trackId
        });

      if (!result.ok) {
        reply.code(403);
        return result;
      }

      getLocalAgentCoordinator()?.handleControl({
        action: parsedBody.data.action,
        before,
        after: result
      });

      return getLocalAgentCoordinator()?.projectControlState(result) ?? result;
    } catch (error) {
      server.log.warn({ err: error }, "Music playback control failed.");
      reply.code(503);
      return { ok: false, reason: "music_play_control_unavailable" };
    }
  });

  server.get("/music/playback/player-state", async (request, reply) => {
    const parsedQuery = musicPlaybackPlayerQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      if (!await validateOverlayToken(parsedQuery.data.accessToken, reply, dependencies)) {
        return { ok: false, reason: reply.statusCode === 503 ? "music_playback_token_unavailable" : "music_playback_access_denied" };
      }

      const origin = getRequestOrigin(request);
      return getPlaybackService().getPlayerState({
        clientId: parsedQuery.data.clientId,
        positionSeconds: parsedQuery.data.positionSeconds ?? null,
        createAudioUrl: (playbackId, track) => {
          if (track.sourceType === "local_audio") {
            const url = new URL(`/music/playback/audio/${encodeURIComponent(playbackId)}`, origin);
            url.searchParams.set("accessToken", parsedQuery.data.accessToken);
            return url.toString();
          }

          return safeHttpUrlOrNull(track.sourceUrl);
        }
      });
    } catch (error) {
      server.log.warn({ err: error }, "Music playback player state failed.");
      reply.code(503);
      return { ok: false, reason: "music_playback_unavailable" };
    }
  });

  server.post("/music/playback/player-events", async (request, reply) => {
    const parsedBody = musicPlaybackPlayerEventPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      if (!await validateOverlayToken(parsedBody.data.accessToken, reply, dependencies)) {
        return { ok: false, reason: reply.statusCode === 503 ? "music_playback_token_unavailable" : "music_playback_access_denied" };
      }

      const result = await getPlaybackService().recordPlayerEvent({
        clientId: parsedBody.data.clientId,
        event: parsedBody.data.event,
        playbackId: parsedBody.data.playbackId,
        positionSeconds: parsedBody.data.positionSeconds ?? null
      });

      if (!result.ok) {
        reply.code(result.reason === "music_player_lease_conflict" ? 409 : 404);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music playback player event failed.");
      reply.code(503);
      return { ok: false, reason: "music_playback_unavailable" };
    }
  });

  server.get<{ Params: { id: string } }>("/music/playback/audio/:id", async (request, reply) => {
    const parsedParams = idParamsSchema.safeParse(request.params);
    const parsedQuery = musicPlaybackAudioQuerySchema.safeParse(request.query);

    if (!parsedParams.success || !parsedQuery.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      if (!await validateMusicAudioAccess(request, parsedQuery.data.accessToken, reply, dependencies)) {
        return { ok: false, reason: reply.statusCode === 503 ? "music_playback_token_unavailable" : "music_playback_access_denied" };
      }

      const track: MusicSelectableTrack | null = getPlaybackService().getCurrentAudioTrack(parsedParams.data.id);

      if (!track || track.sourceType !== "local_audio" || !track.sourceStorageRef || !track.sourceSha256) {
        reply.code(404);
        return { ok: false, reason: "music_audio_not_found" };
      }

      const audioFile = await resolveStoredMusicAudioFile({
        storageRef: track.sourceStorageRef,
        sha256: track.sourceSha256
      });

      if (!audioFile.ok) {
        reply.code(404);
        return { ok: false, reason: "music_audio_not_found" };
      }

      reply.header("Cache-Control", "no-store");
      reply.header("Content-Length", String(audioFile.sizeBytes));
      return reply.type(audioFile.contentType).send(createReadStream(audioFile.filePath));
    } catch (error) {
      server.log.warn({ err: error }, "Music playback audio read failed.");
      reply.code(503);
      return { ok: false, reason: "music_playback_audio_unavailable" };
    }
  });
};
