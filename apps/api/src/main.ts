import { createRuntimeConfig } from "@maiks-yt/config";
import { createDatabasePool, type DatabasePool } from "@maiks-yt/database";
import type { RealtimeEvent } from "@maiks-yt/events";
import Fastify from "fastify";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });
let databasePool: DatabasePool | undefined;

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

server.post<{ Body: RealtimeEvent }>("/events/test", async (request) => ({
  accepted: true,
  eventType: request.body.type
}));

const start = async (): Promise<void> => {
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
