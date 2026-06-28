import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ContentPageService } from "./content-page.service.js";
import { createContentPageRepository } from "./content-page-store.service.js";
import type {
  ContentPageAdminMutationResult,
  ContentPagePreviewResult,
  PublicContentPageResult
} from "./content-page.types.js";

type ContentPageAuthSession = {
  user: {
    id: string;
  };
} | null;

type ContentPageRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ContentPageAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ContentPageService,
    | "listPages"
    | "createPage"
    | "updatePage"
    | "publishPage"
    | "unpublishPage"
    | "previewPage"
    | "getPublicPageByPath"
  >;
};

const pageIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const publicPageQuerySchema = z.object({
  path: z.string().trim().min(1).max(191)
}).strict();

const pagePayloadSchema = z.object({
  title: z.string().trim().min(1).max(191),
  path: z.string().trim().min(1).max(191),
  seoTitle: z.string().trim().max(191).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  body: z.string().trim().min(1).max(50_000)
}).strict();

const pageUpdatePayloadSchema = pagePayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_page_field_required"
);

const sendAdminMutationResult = (
  result: ContentPageAdminMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "content_page_admin_user_unlinked"
    || result.reason === "content_page_admin_forbidden"
    ? 403
    : result.reason === "content_page_invalid_input"
      || result.reason === "content_page_reserved_path"
      ? 400
      : result.reason === "content_page_path_conflict"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

const sendPreviewResult = (
  result: ContentPagePreviewResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  reply.code(result.reason === "content_page_not_found" ? 404 : 403);
  return result;
};

const sendPublicPageResult = (
  result: PublicContentPageResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  reply.code(404);
  return result;
};

export const registerContentPageRoutes = (
  server: FastifyInstance,
  dependencies: ContentPageRouteDependencies
): void => {
  const getService = (): Pick<ContentPageService,
    | "listPages"
    | "createPage"
    | "updatePage"
    | "publishPage"
    | "unpublishPage"
    | "previewPage"
    | "getPublicPageByPath"
  > =>
    dependencies.createService?.()
    ?? new ContentPageService(createContentPageRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<ContentPageAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/pages", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "content_page_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listPages({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_admin_unavailable"
      };
    }
  });

  server.post("/admin/pages", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "content_page_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = pagePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().createPage({
        authUserId: session.user.id,
        page: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/pages/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "content_page_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = pageIdParamsSchema.safeParse(request.params);
    const parsedBody = pageUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().updatePage({
        authUserId: session.user.id,
        pageId: parsedParams.data.id,
        page: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_admin_unavailable"
      };
    }
  });

  server.get<{ Params: { id: string } }>("/admin/pages/:id/preview", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "content_page_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = pageIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    try {
      return sendPreviewResult(await getService().previewPage({
        authUserId: session.user.id,
        pageId: parsedParams.data.id
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin preview failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/pages/:id/publish", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "content_page_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = pageIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().publishPage({
        authUserId: session.user.id,
        pageId: parsedParams.data.id
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin publish failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/pages/:id/unpublish", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "content_page_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = pageIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    try {
      return sendAdminMutationResult(await getService().unpublishPage({
        authUserId: session.user.id,
        pageId: parsedParams.data.id
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Content page admin unpublish failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_admin_unavailable"
      };
    }
  });

  server.get("/pages/public", async (request, reply) => {
    const parsedQuery = publicPageQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(404);
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    try {
      return sendPublicPageResult(await getService().getPublicPageByPath({
        path: parsedQuery.data.path
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Content page public read failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "content_page_unavailable"
      };
    }
  });
};
