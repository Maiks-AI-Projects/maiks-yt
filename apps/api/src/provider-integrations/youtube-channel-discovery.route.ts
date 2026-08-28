import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createYouTubeChannelDiscoveryRepository } from "./youtube-channel-discovery-store.service.js";
import { YouTubeChannelDiscoveryService } from "./youtube-channel-discovery.service.js";
import type { YouTubeChannelDiscoveryServiceResult } from "./youtube-channel-discovery.types.js";

type YouTubeChannelDiscoveryAuthSession = {
  user: {
    id: string;
  };
} | null;

type YouTubeChannelDiscoveryRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<YouTubeChannelDiscoveryAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<
    YouTubeChannelDiscoveryService,
    "discover" | "listSelection" | "discoverAndStore" | "selectLiveChatChannel"
  >;
};

const selectionBodySchema = z.object({
  channelRef: z.string().trim().min(1).max(128).nullable()
}).strict();

const isYouTubeChannelDiscoveryResult = (value: unknown): value is YouTubeChannelDiscoveryServiceResult =>
  typeof value === "object"
  && value !== null
  && "ok" in value
  && typeof (value as { ok?: unknown }).ok === "boolean";

const statusForReason = (reason: string): number => {
  switch (reason) {
    case "provider_integrations_forbidden":
    case "provider_integrations_user_unlinked":
      return 403;
    case "youtube_channel_credential_missing":
    case "youtube_channel_scope_missing":
      return 409;
    case "youtube_channel_not_found":
      return 404;
    case "youtube_channel_ref_unavailable":
    case "youtube_oauth_client_missing":
    case "youtube_oauth_redirect_missing":
    case "youtube_channel_discovery_failed":
      return 503;
    default:
      return 400;
  }
};

export const registerYouTubeChannelDiscoveryRoutes = (
  server: FastifyInstance,
  dependencies: YouTubeChannelDiscoveryRouteDependencies
): void => {
  const getService = (): Pick<
    YouTubeChannelDiscoveryService,
    "discover" | "listSelection" | "discoverAndStore" | "selectLiveChatChannel"
  > =>
    dependencies.createService?.()
    ?? new YouTubeChannelDiscoveryService(
      createYouTubeChannelDiscoveryRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<YouTubeChannelDiscoveryAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube channel discovery authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (
      service: Pick<
        YouTubeChannelDiscoveryService,
        "discover" | "listSelection" | "discoverAndStore" | "selectLiveChatChannel"
      >,
      authUserId: string
    ) => Promise<YouTubeChannelDiscoveryServiceResult>
  ): Promise<YouTubeChannelDiscoveryServiceResult | { ok: false; reason: string }> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "youtube_channel_discovery_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (isYouTubeChannelDiscoveryResult(result) && !result.ok) {
        reply.code(statusForReason(result.reason));
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube channel discovery request failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "youtube_channel_discovery_failed"
      };
    }
  };

  server.get("/admin/provider-integrations/youtube/channels", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.discover({ authUserId }))
  );

  server.get("/admin/provider-integrations/youtube/channel-selection", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.listSelection({ authUserId }))
  );

  server.post("/admin/provider-integrations/youtube/channel-selection/discover", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.discoverAndStore({ authUserId }))
  );

  server.put("/admin/provider-integrations/youtube/channel-selection", async (request, reply) => {
    const parsedBody = selectionBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "youtube_channel_invalid_input"
      };
    }

    return runAuthenticated(request, reply, (service, authUserId) => service.selectLiveChatChannel({
      authUserId,
      channelRef: parsedBody.data.channelRef
    }));
  });
};
