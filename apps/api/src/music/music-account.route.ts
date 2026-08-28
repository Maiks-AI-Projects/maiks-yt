import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createMusicService, getMusicSession } from "./music-route-helpers.service.js";
import { catalogQuerySchema, topTracksPayloadSchema } from "./music-route.schema.js";
import type { MusicRouteDependencies } from "./music-route.types.js";

export const registerMusicAccountRoutes = (server: FastifyInstance, dependencies: MusicRouteDependencies): void => {
  const getService = () => createMusicService(dependencies);
  const getSession = async (request: FastifyRequest, reply: FastifyReply) =>
    await getMusicSession(request, reply, dependencies, server);

  server.get("/account/music/top-tracks", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_unavailable" : "not_authenticated" };
    }

    try {
      return await getService().getTopTracks({ authUser: session.user });
    } catch (error) {
      server.log.warn({ err: error }, "Music top tracks read failed.");
      reply.code(503);
      return { ok: false, reason: "music_unavailable" };
    }
  });

  server.get("/account/music/catalog", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_unavailable" : "not_authenticated" };
    }

    const parsedQuery = catalogQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return await getService().listAccountCatalog({
        query: parsedQuery.data.query,
        context: parsedQuery.data.context,
        limit: parsedQuery.data.limit
      });
    } catch (error) {
      server.log.warn({ err: error }, "Music account catalog failed.");
      reply.code(503);
      return { ok: false, reason: "music_unavailable" };
    }
  });

  server.put("/account/music/top-tracks", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "music_unavailable" : "not_authenticated" };
    }

    const parsedBody = topTracksPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "music_top_tracks_invalid_input" };
    }

    try {
      const result = await getService().replaceTopTracks({
        authUser: session.user,
        tracks: parsedBody.data.tracks
      });

      if (!result.ok) {
        reply.code(400);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music top tracks update failed.");
      reply.code(503);
      return { ok: false, reason: "music_unavailable" };
    }
  });
};
