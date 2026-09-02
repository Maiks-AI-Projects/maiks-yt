import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { StreamScheduleEntry } from "@maiks-yt/domain/schedule";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type {
  WebsiteEventRoutingProductionInput,
  WebsiteEventRoutingProductionPublisher
} from "../event-routing/index.js";
import {
  StreamProviderDeliveryProcessorService
} from "./stream-provider-delivery-processor.service.js";
import {
  createStreamProviderDeliveryProcessorRepository
} from "./stream-provider-delivery-store.service.js";
import {
  createTwitchDeliveryContextRepository,
  createUnavailableYouTubeDeliveryAdapter,
  StreamProviderTwitchDeliveryAdapter
} from "./stream-provider-twitch-delivery-adapter.service.js";
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
    | "replaceStreamGameLinks"
    | "processPendingProviderDeliveries"
  >;
  createDeliveryProcessor?: () => Pick<StreamProviderDeliveryProcessorService, "processPending">;
  routeWebsiteEvent?: WebsiteEventRoutingProductionPublisher;
};

type StreamScheduleWebsiteEventKind = Extract<
  WebsiteEventRoutingProductionInput["eventKind"],
  "website.schedule-changed" | "website.schedule-cancelled"
>;

const buildScheduleWebsiteEvent = (
  stream: StreamScheduleEntry,
  eventKind: StreamScheduleWebsiteEventKind,
  receivedAt: Date
): WebsiteEventRoutingProductionInput => ({
  eventKind,
  sourceEventId: `schedule:${stream.id}:${receivedAt.getTime()}:${randomUUID()}:${eventKind}`,
  actorUserId: null,
  actorExternalId: "maiks-yt:schedule",
  actorDisplayName: "Maiks.yt Schedule",
  userId: null,
  streamSessionId: null,
  streamScheduleEntryId: stream.id,
  sessionId: null,
  redactedPayload: {
    displayText: eventKind === "website.schedule-cancelled"
      ? `${stream.title} was cancelled`
      : `${stream.title} schedule updated`,
    event: {
      title: stream.title,
      startsAt: stream.startsAt,
      channelKey: stream.channelKey,
      status: stream.status
    }
  },
  occurredAt: receivedAt,
  receivedAt
});

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
  cancellationReason: z.string().trim().min(1).max(500).nullable().optional(),
  channelRefs: z.array(z.string().uuid()).max(8).optional()
}).strict();

const streamUpdatePayloadSchema = streamPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_stream_schedule_field_required"
);

const cancellationPayloadSchema = z.object({
  cancellationReasonCode: z.enum(["health", "family", "energy", "technical", "schedule-conflict", "other"]),
  cancellationReason: z.string().trim().min(1).max(500)
}).strict();

const gameLinksPayloadSchema = z.object({
  links: z.array(z.object({
    gameId: z.string().trim().min(1).max(36),
    relationship: z.enum(["planned", "current", "played", "completed-showcase"]),
    publicNote: z.string().trim().max(280).nullable().optional(),
    sortOrder: z.number().int().min(-10_000).max(10_000).optional()
  }).strict()).max(12)
}).strict();

const processProviderDeliveryPayloadSchema = z.object({
  limit: z.number().int().min(1).max(25).optional()
}).strict().optional();

const streamPayloadIssueMessages: Record<string, string> = {
  title: "Enter a stream title.",
  description: "The description is too long.",
  startsAt: "Choose a valid start date and 24-hour time.",
  endsAt: "Choose a valid end date and 24-hour time.",
  channelKey: "Choose a valid connected channel.",
  topicKey: "The topic could not be saved.",
  themeKey: "The theme could not be saved.",
  projectId: "Choose a valid stream project.",
  focusLabel: "The focus label is too long.",
  focusNote: "The focus note is too long.",
  visibility: "Choose draft, public, or private visibility.",
  status: "Choose a valid stream status.",
  cancellationReasonCode: "Choose a valid cancellation reason.",
  cancellationReason: "Add a cancellation explanation.",
  channelRefs: "Choose at least one connected Twitch or YouTube channel."
};

