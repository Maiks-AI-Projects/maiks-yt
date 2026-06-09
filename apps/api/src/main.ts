import { createHash } from "node:crypto";

import { createRuntimeConfig } from "@maiks-yt/config";
import { createDatabasePool, type DatabasePool } from "@maiks-yt/database";
import { canUseUrlAccessToken, type UrlAccessSurface } from "@maiks-yt/domain/security";
import type { RealtimeEvent } from "@maiks-yt/events";
import fastifyCors from "@fastify/cors";
import { fromNodeHeaders } from "better-auth/node";
import Fastify from "fastify";
import { z } from "zod";

import { auth, configuredAuthProviderIds, getTrustedOrigins } from "./auth/better-auth.service.js";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });
let databasePool: DatabasePool | undefined;

await server.register(fastifyCors, {
  origin: getTrustedOrigins(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
});

const urlAccessTokenRequestSchema = z.object({
  token: z.string().min(24),
  surface: z.enum(["overlay", "control-panel", "admin", "api"]),
  scope: z.string().min(1)
});

const hashToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

const parseJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getDatabasePool = (): DatabasePool => {
  databasePool ??= createDatabasePool();
  return databasePool;
};

server.get("/health", async () => ({
  ok: true,
  surface: config.surface
}));

server.get("/health/database", async (_request, reply) => {
  try {
    const pool = getDatabasePool();
    const [rows] = await pool.query("SELECT DATABASE() AS databaseName");
    const firstRow = Array.isArray(rows)
      ? rows[0] as { databaseName?: string | null } | undefined
      : undefined;

    return {
      ok: true,
      surface: config.surface,
      database: firstRow?.databaseName ?? null
    };
  } catch (error) {
    server.log.warn({ err: error }, "Database health check failed.");
    reply.code(503);

    return {
      ok: false,
      surface: config.surface,
      reason: "database_unavailable"
    };
  }
});

server.get("/identity/dev/creator", async (_request, reply) => {
  try {
    const pool = getDatabasePool();
    const creatorUserId = "00000000-0000-4000-8000-000000000001";
    const [userRows] = await pool.execute(
      "SELECT id, display_name AS displayName, profile_visibility AS profileVisibility FROM users WHERE id = ? AND deleted_at IS NULL",
      [creatorUserId]
    );
    const user = Array.isArray(userRows)
      ? userRows[0] as { id: string; displayName: string; profileVisibility: string } | undefined
      : undefined;

    if (!user) {
      reply.code(404);
      return {
        ok: false,
        reason: "creator_not_seeded"
      };
    }

    const [linkedAccountRows] = await pool.execute(
      "SELECT id, provider, display_name AS displayName, allow_login AS allowLogin, capabilities FROM linked_accounts WHERE user_id = ? ORDER BY provider",
      [creatorUserId]
    );
    const [roleRows] = await pool.execute(
      "SELECT roles.key, roles.name, roles.permissions FROM user_roles INNER JOIN roles ON roles.id = user_roles.role_id WHERE user_roles.user_id = ? ORDER BY roles.key",
      [creatorUserId]
    );

    return {
      ok: true,
      user,
      linkedAccounts: Array.isArray(linkedAccountRows)
        ? linkedAccountRows.map((account) => {
          const typedAccount = account as { id: string; provider: string; displayName: string; allowLogin: number | boolean; capabilities: unknown };

          return {
            id: typedAccount.id,
            provider: typedAccount.provider,
            displayName: typedAccount.displayName,
            allowLogin: Boolean(typedAccount.allowLogin),
            capabilities: parseJsonArray(typedAccount.capabilities)
          };
        })
        : [],
      roles: Array.isArray(roleRows)
        ? roleRows.map((role) => {
          const typedRole = role as { key: string; name: string; permissions: unknown };

          return {
            key: typedRole.key,
            name: typedRole.name,
            permissions: parseJsonArray(typedRole.permissions)
          };
        })
        : []
    };
  } catch (error) {
    server.log.warn({ err: error }, "Dev identity snapshot failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "identity_unavailable"
    };
  }
});

server.get("/auth/dev/status", async () => ({
  ok: true,
  authProvider: "better-auth",
  configuredProviders: configuredAuthProviderIds,
  domainIdentityModel: "maiks-linked-accounts"
}));

server.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const forwardedProto = request.headers["x-forwarded-proto"];
      const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
      const requestUrl = new URL(request.url, `${protocol ?? "http"}://${request.headers.host}`);
      const body = request.method === "GET" || request.method === "HEAD"
        ? undefined
        : JSON.stringify(request.body ?? {});
      const authRequest = new Request(requestUrl.toString(), {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(body ? { body } : {})
      });
      const authResponse = await auth.handler(authRequest);

      reply.status(authResponse.status);
      authResponse.headers.forEach((value, key) => reply.header(key, value));

      return reply.send(authResponse.body ? await authResponse.text() : null);
    } catch (error) {
      server.log.error({ err: error }, "Authentication route failed.");
      reply.code(500);

      return {
        ok: false,
        reason: "auth_route_failed"
      };
    }
  }
});

server.post("/access/url-token/validate", async (request, reply) => {
  const parsedRequest = urlAccessTokenRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      valid: false,
      reason: "invalid_request"
    };
  }

  try {
    const pool = getDatabasePool();
    const tokenHash = hashToken(parsedRequest.data.token);
    const [tokenRows] = await pool.execute(
      "SELECT id, surface, scopes, requires_login AS requiresLogin, expires_at AS expiresAt, revoked_at AS revokedAt FROM url_access_tokens WHERE token_hash = ? LIMIT 1",
      [tokenHash]
    );
    const row = Array.isArray(tokenRows)
      ? tokenRows[0] as {
        id: string;
        surface: UrlAccessSurface;
        scopes: unknown;
        requiresLogin: number | boolean;
        expiresAt?: Date | null;
        revokedAt?: Date | null;
      } | undefined
      : undefined;

    if (!row) {
      return {
        ok: true,
        valid: false,
        reason: "token_not_found"
      };
    }

    const tokenRecord = {
      id: row.id,
      surface: row.surface,
      scopes: parseJsonArray(row.scopes).filter((scope): scope is string => typeof scope === "string"),
      requiresLogin: Boolean(row.requiresLogin)
    };
    const valid = canUseUrlAccessToken({
      ...tokenRecord,
      ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
      ...(row.revokedAt ? { revokedAt: row.revokedAt } : {})
    }, {
      surface: parsedRequest.data.surface,
      scope: parsedRequest.data.scope,
      now: new Date()
    });

    if (valid) {
      await pool.execute("UPDATE url_access_tokens SET last_used_at = NOW() WHERE id = ?", [row.id]);
    }

    return {
      ok: true,
      valid,
      requiresLogin: Boolean(row.requiresLogin)
    };
  } catch (error) {
    server.log.warn({ err: error }, "URL access token validation failed.");
    reply.code(503);

    return {
      ok: false,
      valid: false,
      reason: "token_validation_unavailable"
    };
  }
});

server.post<{ Body: RealtimeEvent }>("/events/test", async (request) => ({
  accepted: true,
  eventType: request.body.type
}));

const start = async (): Promise<void> => {
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
