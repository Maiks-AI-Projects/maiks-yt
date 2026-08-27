import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  DevOwnerTokenService,
  getDevOwnerTokenMintSecret
} from "./dev-owner-token.service.js";
import { createDevOwnerTokenRepository } from "./dev-owner-token-store.service.js";
import type { DevOwnerTokenMintRequest } from "./dev-owner-token.types.js";

type DevOwnerTokenRouteDependencies = {
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<DevOwnerTokenService, "mint">;
};

const mintPayloadSchema = z.object({
  label: z.string().trim().min(1).max(191).optional(),
  path: z.string().trim().min(1).max(512).optional(),
  ttlMinutes: z.number().int().min(1).max(15).optional()
}).strict().optional();

const getRequestSecret = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;

  if (authorizationValue?.startsWith("Bearer ")) {
    return authorizationValue.slice("Bearer ".length).trim() || null;
  }

  const header = request.headers["x-dev-testing-secret"];
  const headerValue = Array.isArray(header) ? header[0] : header;

  return headerValue?.trim() || null;
};

export const registerDevOwnerTokenRoutes = (
  server: FastifyInstance,
  dependencies: DevOwnerTokenRouteDependencies
): void => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const getService = (): Pick<DevOwnerTokenService, "mint"> =>
    dependencies.createService?.()
    ?? new DevOwnerTokenService(
      createDevOwnerTokenRepository(dependencies.getDatabasePool())
    );

  server.post("/dev/testing/owner-token", async (request, reply) => {
    const expectedSecret = getDevOwnerTokenMintSecret(process.env);

    if (!expectedSecret) {
      reply.code(503);
      return {
        ok: false,
        reason: "dev_owner_token_secret_missing"
      };
    }

    if (getRequestSecret(request) !== expectedSecret) {
      reply.code(403);
      return {
        ok: false,
        reason: "dev_owner_token_forbidden"
      };
    }

    const parsedBody = mintPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "dev_owner_token_invalid_input"
      };
    }

    try {
      const body = parsedBody.data;
      const mintInput: DevOwnerTokenMintRequest | undefined = body
        ? {
          ...(body.label === undefined ? {} : { label: body.label }),
          ...(body.path === undefined ? {} : { path: body.path }),
          ...(body.ttlMinutes === undefined ? {} : { ttlMinutes: body.ttlMinutes })
        }
        : undefined;
      const result = await getService().mint(mintInput);

      if (!result.ok) {
        reply.code(result.reason === "dev_owner_token_invalid_input" ? 400 : 503);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Dev owner token mint failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "dev_owner_token_disabled"
      };
    }
  });
};
