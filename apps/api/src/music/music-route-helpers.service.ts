import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";

import { MusicService } from "./music.service.js";
import { createMusicRepository } from "./music-store.service.js";
import { idParamsSchema } from "./music-route.schema.js";
import type { MusicRouteDependencies } from "./music-route.types.js";
import type { MusicAuthSession, MusicBlacklistInput, MusicPlaylistInput, MusicProviderPolicyInput, MusicTrackInput } from "./music.types.js";

export const sendAdminResult = <TResult extends { ok: boolean; reason?: string }>(result: TResult, reply: FastifyReply): TResult => {
  if (result.ok) {
    return result;
  }

  reply.code(result.reason === "music_not_found"
    ? 404
    : result.reason === "music_review_conflict"
      ? 409
      : result.reason === "music_provider_policy_mismatch"
        ? 400
        : 403);
  return result;
};


export const createMusicService = (dependencies: MusicRouteDependencies) =>
  dependencies.createService?.()
  ?? new MusicService(createMusicRepository(dependencies.getDatabasePool()));

export const getMusicSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: MusicRouteDependencies,
  server: FastifyInstance
): Promise<MusicAuthSession> => {
  try {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return null;
    }

    return session;
  } catch (error) {
    server.log.warn({ err: error }, "Music route authentication failed.");
    reply.code(503);
    return null;
  }
};

export const adminOverview = async (
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: MusicRouteDependencies,
  server: FastifyInstance
) => {
  const session = await dependencies.getAuthSession(request);

  if (!session) {
    reply.code(401);
    return { ok: false as const, reason: "not_authenticated" as const };
  }

  try {
    const service = dependencies.createService?.()
      ?? new MusicService(createMusicRepository(dependencies.getDatabasePool()));

    return sendAdminResult(await service.listAdmin({ authUserId: session.user.id }), reply);
  } catch (error) {
    server.log.warn({ err: error }, "Music admin read failed.");
    reply.code(503);
    return { ok: false as const, reason: "music_admin_unavailable" as const };
  }
};

export const adminMutation = async <TSchema extends z.ZodType>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: TSchema,
  methodName: "createProviderPolicy" | "createTrack" | "createPlaylist" | "createBlacklistEntry",
  dependencies: MusicRouteDependencies,
  server: FastifyInstance
) => {
  const session = await dependencies.getAuthSession(request);
  const body = schema.safeParse(request.body);

  if (!session) {
    reply.code(401);
    return { ok: false, reason: "not_authenticated" };
  }
  if (!body.success) {
    reply.code(400);
    return { ok: false, reason: "music_invalid_input" };
  }

  try {
    const service = dependencies.createService?.()
      ?? new MusicService(createMusicRepository(dependencies.getDatabasePool()));

    if (methodName === "createProviderPolicy") {
      return sendAdminResult(await service.createProviderPolicy(session.user.id, body.data as MusicProviderPolicyInput), reply);
    }
    if (methodName === "createTrack") {
      return sendAdminResult(await service.createTrack(session.user.id, body.data as MusicTrackInput), reply);
    }
    if (methodName === "createPlaylist") {
      return sendAdminResult(await service.createPlaylist(session.user.id, body.data as MusicPlaylistInput), reply);
    }

    return sendAdminResult(await service.createBlacklistEntry(session.user.id, body.data as MusicBlacklistInput), reply);
  } catch (error) {
    server.log.warn({ err: error }, "Music admin mutation failed.");
    reply.code(503);
    return { ok: false, reason: "music_admin_unavailable" };
  }
};

export const adminMutationWithId = async <TSchema extends z.ZodType>(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  schema: TSchema,
  methodName: "updateProviderPolicy" | "updateTrack" | "updatePlaylist",
  dependencies: MusicRouteDependencies,
  server: FastifyInstance
) => {
  const session = await dependencies.getAuthSession(request);
  const params = idParamsSchema.safeParse(request.params);
  const body = schema.safeParse(request.body);

  if (!session) {
    reply.code(401);
    return { ok: false, reason: "not_authenticated" };
  }
  if (!params.success || !body.success) {
    reply.code(400);
    return { ok: false, reason: "music_invalid_input" };
  }

  try {
    const service = dependencies.createService?.()
      ?? new MusicService(createMusicRepository(dependencies.getDatabasePool()));

    if (methodName === "updateProviderPolicy") {
      return sendAdminResult(await service.updateProviderPolicy(session.user.id, params.data.id, body.data as MusicProviderPolicyInput), reply);
    }
    if (methodName === "updateTrack") {
      return sendAdminResult(await service.updateTrack(session.user.id, params.data.id, body.data as MusicTrackInput), reply);
    }

    return sendAdminResult(await service.updatePlaylist(session.user.id, params.data.id, body.data as MusicPlaylistInput), reply);
  } catch (error) {
    server.log.warn({ err: error }, "Music admin mutation failed.");
    reply.code(503);
    return { ok: false, reason: "music_admin_unavailable" };
  }
};
