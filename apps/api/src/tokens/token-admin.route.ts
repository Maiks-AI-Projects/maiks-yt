import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { UrlAccessTokenAdminService } from "./token-admin.service.js";
import { createUrlAccessTokenAdminRepository } from "./token-admin-store.service.js";
import type {
  UrlAccessTokenAdminMutationResult,
  UrlAccessTokenAdminRevokeResult
} from "./token-admin.types.js";

type UrlAccessTokenAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type UrlAccessTokenAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<UrlAccessTokenAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<UrlAccessTokenAdminService,
    | "listTokens"
    | "createToken"
    | "rotateToken"
    | "revokeToken"
  >;
};

const tokenIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
}).strict();

const tokenCreatePayloadSchema = z.object({
  target: z.enum(["overlay", "control-panel"]),
  label: z.string().trim().min(1).max(191)
}).strict();

const sendMutationResult = (
  result: UrlAccessTokenAdminMutationResult | UrlAccessTokenAdminRevokeResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "url_token_admin_user_unlinked"
    || result.reason === "url_token_admin_forbidden"
    ? 403
    : result.reason === "url_token_admin_invalid_input"
      ? 400
      : result.reason === "url_token_unsupported_target"
        ? 409
        : 404;

  reply.code(statusCode);
  return result;
};

export const registerUrlAccessTokenAdminRoutes = (
  server: FastifyInstance,
  dependencies: UrlAccessTokenAdminRouteDependencies
): void => {
  const getService = (): Pick<UrlAccessTokenAdminService,
    | "listTokens"
    | "createToken"
    | "rotateToken"
    | "revokeToken"
  > =>
    dependencies.createService?.()
    ?? new UrlAccessTokenAdminService(createUrlAccessTokenAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<UrlAccessTokenAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "URL access token admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/tokens", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "url_token_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listTokens({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "URL access token admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "url_token_admin_unavailable"
      };
    }
  });

  server.post("/admin/tokens", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "url_token_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = tokenCreatePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "url_token_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().createToken({
        authUserId: session.user.id,
        ...parsedBody.data
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "URL access token admin create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "url_token_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/tokens/:id/rotate", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "url_token_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = tokenIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "url_token_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().rotateToken({
        authUserId: session.user.id,
        id: parsedParams.data.id
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "URL access token admin rotate failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "url_token_admin_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/admin/tokens/:id/revoke", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "url_token_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = tokenIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "url_token_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(await getService().revokeToken({
        authUserId: session.user.id,
        id: parsedParams.data.id
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "URL access token admin revoke failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "url_token_admin_unavailable"
      };
    }
  });
};
