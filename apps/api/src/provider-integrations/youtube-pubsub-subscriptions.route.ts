import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createYouTubePubSubSubscriptionRepository } from "./youtube-pubsub-subscriptions-store.service.js";
import { YouTubePubSubSubscriptionControlService } from "./youtube-pubsub-subscriptions.service.js";

type YouTubePubSubSubscriptionAuthSession = {
  user: {
    id: string;
  };
} | null;

type YouTubePubSubSubscriptionRouteDependencies = {
  createService?: () => Pick<YouTubePubSubSubscriptionControlService, "getStatus" | "subscribe" | "unsubscribe">;
  getAuthSession: (request: FastifyRequest) => Promise<YouTubePubSubSubscriptionAuthSession>;
  getDatabasePool: () => DatabasePool;
};

const isForbiddenReason = (reason: string): boolean =>
  reason === "youtube_pubsub_forbidden" || reason === "youtube_pubsub_user_unlinked";

const getStatusCodeForReason = (reason: string): 403 | 409 | 503 =>
  isForbiddenReason(reason)
    ? 403
    : reason === "youtube_pubsub_channel_missing"
      ? 409
      : 503;

export const registerYouTubePubSubSubscriptionRoutes = (
  server: FastifyInstance,
  dependencies: YouTubePubSubSubscriptionRouteDependencies
): void => {
  const getService = (): Pick<YouTubePubSubSubscriptionControlService, "getStatus" | "subscribe" | "unsubscribe"> =>
    dependencies.createService?.()
    ?? new YouTubePubSubSubscriptionControlService(
      createYouTubePubSubSubscriptionRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<YouTubePubSubSubscriptionAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube PubSub subscription authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (
      service: Pick<YouTubePubSubSubscriptionControlService, "getStatus" | "subscribe" | "unsubscribe">,
      authUserId: string
    ) => Promise<unknown>
  ): Promise<unknown> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "youtube_pubsub_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (typeof result === "object" && result !== null && "ok" in result && result.ok === false) {
        const reason = "reason" in result && typeof result.reason === "string" ? result.reason : "youtube_pubsub_unavailable";
        reply.code(getStatusCodeForReason(reason));
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube PubSub subscription control failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "youtube_pubsub_unavailable"
      };
    }
  };

  server.get("/admin/provider-integrations/youtube-pubsub/subscription", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.getStatus({ authUserId }))
  );

  server.post("/admin/provider-integrations/youtube-pubsub/subscribe", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.subscribe({ authUserId }))
  );

  server.post("/admin/provider-integrations/youtube-pubsub/unsubscribe", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.unsubscribe({ authUserId }))
  );
};
