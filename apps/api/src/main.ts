import { createRuntimeConfig } from "@maiks-yt/config";
import type { RealtimeEvent } from "@maiks-yt/events";
import Fastify from "fastify";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });

server.get("/health", async () => ({
  ok: true,
  surface: config.surface
}));

server.post<{ Body: RealtimeEvent }>("/events/test", async (request) => ({
  accepted: true,
  eventType: request.body.type
}));

const start = async (): Promise<void> => {
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
