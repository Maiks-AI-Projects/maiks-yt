import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createMusicRepository } from "./music-store.service.js";
import { adminMutation, adminMutationWithId, adminOverview, createMusicService, getMusicSession, sendAdminResult } from "./music-route-helpers.service.js";
import { blacklistSchema, historyPayloadSchema, idParamsSchema, licenseSnapshotSchema, limitQuerySchema, musicAudioUploadPayloadSchema, playlistSchema, playlistTracksSchema, providerPolicySchema, reviewResolveSchema, revokeSchema, sourceSchema, trackSchema, youtubeAudioLibraryImportPayloadSchema } from "./music-route.schema.js";
import type { MusicRouteDependencies } from "./music-route.types.js";
import type { MusicLicenseSnapshotInput, MusicPlaybackOutcomeInput, MusicTrackSourceInput } from "./music.types.js";
import { MusicAudioStorageVerificationService, MusicAudioUploadService, musicAudioUploadMaxBytes } from "./music-audio-upload.service.js";
import { createMusicYouTubeAudioLibraryImportRepository } from "./music-youtube-audio-library-import-store.service.js";
import { MusicIncompetechImportService, MusicYouTubeAudioLibraryImportService } from "./music-youtube-audio-library-import.service.js";

export const registerMusicAdminRoutes = (server: FastifyInstance, dependencies: MusicRouteDependencies): void => {
  const getService = () => createMusicService(dependencies);
  const getImportService = () => dependencies.createImportService?.()
    ?? new MusicYouTubeAudioLibraryImportService(
      createMusicRepository(dependencies.getDatabasePool()),
      createMusicYouTubeAudioLibraryImportRepository(dependencies.getDatabasePool()),
      new MusicAudioStorageVerificationService()
    );
  const getIncompetechImportService = () => dependencies.createIncompetechImportService?.()
    ?? new MusicIncompetechImportService(
      createMusicRepository(dependencies.getDatabasePool()),
      createMusicYouTubeAudioLibraryImportRepository(dependencies.getDatabasePool()),
      new MusicAudioStorageVerificationService()
    );
  const getAudioUploadService = () => dependencies.createAudioUploadService?.()
    ?? new MusicAudioUploadService(createMusicRepository(dependencies.getDatabasePool()));
  const getSession = async (request: FastifyRequest, reply: FastifyReply) =>
    await getMusicSession(request, reply, dependencies, server);

  server.get("/admin/music", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }

    try {
      return sendAdminResult(await getService().listAdmin({ authUserId: session.user.id }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music admin overview failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.get("/admin/music/provider-policies", async (request, reply) => {
    const result = await adminOverview(request, reply, dependencies, server);
    return result.ok ? { ok: true, providerPolicies: result.providerPolicies } : result;
  });
  server.post("/admin/music/provider-policies", async (request, reply) => {
    return await adminMutation(request, reply, providerPolicySchema, "createProviderPolicy", dependencies, server);
  });
  server.put<{ Params: { id: string } }>("/admin/music/provider-policies/:id", async (request, reply) => {
    return await adminMutationWithId(request, reply, providerPolicySchema, "updateProviderPolicy", dependencies, server);
  });

  server.get("/admin/music/catalog", async (request, reply) => {
    const result = await adminOverview(request, reply, dependencies, server);
    return result.ok ? { ok: true, tracks: result.tracks } : result;
  });
  server.post("/admin/music/catalog", async (request, reply) => {
    return await adminMutation(request, reply, trackSchema, "createTrack", dependencies, server);
  });
  server.put<{ Params: { id: string } }>("/admin/music/catalog/:id", async (request, reply) => {
    return await adminMutationWithId(request, reply, trackSchema, "updateTrack", dependencies, server);
  });
  server.post<{ Params: { id: string } }>("/admin/music/catalog/:id/sources", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = sourceSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().createTrackSource(
        session.user.id,
        params.data.id,
        body.data as MusicTrackSourceInput
      ), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music source create failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });
  server.put<{ Params: { id: string } }>("/admin/music/sources/:id", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = sourceSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().updateTrackSource(
        session.user.id,
        params.data.id,
        body.data as MusicTrackSourceInput
      ), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music source update failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });
  server.post<{ Params: { id: string } }>("/admin/music/sources/:id/license-snapshots", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = licenseSnapshotSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().createLicenseSnapshot(
        session.user.id,
        params.data.id,
        body.data as MusicLicenseSnapshotInput
      ), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music license snapshot create failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });
  server.put<{ Params: { id: string } }>("/admin/music/license-snapshots/:id", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = licenseSnapshotSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().updateLicenseSnapshot(
        session.user.id,
        params.data.id,
        body.data as MusicLicenseSnapshotInput
      ), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music license snapshot update failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.post("/admin/music/imports/audio", {
    bodyLimit: musicAudioUploadMaxBytes * 2
  }, async (request, reply) => {
    const session = await getSession(request, reply);
    const body = musicAudioUploadPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const result = await getAudioUploadService().upload({
        authUserId: session.user.id,
        filename: body.data.filename,
        contentType: body.data.contentType,
        dataBase64: body.data.dataBase64
      });

      if (!result.ok) {
        reply.code(result.reason === "music_audio_upload_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music audio upload failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.post("/admin/music/imports/youtube-audio-library/dry-run", async (request, reply) => {
    const session = await getSession(request, reply);
    const body = youtubeAudioLibraryImportPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const result = await getImportService().dryRun(session.user.id, body.data.manifest);

      if (!result.ok) {
        reply.code(
          result.reason === "music_import_invalid_manifest"
            || result.reason === "music_import_incomplete_manifest"
            || result.reason === "music_import_audio_unverified"
            || result.reason === "music_import_stale_manifest"
            || result.reason === "music_import_future_manifest"
            ? 400
            : 403
        );
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music YouTube Audio Library dry-run failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.post("/admin/music/imports/youtube-audio-library/apply", async (request, reply) => {
    const session = await getSession(request, reply);
    const body = youtubeAudioLibraryImportPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const result = await getImportService().apply(session.user.id, body.data.manifest);

      if (!result.ok) {
        reply.code(
          result.reason === "music_import_invalid_manifest"
            || result.reason === "music_import_incomplete_manifest"
            || result.reason === "music_import_audio_unverified"
            || result.reason === "music_import_stale_manifest"
            || result.reason === "music_import_future_manifest"
            ? 400
            : 403
        );
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music YouTube Audio Library import failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.post("/admin/music/imports/incompetech/dry-run", async (request, reply) => {
    const session = await getSession(request, reply);
    const body = youtubeAudioLibraryImportPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const result = await getIncompetechImportService().dryRun(session.user.id, body.data.manifest);

      if (!result.ok) {
        reply.code(
          result.reason === "music_import_invalid_manifest"
            || result.reason === "music_import_incomplete_manifest"
            || result.reason === "music_import_audio_unverified"
            ? 400
            : 403
        );
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music Incompetech dry-run failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.post("/admin/music/imports/incompetech/apply", async (request, reply) => {
    const session = await getSession(request, reply);
    const body = youtubeAudioLibraryImportPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const result = await getIncompetechImportService().apply(session.user.id, body.data.manifest);

      if (!result.ok) {
        reply.code(
          result.reason === "music_import_invalid_manifest"
            || result.reason === "music_import_incomplete_manifest"
            || result.reason === "music_import_audio_unverified"
            ? 400
            : 403
        );
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music Incompetech import failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.get("/admin/music/playlists", async (request, reply) => {
    const result = await adminOverview(request, reply, dependencies, server);
    return result.ok ? { ok: true, playlists: result.playlists } : result;
  });
  server.post("/admin/music/playlists", async (request, reply) => {
    return await adminMutation(request, reply, playlistSchema, "createPlaylist", dependencies, server);
  });
  server.put<{ Params: { id: string } }>("/admin/music/playlists/:id", async (request, reply) => {
    return await adminMutationWithId(request, reply, playlistSchema, "updatePlaylist", dependencies, server);
  });
  server.put<{ Params: { id: string } }>("/admin/music/playlists/:id/tracks", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = playlistTracksSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().replacePlaylistTracks(session.user.id, params.data.id, body.data.tracks), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music playlist membership update failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.get("/admin/music/blacklist", async (request, reply) => {
    const result = await adminOverview(request, reply, dependencies, server);
    return result.ok ? { ok: true, blacklistEntries: result.blacklistEntries } : result;
  });
  server.post("/admin/music/blacklist", async (request, reply) => {
    return await adminMutation(request, reply, blacklistSchema, "createBlacklistEntry", dependencies, server);
  });
  server.post<{ Params: { id: string } }>("/admin/music/blacklist/:id/revoke", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = revokeSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().revokeBlacklistEntry(session.user.id, params.data.id, body.data.reason), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music blacklist revoke failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.get("/admin/music/review-queue", async (request, reply) => {
    const result = await adminOverview(request, reply, dependencies, server);
    return result.ok ? { ok: true, reviewQueue: result.reviewQueue } : result;
  });
  server.put<{ Params: { id: string } }>("/admin/music/review-queue/:id/resolve", async (request, reply) => {
    const session = await getSession(request, reply);
    const params = idParamsSchema.safeParse(request.params);
    const body = reviewResolveSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_admin_unavailable" : "not_authenticated" };
    }
    if (!params.success || !body.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return sendAdminResult(await getService().resolveReviewQueueItem(session.user.id, params.data.id, {
        action: body.data.action,
        note: body.data.note ?? null
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Music review queue resolve failed.");
      reply.code(503);
      return { ok: false, reason: "music_admin_unavailable" };
    }
  });

  server.get("/admin/music/play-history", async (request, reply) => {
    const parsedQuery = limitQuerySchema.safeParse(request.query);
    const result = await adminOverview(request, reply, dependencies, server);

    if (!parsedQuery.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    return result.ok ? { ok: true, playHistory: result.playHistory.slice(0, parsedQuery.data.limit) } : result;
  });

  server.post("/admin/music/play-control/history", async (request, reply) => {
    const session = await getSession(request, reply);
    const parsedBody = historyPayloadSchema.safeParse(request.body);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_play_control_unavailable" : "not_authenticated" };
    }
    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const historyInput = {
        trackId: parsedBody.data.trackId,
        sourceId: parsedBody.data.sourceId ?? null,
        requestId: parsedBody.data.requestId ?? null,
        playlistId: parsedBody.data.playlistId ?? null,
        streamSessionId: parsedBody.data.streamSessionId ?? null,
        startedAt: parsedBody.data.startedAt ? new Date(parsedBody.data.startedAt) : new Date(),
        endedAt: parsedBody.data.endedAt ? new Date(parsedBody.data.endedAt) : null,
        outcome: parsedBody.data.outcome as MusicPlaybackOutcomeInput,
        outcomeReason: parsedBody.data.outcomeReason ?? null,
        durationPlayedSeconds: parsedBody.data.durationPlayedSeconds ?? null,
        ...(parsedBody.data.publicVisible === undefined ? {} : { publicVisible: parsedBody.data.publicVisible })
      };
      const result = await getService().appendPlayHistory(session.user.id, historyInput);

      if (!result.ok) {
        reply.code(result.reason === "music_track_not_found" ? 404 : 400);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music play control append failed.");
      reply.code(503);
      return { ok: false, reason: "music_play_control_unavailable" };
    }
  });
};
