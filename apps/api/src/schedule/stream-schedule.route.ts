import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { StreamScheduleService } from "./stream-schedule.service.js";
import { createStreamScheduleRepository } from "./stream-schedule-store.service.js";
import type { StreamScheduleMutationResult } from "./stream-schedule.types.js";

type StreamScheduleAuthSession = {
  user: {
    id: string;
  };
} | null;

type StreamScheduleRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<StreamScheduleAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<StreamScheduleService,
    | "listPublicStreams"
    | "listAdminStreams"
    | "createStream"
    | "updateStream"
    | "cancelStream"
  >;
};

const streamIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const streamPayloadSchema = z.object({
  title: z.string().trim().min(1).max(191),
  description: z.string().trim().max(2_000).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  channelKey: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  topicKey: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).nullable().optional(),
  themeKey: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).nullable().optional(),
  projectId: z.string().trim().min(1).max(36).nullable().optional(),
  focusLabel: z.string().trim().max(120).nullable().optional(),
  focusNote: z.string().trim().max(280).nullable().optional(),
  visibility: z.enum(["draft", "public", "private"]),
  status: z.enum(["planned", "live", "completed", "cancelled"]).default("planned"),
  cancellationReasonCode: z.enum(["health", "family", "energy", "technical", "schedule-conflict", "other"]).nullable().optional(),
  cancellationReason: z.string().trim().min(1).max(500).nullable().optional()
}).strict();

const streamUpdatePayloadSchema = streamPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_stream_schedule_field_required"
);

const cancellationPayloadSchema = z.object({
  cancellationReasonCode: z.enum(["health", "family", "energy", "technical", "schedule-conflict", "other"]),
  cancellationReason: z.string().trim().min(1).max(500)
}).strict();

const sendMutationResult = (
  result: StreamScheduleMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "stream_schedule_admin_user_unlinked"
    || result.reason === "stream_schedule_admin_forbidden"
    ? 403
    : result.reason === "stream_schedule_invalid_input"
      ? 400
      : 404;

  reply.code(statusCode);
  return result;
};

export const registerStreamScheduleRoutes = (
  server: FastifyInstance,
  dependencies: StreamScheduleRouteDependencies
): void => {
  const getService = (): Pick<StreamScheduleService,
    | "listPublicStreams"
    | "listAdminStreams"
    | "createStream"
    | "updateStream"
    | "cancelStream"
  > =>
    dependencies.createService?.()
    ?? new StreamScheduleService(createStreamScheduleRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<StreamScheduleAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/schedule", async () => {
    try {
      return await getService().listPublicStreams();
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule public list failed.");
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });

  server.get("/admin/schedule", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "stream_schedule_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listAdminStreams({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });

  server.post("/admin/schedule", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "stream_schedule_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = streamPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().createStream({
        authUserId: session.user.id,
        ...parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/schedule/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "stream_schedule_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = streamIdParamsSchema.safeParse(request.params);
    const parsedBody = streamUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().updateStream({
        authUserId: session.user.id,
        id: parsedParams.data.id,
        stream: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/schedule/:id/cancel", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "stream_schedule_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = streamIdParamsSchema.safeParse(request.params);
    const parsedBody = cancellationPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().cancelStream({
        authUserId: session.user.id,
        id: parsedParams.data.id,
        cancellation: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule cancellation failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });
};
