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
    server.log.warn({ error }, "Database health check failed.");
    reply.code(503);

    return {
      ok: false,
      surface: config.surface,
      reason: "database_unavailable"
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