const toStreamPayloadIssueMessages = (error: z.ZodError): string[] => [...new Set(error.issues.map((issue) => {
  const field = String(issue.path[0] ?? "");
  return streamPayloadIssueMessages[field] ?? "One or more schedule fields could not be saved.";
}))];

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
    | "replaceStreamGameLinks"
    | "processPendingProviderDeliveries"
  > =>
    dependencies.createService?.()
    ?? new StreamScheduleService(createStreamScheduleRepository(dependencies.getDatabasePool()));

  const getDeliveryProcessor = (): Pick<StreamProviderDeliveryProcessorService, "processPending"> =>
    dependencies.createDeliveryProcessor?.()
    ?? new StreamProviderDeliveryProcessorService({
      adapters: {
        twitch: new StreamProviderTwitchDeliveryAdapter({
          contextRepository: createTwitchDeliveryContextRepository(dependencies.getDatabasePool())
        }),
        youtube: createUnavailableYouTubeDeliveryAdapter()
      },
      repository: createStreamProviderDeliveryProcessorRepository(dependencies.getDatabasePool()),
      workerId: "api-schedule-operator"
    });

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

  const routePublicMutation = async (
    result: StreamScheduleMutationResult,
    eventKind: StreamScheduleWebsiteEventKind
  ): Promise<void> => {
    if (!result.ok || result.stream.visibility !== "public" || !dependencies.routeWebsiteEvent) {
      return;
    }

    try {
      await dependencies.routeWebsiteEvent(buildScheduleWebsiteEvent(
        result.stream,
        eventKind,
        new Date()
      ));
    } catch (error) {
      server.log.warn({
        err: error,
        eventKind,
        streamScheduleEntryId: result.stream.id
      }, "Public schedule event routing failed after schedule persistence.");
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
        reason: "stream_schedule_invalid_input",
        issues: toStreamPayloadIssueMessages(parsedBody.error)
      };
    }

    try {
      const suppliedCreationRequestId = request.headers["idempotency-key"];
      const parsedCreationRequestId = suppliedCreationRequestId === undefined
        ? { success: true as const, data: randomUUID() }
        : z.string().uuid().safeParse(suppliedCreationRequestId);
      if (!parsedCreationRequestId.success) {
        reply.code(400);
        return {
          ok: false,
          reason: "stream_schedule_invalid_input",
          issues: ["The creation request identifier is invalid. Refresh the form and try again."]
        };
      }
      const result = await getService().createStream({
        authUserId: session.user.id,
        creationRequestId: parsedCreationRequestId.data,
        ...parsedBody.data
      });
      if (result.ok && !result.replayed) {
        await routePublicMutation(result, result.stream.status === "cancelled"
          ? "website.schedule-cancelled"
          : "website.schedule-changed");
      }
      return sendMutationResult(result, reply);
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
        reason: "stream_schedule_invalid_input",
        issues: parsedBody.success
          ? ["The selected scheduled stream is invalid."]
          : toStreamPayloadIssueMessages(parsedBody.error)
      };
    }

    try {
      const result = await getService().updateStream({
        authUserId: session.user.id,
        id: parsedParams.data.id,
        stream: parsedBody.data
      });
      await routePublicMutation(result, parsedBody.data.status === "cancelled"
        ? "website.schedule-cancelled"
        : "website.schedule-changed");
      return sendMutationResult(result, reply);
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
      const result = await getService().cancelStream({
        authUserId: session.user.id,
        id: parsedParams.data.id,
        cancellation: parsedBody.data
      });
      await routePublicMutation(result, "website.schedule-cancelled");
      return sendMutationResult(result, reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule cancellation failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });

  server.put<{ Params: { id: string } }>("/admin/schedule/:id/games", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "stream_schedule_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = streamIdParamsSchema.safeParse(request.params);
    const parsedBody = gameLinksPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    try {
      const result = await getService().replaceStreamGameLinks({
        authUserId: session.user.id,
        id: parsedParams.data.id,
        links: parsedBody.data.links
      });
      return sendMutationResult(result, reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule game link update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });

  server.post("/admin/schedule/provider-deliveries/process-pending", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "stream_schedule_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = processProviderDeliveryPayloadSchema.safeParse(request.body ?? undefined);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    try {
      const limitInput = parsedBody.data?.limit === undefined
        ? {}
        : { limit: parsedBody.data.limit };
      const result = await getService().processPendingProviderDeliveries({
        authUserId: session.user.id,
        ...limitInput,
        processor: getDeliveryProcessor()
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Stream schedule provider delivery processing failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_schedule_unavailable"
      };
    }
  });
};
