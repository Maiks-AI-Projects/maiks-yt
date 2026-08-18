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
    | "createRankPath"
    | "updateRankPath"
    | "deleteRankPath"
    | "createRole"
    | "updateRole"
    | "deleteRole"
  >;
};

const grantIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const idParamsSchema = grantIdParamsSchema;

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

const rankPathPayloadSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(191),
  description: nullableText(280),
  sortOrder: z.number().int().min(0).max(100000).default(0)
}).strict();

const rolePayloadSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(191),
  permissions: z.array(z.string().trim().min(1).max(120)).max(80),
  rankPathId: z.string().trim().min(1).max(36).nullable().optional(),
  rankLevel: z.number().int().min(1).max(1000).nullable().optional(),
  displayLabel: nullableText(191),
  nextRoleId: z.string().trim().min(1).max(36).nullable().optional(),
  discordRoleId: nullableText(80),
  isOwnerRank: z.boolean().default(false),
  isSystem: z.boolean().default(false)
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
    | "createRankPath"
    | "updateRankPath"
    | "deleteRankPath"
    | "createRole"
    | "updateRole"
    | "deleteRole"
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

  server.post("/admin/moderators/rank-paths", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = rankPathPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      const result = await getService().createRankPath({
        authUserId: session.user.id,
        rankPath: {
          ...parsedBody.data,
          description: parsedBody.data.description ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "moderator_admin_rank_path_exists" ? 409 : result.reason === "moderator_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator rank path create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/moderators/rank-paths/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = idParamsSchema.safeParse(request.params);
    const parsedBody = rankPathPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      const result = await getService().updateRankPath({
        authUserId: session.user.id,
        rankPathId: parsedParams.data.id,
        rankPath: {
          ...parsedBody.data,
          description: parsedBody.data.description ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "moderator_admin_rank_path_exists" ? 409 : result.reason === "moderator_admin_rank_path_not_found" ? 404 : result.reason === "moderator_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator rank path update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.delete<{ Params: { id: string } }>("/admin/moderators/rank-paths/:id", async (request, reply) => {
    const session = await getSession(request, reply);
    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated" };
    }

    const parsedParams = idParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400);
      return { ok: false, reason: "moderator_admin_invalid_input" };
    }

    try {
      const result = await getService().deleteRankPath({
        authUserId: session.user.id,
        rankPathId: parsedParams.data.id
      });
      if (!result.ok) {
        reply.code(result.reason === "moderator_admin_rank_path_not_found" ? 404 : result.reason === "moderator_admin_rank_path_in_use" ? 409 : 403);
      }
      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator rank path delete failed.");
      reply.code(503);
      return { ok: false, reason: "moderator_admin_unavailable" };
    }
  });

  server.post("/admin/moderators/roles", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = rolePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      const result = await getService().createRole({
        authUserId: session.user.id,
        role: {
          ...parsedBody.data,
          rankPathId: parsedBody.data.rankPathId ?? null,
          rankLevel: parsedBody.data.rankLevel ?? null,
          displayLabel: parsedBody.data.displayLabel ?? null,
          nextRoleId: parsedBody.data.nextRoleId ?? null,
          discordRoleId: parsedBody.data.discordRoleId ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "moderator_admin_role_exists" ? 409 : result.reason === "moderator_admin_rank_path_not_found" || result.reason === "moderator_admin_role_not_found" ? 404 : result.reason === "moderator_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator role create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/moderators/roles/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = idParamsSchema.safeParse(request.params);
    const parsedBody = rolePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "moderator_admin_invalid_input"
      };
    }

    try {
      const result = await getService().updateRole({
        authUserId: session.user.id,
        roleId: parsedParams.data.id,
        role: {
          ...parsedBody.data,
          rankPathId: parsedBody.data.rankPathId ?? null,
          rankLevel: parsedBody.data.rankLevel ?? null,
          displayLabel: parsedBody.data.displayLabel ?? null,
          nextRoleId: parsedBody.data.nextRoleId ?? null,
          discordRoleId: parsedBody.data.discordRoleId ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "moderator_admin_role_exists" ? 409 : result.reason === "moderator_admin_rank_path_not_found" || result.reason === "moderator_admin_role_not_found" ? 404 : result.reason === "moderator_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator role update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "moderator_admin_unavailable"
      };
    }
  });

  server.delete<{ Params: { id: string } }>("/admin/moderators/roles/:id", async (request, reply) => {
    const session = await getSession(request, reply);
    if (!session) {
      return { ok: false, reason: reply.statusCode === 503 ? "moderator_admin_unavailable" : "not_authenticated" };
    }

    const parsedParams = idParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400);
      return { ok: false, reason: "moderator_admin_invalid_input" };
    }

    try {
      const result = await getService().deleteRole({
        authUserId: session.user.id,
        roleId: parsedParams.data.id
      });
      if (!result.ok) {
        reply.code(result.reason === "moderator_admin_role_not_found" ? 404 : result.reason === "moderator_admin_role_in_use" ? 409 : 403);
      }
      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Moderator role delete failed.");
      reply.code(503);
      return { ok: false, reason: "moderator_admin_unavailable" };
    }
  });
};
