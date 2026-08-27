import type { FastifyInstance } from "fastify";

export const registerRetiredAccountAuthRoutes = (server: FastifyInstance): void => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  server.route({
    method: ["GET", "POST"],
    url: "/auth/dev/status",
    handler: (_request, reply) => {
      reply.callNotFound();
    }
  });
};
