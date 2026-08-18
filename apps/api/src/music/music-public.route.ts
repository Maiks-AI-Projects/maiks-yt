import type { FastifyInstance } from "fastify";

import { getMusicRequestViewerIp } from "./music-request-hash.service.js";
import { createMusicService } from "./music-route-helpers.service.js";
import { catalogQuerySchema, requestPayloadSchema } from "./music-route.schema.js";
import type { MusicRouteDependencies } from "./music-route.types.js";

export const registerMusicPublicRoutes = (server: FastifyInstance, dependencies: MusicRouteDependencies): void => {
  const getService = () => createMusicService(dependencies);

  server.get("/music/catalog", async (request, reply) => {
    const parsedQuery = catalogQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      return await getService().listPublicCatalog({
        query: parsedQuery.data.query,
        context: parsedQuery.data.context,
        limit: parsedQuery.data.limit
      });
    } catch (error) {
      server.log.warn({ err: error }, "Music public catalog failed.");
      reply.code(503);
      return { ok: false, reason: "music_unavailable" };
    }
  });

  server.post("/music/requests", async (request, reply) => {
    const parsedBody = requestPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "music_invalid_input" };
    }

    try {
      const result = await getService().createAnonymousRequest({
        trackId: parsedBody.data.trackId,
        sourceId: parsedBody.data.sourceId ?? null,
        context: parsedBody.data.context,
        requestText: parsedBody.data.requestText ?? null,
        viewerIp: getMusicRequestViewerIp(request)
      });

      if (!result.ok) {
        reply.code(result.reason === "music_request_daily_limit" ? 429 : 400);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Music public request failed.");
      reply.code(503);
      return { ok: false, reason: "music_request_unavailable" };
    }
  });
};
