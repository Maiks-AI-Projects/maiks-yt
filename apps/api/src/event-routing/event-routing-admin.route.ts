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
import type { EventRoutingAdminUpdateResult } from "./event-routing-admin.types.js";

type EventRoutingAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type EventRoutingAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<EventRoutingAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<EventRoutingAdminService, "listRules" | "updateRule">;
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

export const registerEventRoutingAdminRoutes = (
  server: FastifyInstance,
  dependencies: EventRoutingAdminRouteDependencies
): void => {
  const getService = (): Pick<EventRoutingAdminService, "listRules" | "updateRule"> =>
    dependencies.createService?.()
    ?? new EventRoutingAdminService(createEventRoutingAdminRepository(dependencies.getDatabasePool()));

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
