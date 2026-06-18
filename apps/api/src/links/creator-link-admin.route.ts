import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { CreatorLinkAdminService } from "./creator-link-admin.service.js";
import { createCreatorLinkAdminRepository } from "./creator-link-admin-store.service.js";
import type { CreatorLinkAdminWriteResult } from "./creator-link-admin.types.js";

type CreatorLinkAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type CreatorLinkAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<CreatorLinkAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<CreatorLinkAdminService,
    | "listLinks"
    | "createLink"
    | "updateLink"
    | "reorderLinks"
  >;
};

const creatorLinkKeySchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/)
}).strict();

const creatorLinkPayloadSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  title: z.string().trim().min(1).max(191),
  description: z.string().trim().min(1).max(2_000),
  purpose: z.enum([
    "account",
    "accountability",
    "affiliate",
    "community",
    "context",
    "feed",
    "project",
    "social",
    "stream",
    "support",
    "tool"
  ]),
  icon: z.enum([
    "account",
    "accountability",
    "affiliate",
    "community",
    "context",
    "discord",
    "feed",
    "project",
    "social",
    "stream",
    "support",
    "twitch",
    "tool",
    "youtube"
  ]),
  availability: z.enum(["available", "unavailable"]),
  href: z.string().trim().max(1_024).nullable().optional(),
  availabilityNote: z.string().trim().max(191).nullable().optional(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0),
  isPublished: z.boolean()
}).strict();

const creatorLinkUpdatePayloadSchema = creatorLinkPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_creator_link_field_required"
);

const creatorLinkReorderPayloadSchema = z.object({
  orderedKeys: z.array(z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/)).min(1)
}).strict();

const sendAdminWriteResult = (
  result: CreatorLinkAdminWriteResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "creator_link_admin_user_unlinked"
    || result.reason === "creator_link_admin_forbidden"
    ? 403
    : result.reason === "creator_link_admin_invalid_input"
      ? 400
      : result.reason === "creator_link_key_conflict"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

export const registerCreatorLinkAdminRoutes = (
  server: FastifyInstance,
  dependencies: CreatorLinkAdminRouteDependencies
): void => {
  const getService = (): Pick<CreatorLinkAdminService,
    | "listLinks"
    | "createLink"
    | "updateLink"
    | "reorderLinks"
  > =>
    dependencies.createService?.()
    ?? new CreatorLinkAdminService(createCreatorLinkAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<CreatorLinkAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Creator link admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/links", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "creator_link_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listLinks({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Creator link admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "creator_link_admin_unavailable"
      };
    }
  });

  server.post("/admin/links", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "creator_link_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = creatorLinkPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    try {
      return sendAdminWriteResult(await getService().createLink({
        authUserId: session.user.id,
        link: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Creator link admin create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "creator_link_admin_unavailable"
      };
    }
  });

  server.patch("/admin/links/reorder", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "creator_link_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = creatorLinkReorderPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    try {
      return sendAdminWriteResult(await getService().reorderLinks({
        authUserId: session.user.id,
        reorder: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Creator link admin reorder failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "creator_link_admin_unavailable"
      };
    }
  });

  server.patch<{ Params: { key: string } }>("/admin/links/:key", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "creator_link_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = creatorLinkKeySchema.safeParse(request.params);
    const parsedBody = creatorLinkUpdatePayloadSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    try {
      return sendAdminWriteResult(await getService().updateLink({
        authUserId: session.user.id,
        key: parsedParams.data.key,
        link: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Creator link admin update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "creator_link_admin_unavailable"
      };
    }
  });
};
