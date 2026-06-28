import type { DatabasePool } from "@maiks-yt/database";
import { eventKinds, eventSourcePlatforms } from "@maiks-yt/domain/events";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { EventRoutingDispatchService } from "./event-routing-dispatch.service.js";
import { createEventRoutingDispatchRepository } from "./event-routing-dispatch-store.service.js";
import type {
  EventRoutingDispatchResult,
  EventRoutingPlaybackPublisher
} from "./event-routing-dispatch.types.js";

type EventRoutingDispatchRouteDependencies = {
  getDatabasePool: () => DatabasePool;
  publishPlayback?: EventRoutingPlaybackPublisher;
  createService?: () => Pick<EventRoutingDispatchService, "dispatch">;
};

const optionalIdSchema = z.string().trim().min(1).max(191).nullable().optional();

const dispatchPayloadSchema = z.object({
  sourcePlatform: z.enum(eventSourcePlatforms),
  eventKind: z.enum(eventKinds),
  explicitSimulation: z.boolean().default(false),
  isRealMoney: z.boolean().default(false),
  sourceEventId: optionalIdSchema,
  actorUserId: optionalIdSchema,
  actorExternalId: optionalIdSchema,
  actorDisplayName: optionalIdSchema,
  userId: optionalIdSchema,
  streamSessionId: optionalIdSchema,
  streamScheduleEntryId: optionalIdSchema,
  sessionId: optionalIdSchema,
  occurredAt: z.string().datetime().nullable().optional(),
  redactedPayload: z.record(z.string(), z.unknown()).optional()
}).strict();

const sendDispatchResult = (
  result: EventRoutingDispatchResult,
  reply: FastifyReply
): EventRoutingDispatchResult => {
  if (result.ok) {
    return result;
  }

  reply.code(result.reason === "event_routing_dispatch_unavailable" ? 503 : 400);
  return result;
};

export const registerEventRoutingDispatchRoutes = (
  server: FastifyInstance,
  dependencies: EventRoutingDispatchRouteDependencies
): void => {
  const getService = (): Pick<EventRoutingDispatchService, "dispatch"> =>
    dependencies.createService?.()
    ?? new EventRoutingDispatchService(
      createEventRoutingDispatchRepository(dependencies.getDatabasePool()),
      dependencies.publishPlayback
    );

  server.post("/dev/event-routing/dispatch", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      reply.code(404);
      return {
        ok: false,
        reason: "not_found"
      };
    }

    const parsedBody = dispatchPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "event_routing_dispatch_invalid_input"
      };
    }

    try {
      return sendDispatchResult(await getService().dispatch({
        sourcePlatform: parsedBody.data.sourcePlatform,
        eventKind: parsedBody.data.eventKind,
        explicitSimulation: parsedBody.data.explicitSimulation,
        isRealMoney: parsedBody.data.isRealMoney,
        sourceEventId: parsedBody.data.sourceEventId ?? null,
        actorUserId: parsedBody.data.actorUserId ?? null,
        actorExternalId: parsedBody.data.actorExternalId ?? null,
        actorDisplayName: parsedBody.data.actorDisplayName ?? null,
        userId: parsedBody.data.userId ?? null,
        streamSessionId: parsedBody.data.streamSessionId ?? null,
        streamScheduleEntryId: parsedBody.data.streamScheduleEntryId ?? null,
        sessionId: parsedBody.data.sessionId ?? null,
        redactedPayload: parsedBody.data.redactedPayload ?? {},
        occurredAt: parsedBody.data.occurredAt ?? null
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Event routing simulated dispatch failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "event_routing_dispatch_unavailable"
      };
    }
  });
};
