import type { DatabasePool } from "@maiks-yt/database";
import {
  eventKinds,
  eventRoutingDestinations,
  eventRoutingNotificationPriorities,
  eventRoutingRuleSourcePlatforms
} from "@maiks-yt/domain/events";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { EventRoutingAdminService } from "./event-routing-admin.service.js";
import { createEventRoutingAdminRepository } from "./event-routing-admin-store.service.js";
import type {
  EventRoutingAdminApprovalReviewResult,
  EventRoutingAdminPlaybackPublisher,
  EventRoutingAdminUpdateResult
} from "./event-routing-admin.types.js";

type EventRoutingAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type EventRoutingAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<EventRoutingAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  publishPlayback?: EventRoutingAdminPlaybackPublisher;
  createService?: () => Pick<EventRoutingAdminService, "listRules" | "updateRule" | "listPendingApprovals" | "reviewApproval">;
};

const optionalKeySchema = z.string().trim().min(1).max(80).nullable();

const routingRulePayloadSchema = z.object({
  eventKind: z.enum(eventKinds),
  sourcePlatform: z.enum(eventRoutingRuleSourcePlatforms),
  destination: z.enum(eventRoutingDestinations),
  enabled: z.boolean(),
  liveOnly: z.boolean(),
  offlineOnly: z.boolean(),
  approvalRequired: z.boolean(),
  perUserCooldownSeconds: z.number().int().nullable(),
  globalCooldownSeconds: z.number().int().nullable(),
  oncePerStream: z.boolean(),
  templateKey: optionalKeySchema,
  themeKey: optionalKeySchema,
  soundKey: optionalKeySchema,
  notificationPriority: z.enum(eventRoutingNotificationPriorities)
}).strict();

const approvalListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
}).strict();

const approvalParamsSchema = z.object({
  approvalId: z.string().trim().min(1).max(191)
}).strict();

const approvalReviewPayloadSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().trim().min(1).max(1000).nullable().optional()
}).strict();

const sendUpdateResult = (
  result: EventRoutingAdminUpdateResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "event_routing_admin_user_unlinked"
    || result.reason === "event_routing_admin_forbidden"
    ? 403
    : 400;

  reply.code(statusCode);
  return result;
};

const sendApprovalReviewResult = (
  result: EventRoutingAdminApprovalReviewResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  if (result.reason === "event_routing_admin_user_unlinked"
    || result.reason === "event_routing_admin_forbidden") {
    reply.code(403);
    return result;
  }

  reply.code(result.reason === "event_routing_admin_approval_not_found" ? 404 : 400);
  return result;
};

export const registerEventRoutingAdminRoutes = (
  server: FastifyInstance,
  dependencies: EventRoutingAdminRouteDependencies
): void => {
  const getService = (): Pick<EventRoutingAdminService, "listRules" | "updateRule" | "listPendingApprovals" | "reviewApproval"> =>
    dependencies.createService?.()
    ?? new EventRoutingAdminService(
      createEventRoutingAdminRepository(dependencies.getDatabasePool()),
      dependencies.publishPlayback
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<EventRoutingAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Event routing admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/event-routing/rules", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "event_routing_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listRules({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Event routing admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "event_routing_admin_unavailable"
      };
    }
  });

  server.get("/admin/event-routing/approvals/pending", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "event_routing_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedQuery = approvalListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "event_routing_admin_invalid_input"
      };
    }

    try {
      const result = await getService().listPendingApprovals({
        authUserId: session.user.id,
        ...(parsedQuery.data.limit === undefined ? {} : { limit: parsedQuery.data.limit })
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Event routing approval list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "event_routing_admin_unavailable"
      };
    }
  });

  server.post("/admin/event-routing/approvals/:approvalId/review", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "event_routing_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = approvalParamsSchema.safeParse(request.params);
    const parsedBody = approvalReviewPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "event_routing_admin_invalid_input"
      };
    }

    try {
      return sendApprovalReviewResult(await getService().reviewApproval({
        authUserId: session.user.id,
        approvalId: parsedParams.data.approvalId,
        action: parsedBody.data.action,
        reviewNote: parsedBody.data.reviewNote ?? null
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Event routing approval review failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "event_routing_admin_unavailable"
      };
    }
  });

  server.put("/admin/event-routing/rules", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "event_routing_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = routingRulePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "event_routing_admin_invalid_input"
      };
    }

    try {
      return sendUpdateResult(await getService().updateRule({
        authUserId: session.user.id,
        rule: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Event routing admin update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "event_routing_admin_unavailable"
      };
    }
  });
};
