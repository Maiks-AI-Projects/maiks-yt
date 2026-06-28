import type { DatabasePool } from "@maiks-yt/database";
import {
  grantableModeratorTrustLevels,
  moderatorGrantAvailabilities,
  moderatorGrantScopeKinds
} from "@maiks-yt/domain/community";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ModeratorAdminService } from "./moderator-admin.service.js";
import { createModeratorAdminRepository } from "./moderator-admin-store.service.js";
import type {
  ModeratorAdminGrantUpdateInput,
  ModeratorAdminMutationResult
} from "./moderator-admin.types.js";

type ModeratorAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type ModeratorAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ModeratorAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ModeratorAdminService,
    | "listModerators"
    | "grantRole"
    | "updateGrant"
    | "revokeGrant"
  >;
};

const grantIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const nullableText = (maxLength: number) =>
  z.string().trim().max(maxLength).nullable().optional();

const expiresAtSchema = z.string().trim().datetime({ offset: true }).nullable().optional();

const grantPayloadSchema = z.object({
  targetUserId: z.string().trim().min(1).max(191),
  roleId: z.string().trim().min(1).max(191),
  trustLevel: z.enum(grantableModeratorTrustLevels),
  scopeKind: z.enum(moderatorGrantScopeKinds),
  scopeId: nullableText(191),
  availability: z.enum(moderatorGrantAvailabilities),
  expiresAt: expiresAtSchema,
  reason: nullableText(280)
}).strict();

const grantUpdatePayloadSchema = grantPayloadSchema.pick({
  trustLevel: true,
  scopeKind: true,
  scopeId: true,
  availability: true,
  expiresAt: true,
  reason: true
}).partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_moderator_grant_field_required"
);

const revokePayloadSchema = z.object({
  reason: nullableText(280)
}).strict();

const compactUpdatePayload = (
  input: z.infer<typeof grantUpdatePayloadSchema>
): ModeratorAdminGrantUpdateInput => {
  const update: ModeratorAdminGrantUpdateInput = {};

  if (input.trustLevel !== undefined) {
    update.trustLevel = input.trustLevel;
  }
  if (input.scopeKind !== undefined) {
    update.scopeKind = input.scopeKind;
  }
  if (input.scopeId !== undefined) {
    update.scopeId = input.scopeId;
  }
  if (input.availability !== undefined) {
    update.availability = input.availability;
  }
  if (input.expiresAt !== undefined) {
    update.expiresAt = input.expiresAt;
  }
  if (input.reason !== undefined) {
    update.reason = input.reason;
  }

  return update;
};

const sendMutationResult = (
  result: ModeratorAdminMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "moderator_admin_user_unlinked"
    || result.reason === "moderator_admin_forbidden"
    || result.reason === "moderator_admin_role_forbidden"
    ? 403
    : result.reason === "moderator_admin_invalid_input"
      ? 400
      : result.reason === "moderator_admin_grant_exists"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

export const registerModeratorAdminRoutes = (
  server: FastifyInstance,
  dependencies: ModeratorAdminRouteDependencies
): void => {
  const getService = (): Pick<ModeratorAdminService,
    | "listModerators"
    | "grantRole"
    | "updateGrant"
    | "revokeGrant"
  > =>
    dependencies.createService?.()
    ?? new ModeratorAdminService(createModeratorAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<ModeratorAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/moderators", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listModerators({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.post("/admin/moderators/grants", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = grantPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().grantRole({
        authUserId: session.user.id,
        grant: {
          ...parsedBody.data,
          scopeId: parsedBody.data.scopeId ?? null,
          expiresAt: parsedBody.data.expiresAt ?? null,
          reason: parsedBody.data.reason ?? null
        }
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Moderator admin grant failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/moderators/grants/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = grantIdParamsSchema.safeParse(request.params);
    const parsedBody = grantUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().updateGrant({
        authUserId: session.user.id,
        grantId: parsedParams.data.id,
        update: compactUpdatePayload(parsedBody.data)
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Moderator admin grant update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/moderators/grants/:id/revoke", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = grantIdParamsSchema.safeParse(request.params);
    const parsedBody = revokePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().revokeGrant({
        authUserId: session.user.id,
        grantId: parsedParams.data.id,
        reason: parsedBody.data.reason ?? null
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Moderator admin grant revoke failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });
};
