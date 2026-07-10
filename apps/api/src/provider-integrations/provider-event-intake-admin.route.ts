import type { DatabasePool } from "@maiks-yt/database";
import {
  providerEventPlatforms
} from "@maiks-yt/domain/events";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ProviderEventIntakeAdminService } from "./provider-event-intake-admin.service.js";
import { createProviderEventIntakeAdminRepository } from "./provider-event-intake-admin-store.service.js";
import type { ProviderEventIntakeAdminFilters } from "./provider-event-intake-admin.types.js";

type ProviderEventIntakeAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type ProviderEventIntakeAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ProviderEventIntakeAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ProviderEventIntakeAdminService, "getHealth" | "listRecent" | "review">;
};

const optionalBooleanQuery = z.preprocess((value) => {
  if (value === undefined || value === "any" || value === "") {
    return null;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}, z.boolean().nullable());

const intakeQuerySchema = z.object({
  authOrTokenShaped: optionalBooleanQuery.optional(),
  catalogKnown: optionalBooleanQuery.optional(),
  highVolume: optionalBooleanQuery.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  moderationShaped: optionalBooleanQuery.optional(),
  moneyShaped: optionalBooleanQuery.optional(),
  processingStatus: z.enum(["any", "stored", "normalized", "mapped_to_event_history", "ignored", "failed"]).optional(),
  provider: z.enum(["any", ...providerEventPlatforms]).optional()
}).strict();

const reviewParamsSchema = z.object({
  id: z.string().trim().min(1).max(36)
}).strict();

const reviewPayloadSchema = z.object({
  action: z.enum(["map_internal", "ignore"])
}).strict();

const omitUndefinedFilters = (
  filters: z.infer<typeof intakeQuerySchema>
): ProviderEventIntakeAdminFilters => {
  const nextFilters: ProviderEventIntakeAdminFilters = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      (nextFilters as Record<string, unknown>)[key] = value;
    }
  }

  return nextFilters;
};

const getSession = async (
  server: FastifyInstance,
  dependencies: ProviderEventIntakeAdminRouteDependencies,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ProviderEventIntakeAdminAuthSession> => {
  try {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return null;
    }

    return session;
  } catch (error) {
    server.log.warn({ err: error }, "Provider event intake admin authentication failed.");
    reply.code(503);
    return null;
  }
};

export const registerProviderEventIntakeAdminRoutes = (
  server: FastifyInstance,
  dependencies: ProviderEventIntakeAdminRouteDependencies
): void => {
  const getService = (): Pick<ProviderEventIntakeAdminService, "getHealth" | "listRecent" | "review"> =>
    dependencies.createService?.()
    ?? new ProviderEventIntakeAdminService(
      createProviderEventIntakeAdminRepository(dependencies.getDatabasePool())
    );

  server.get("/admin/connections/intake/health", async (request, reply) => {
    const session = await getSession(server, dependencies, request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "provider_event_intake_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getHealth({
        authUserId: session.user.id
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Provider event intake health failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "provider_event_intake_unavailable"
      };
    }
  });

  server.get("/admin/connections/intake", async (request, reply) => {
    const session = await getSession(server, dependencies, request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "provider_event_intake_unavailable" : "not_authenticated"
      };
    }

    const parsedQuery = intakeQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "provider_event_intake_invalid_input"
      };
    }

    try {
      const result = await getService().listRecent({
        authUserId: session.user.id,
        filters: omitUndefinedFilters(parsedQuery.data)
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Provider event intake list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "provider_event_intake_unavailable"
      };
    }
  });

  server.post("/admin/connections/intake/:id/review", async (request, reply) => {
    const session = await getSession(server, dependencies, request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "provider_event_intake_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = reviewParamsSchema.safeParse(request.params);
    const parsedBody = reviewPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "provider_event_intake_invalid_input"
      };
    }

    try {
      const result = await getService().review({
        action: parsedBody.data.action,
        authUserId: session.user.id,
        rowId: parsedParams.data.id
      });

      if (!result.ok) {
        reply.code(result.reason === "provider_event_intake_forbidden" ? 403 : 400);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Provider event intake review failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "provider_event_intake_unavailable"
      };
    }
  });
};
