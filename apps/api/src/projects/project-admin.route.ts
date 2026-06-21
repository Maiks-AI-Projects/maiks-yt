import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ProjectAdminService } from "./project-admin.service.js";
import { createProjectAdminRepository } from "./project-admin-store.service.js";
import type { ProjectAdminWriteResult } from "./project-admin.types.js";

type ProjectAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type ProjectAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ProjectAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ProjectAdminService,
    | "listProjects"
    | "createProject"
    | "updateProject"
    | "createMilestone"
    | "updateMilestone"
    | "reorderMilestones"
    | "createItem"
    | "updateItem"
    | "reorderItems"
    | "createUpdate"
    | "updateUpdate"
  >;
};

const projectIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const milestoneParamsSchema = z.object({
  id: z.string().trim().min(1).max(191),
  milestoneId: z.string().trim().min(1).max(191)
}).strict();

const itemParamsSchema = z.object({
  id: z.string().trim().min(1).max(191),
  itemId: z.string().trim().min(1).max(191)
}).strict();

const updateParamsSchema = z.object({
  id: z.string().trim().min(1).max(191),
  updateId: z.string().trim().min(1).max(191)
}).strict();

const projectPayloadSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,190}$/),
  title: z.string().trim().min(1).max(191),
  summary: z.string().trim().max(2_000).nullable().optional(),
  type: z.enum([
    "one-time-purchase",
    "multi-item-build",
    "ongoing-cost",
    "subscription",
    "stream-work-project",
    "milestone-only"
  ]),
  category: z.enum([
    "personal",
    "family",
    "content-improvement",
    "stream-infrastructure",
    "software-project",
    "hobby",
    "community",
    "health-accessibility",
    "experiment",
    "ongoing-cost"
  ]),
  status: z.enum(["planning", "active", "completed", "mothballed", "cancelled"]),
  isPublic: z.boolean()
}).strict();

const projectUpdatePayloadSchema = projectPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_project_field_required"
);

const milestonePayloadSchema = z.object({
  title: z.string().trim().min(1).max(191),
  description: z.string().trim().max(2_000).nullable().optional(),
  status: z.enum(["planned", "active", "completed", "cancelled"]),
  sortOrder: z.number().int().min(0)
}).strict();

const milestoneUpdatePayloadSchema = milestonePayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_milestone_field_required"
);

const itemPayloadSchema = z.object({
  parentItemId: z.string().trim().min(1).max(191).nullable().optional(),
  title: z.string().trim().min(1).max(191),
  description: z.string().trim().max(2_000).nullable().optional(),
  kind: z.enum(["product", "service", "subscription", "task", "wishlist", "other"]),
  status: z.enum(["planned", "active", "acquired", "completed", "removed"]),
  quantity: z.number().int().min(1).max(10_000),
  sortOrder: z.number().int().min(0)
}).strict();

const itemUpdatePayloadSchema = itemPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_item_field_required"
);

const reorderPayloadSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1).max(191)).min(1)
}).strict();

const updatePayloadSchema = z.object({
  title: z.string().trim().min(1).max(191),
  summary: z.string().trim().max(280).nullable().optional(),
  body: z.string().trim().min(1).max(10_000),
  status: z.enum(["draft", "published"]),
  isVisible: z.boolean(),
  publishedAt: z.string().datetime().nullable().optional(),
  isPinned: z.boolean(),
  sortOrder: z.number().int().min(0)
}).strict();

const updateUpdatePayloadSchema = updatePayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_update_field_required"
);

const sendAdminMutationResult = (
  result: ProjectAdminWriteResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "project_admin_user_unlinked"
    || result.reason === "project_admin_forbidden"
    ? 403
    : result.reason === "project_admin_invalid_input"
      ? 400
      : result.reason === "project_slug_conflict"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

export const registerProjectAdminRoutes = (
  server: FastifyInstance,
  dependencies: ProjectAdminRouteDependencies
): void => {
  const getService = (): Pick<ProjectAdminService,
    | "listProjects"
    | "createProject"
    | "updateProject"
    | "createMilestone"
    | "updateMilestone"
    | "reorderMilestones"
    | "createItem"
    | "updateItem"
    | "reorderItems"
    | "createUpdate"
    | "updateUpdate"
  > =>
    dependencies.createService?.()
    ?? new ProjectAdminService(createProjectAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<ProjectAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Project admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/projects", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listProjects({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Project admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.post("/admin/projects", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = projectPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().createProject({
        authUserId: session.user.id,
        project: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/projects/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = projectUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().updateProject({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        project: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/projects/:id/milestones", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = milestonePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().createMilestone({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        milestone: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin milestone create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string; milestoneId: string } }>("/admin/projects/:id/milestones/:milestoneId", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = milestoneParamsSchema.safeParse(request.params);
    const parsedBody = milestoneUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().updateMilestone({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        milestoneId: parsedParams.data.milestoneId,
        milestone: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin milestone update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/projects/:id/milestones/reorder", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = reorderPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().reorderMilestones({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        reorder: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin milestone reorder failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/projects/:id/items", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = itemPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().createItem({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        item: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin item create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string; itemId: string } }>("/admin/projects/:id/items/:itemId", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = itemParamsSchema.safeParse(request.params);
    const parsedBody = itemUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().updateItem({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        itemId: parsedParams.data.itemId,
        item: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin item update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/projects/:id/items/reorder", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = reorderPayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().reorderItems({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        reorder: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin item reorder failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/projects/:id/updates", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = updatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().createUpdate({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        update: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin update create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string; updateId: string } }>("/admin/projects/:id/updates/:updateId", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "project_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = updateParamsSchema.safeParse(request.params);
    const parsedBody = updateUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().updateUpdate({
        authUserId: session.user.id,
        projectId: parsedParams.data.id,
        updateId: parsedParams.data.updateId,
        update: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Project admin update edit failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "project_admin_unavailable"
      };
    }
  });
};
