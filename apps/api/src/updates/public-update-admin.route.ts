import type { DatabasePool } from "@maiks-yt/database";
import { publicUpdateKinds } from "@maiks-yt/domain/updates";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { PublicUpdateAdminService } from "./public-update-admin.service.js";
import { createPublicUpdateAdminRepository } from "./public-update-admin-store.service.js";
import type {
  PublicUpdateAdminMutationResult,
  PublicUpdateAdminPreviewResult
} from "./public-update-admin.types.js";

type PublicUpdateAdminAuthSession = { user: { id: string } } | null;

type PublicUpdateAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<PublicUpdateAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<PublicUpdateAdminService,
    | "listUpdates"
    | "createUpdate"
    | "updateUpdate"
    | "publishUpdate"
    | "unpublishUpdate"
    | "previewUpdate"
  >;
};

const updateIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(36)
}).strict();

const updatePayloadShape = {
  slug: z.string().trim().min(1).max(191),
  title: z.string().trim().min(1).max(191),
  summary: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50_000),
  kind: z.enum(publicUpdateKinds),
  isPinned: z.boolean()
} as const;

const updatePayloadSchema = z.object({
  ...updatePayloadShape,
  isPinned: updatePayloadShape.isPinned.default(false)
}).strict();

const updatePatchPayloadSchema = z.object(updatePayloadShape).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "at_least_one_update_field_required"
);

const sendMutationResult = (
  result: PublicUpdateAdminMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "public_update_admin_user_unlinked"
    || result.reason === "public_update_admin_forbidden"
    ? 403
    : result.reason === "public_update_invalid_input"
      ? 400
      : result.reason === "public_update_slug_conflict"
        || result.reason === "public_update_example_immutable"
        || result.reason === "public_update_must_be_draft"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

const sendPreviewResult = (
  result: PublicUpdateAdminPreviewResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  reply.code(
    result.reason === "public_update_admin_user_unlinked"
      || result.reason === "public_update_admin_forbidden"
      ? 403
      : result.reason === "public_update_invalid_input"
        ? 400
        : 404
  );
  return result;
};

export const registerPublicUpdateAdminRoutes = (
  server: FastifyInstance,
  dependencies: PublicUpdateAdminRouteDependencies
): void => {
  const getService = (): Pick<PublicUpdateAdminService,
    | "listUpdates"
    | "createUpdate"
    | "updateUpdate"
    | "publishUpdate"
    | "unpublishUpdate"
    | "previewUpdate"
  > => dependencies.createService?.()
    ?? new PublicUpdateAdminService(
      createPublicUpdateAdminRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<PublicUpdateAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Public update admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const unavailableResult = (reply: FastifyReply) => ({
    ok: false as const,
    reason: reply.statusCode === 503 ? "public_update_admin_unavailable" : "not_authenticated"
  });

  server.get("/admin/updates", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return unavailableResult(reply);
    }

    try {
      const result = await getService().listUpdates({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Public update admin list failed.");
      reply.code(503);
      return { ok: false, reason: "public_update_admin_unavailable" };
    }
  });

  server.post("/admin/updates", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return unavailableResult(reply);
    }

    const parsedBody = updatePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "public_update_invalid_input" };
    }

    try {
      return sendMutationResult(await getService().createUpdate({
        authUserId: session.user.id,
        update: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Public update admin create failed.");
      reply.code(503);
      return { ok: false, reason: "public_update_admin_unavailable" };
    }
  });

  server.patch<{ Params: { id: string } }>("/admin/updates/:id", async (request, reply) => {
    const session = await getSession(request, reply);
    const parsedParams = updateIdParamsSchema.safeParse(request.params);
    const parsedBody = updatePatchPayloadSchema.safeParse(request.body);

    if (!session) {
      return unavailableResult(reply);
    }

    if (!parsedParams.success || !parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "public_update_invalid_input" };
    }

    try {
      return sendMutationResult(await getService().updateUpdate({
        authUserId: session.user.id,
        updateId: parsedParams.data.id,
        update: parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Public update admin edit failed.");
      reply.code(503);
      return { ok: false, reason: "public_update_admin_unavailable" };
    }
  });

  const registerUpdateAction = (
    action: "publish" | "unpublish",
    run: (service: Pick<PublicUpdateAdminService, "publishUpdate" | "unpublishUpdate">, input: {
      authUserId: string;
      updateId: string;
    }) => Promise<PublicUpdateAdminMutationResult>
  ): void => {
    server.post<{ Params: { id: string } }>(`/admin/updates/:id/${action}`, async (request, reply) => {
      const session = await getSession(request, reply);
      const parsedParams = updateIdParamsSchema.safeParse(request.params);

      if (!session) {
        return unavailableResult(reply);
      }

      if (!parsedParams.success) {
        reply.code(400);
        return { ok: false, reason: "public_update_invalid_input" };
      }

      try {
        return sendMutationResult(await run(getService(), {
          authUserId: session.user.id,
          updateId: parsedParams.data.id
        }), reply);
      } catch (error) {
        server.log.warn({ err: error, action }, "Public update admin state change failed.");
        reply.code(503);
        return { ok: false, reason: "public_update_admin_unavailable" };
      }
    });
  };

  registerUpdateAction("publish", async (service, input) => await service.publishUpdate(input));
  registerUpdateAction("unpublish", async (service, input) => await service.unpublishUpdate(input));

  server.get<{ Params: { id: string } }>("/admin/updates/:id/preview", async (request, reply) => {
    const session = await getSession(request, reply);
    const parsedParams = updateIdParamsSchema.safeParse(request.params);

    if (!session) {
      return unavailableResult(reply);
    }

    if (!parsedParams.success) {
      reply.code(400);
      return { ok: false, reason: "public_update_invalid_input" };
    }

    try {
      return sendPreviewResult(await getService().previewUpdate({
        authUserId: session.user.id,
        updateId: parsedParams.data.id
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Public update admin preview failed.");
      reply.code(503);
      return { ok: false, reason: "public_update_admin_unavailable" };
    }
  });
};
