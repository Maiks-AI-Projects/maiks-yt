import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createTwitchEventSubSubscriptionRepository } from "./twitch-eventsub-subscriptions-store.service.js";
import { TwitchEventSubSubscriptionControlService } from "./twitch-eventsub-subscriptions.service.js";

type TwitchEventSubSubscriptionAuthSession = {
  user: {
    id: string;
  };
} | null;

type TwitchEventSubSubscriptionRouteDependencies = {
  createService?: () => Pick<TwitchEventSubSubscriptionControlService, "ensureDefaults" | "listDefaults">;
  getAuthSession: (request: FastifyRequest) => Promise<TwitchEventSubSubscriptionAuthSession>;
  getDatabasePool: () => DatabasePool;
};

export const registerTwitchEventSubSubscriptionRoutes = (
  server: FastifyInstance,
  dependencies: TwitchEventSubSubscriptionRouteDependencies
): void => {
  const getService = (): Pick<TwitchEventSubSubscriptionControlService, "ensureDefaults" | "listDefaults"> =>
    dependencies.createService?.()
    ?? new TwitchEventSubSubscriptionControlService(
      createTwitchEventSubSubscriptionRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<TwitchEventSubSubscriptionAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Twitch EventSub subscription authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (
      service: Pick<TwitchEventSubSubscriptionControlService, "ensureDefaults" | "listDefaults">,
      authUserId: string
    ) => Promise<unknown>
  ): Promise<unknown> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "twitch_eventsub_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (typeof result === "object" && result !== null && "ok" in result && result.ok === false) {
        const reason = "reason" in result && typeof result.reason === "string" ? result.reason : "";
        reply.code(reason === "twitch_eventsub_forbidden" || reason === "twitch_eventsub_user_unlinked" ? 403 : 503);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Twitch EventSub subscription control failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "twitch_eventsub_unavailable"
      };
    }
  };

  server.get("/admin/provider-integrations/twitch-eventsub/subscriptions", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.listDefaults({ authUserId }))
  );

  server.post("/admin/provider-integrations/twitch-eventsub/default-subscriptions", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.ensureDefaults({ authUserId }))
  );
};
