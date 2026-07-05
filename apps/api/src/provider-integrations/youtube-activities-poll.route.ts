import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { ProviderEventIntakeLogService } from "./provider-event-intake-log.service.js";
import { createYouTubeActivitiesPollRepository } from "./youtube-activities-poll-store.service.js";
import { YouTubeActivitiesPollControlService } from "./youtube-activities-poll.service.js";

type YouTubeActivitiesPollAuthSession = {
  user: {
    id: string;
  };
} | null;

type YouTubeActivitiesPollRouteDependencies = {
  createService?: () => Pick<YouTubeActivitiesPollControlService, "pollRecent">;
  getAuthSession: (request: FastifyRequest) => Promise<YouTubeActivitiesPollAuthSession>;
  getDatabasePool: () => DatabasePool;
  intakeLogService: Pick<ProviderEventIntakeLogService, "recordProviderEvent">;
};

const getStatusCodeForReason = (reason: string): 403 | 409 | 503 => {
  if (reason === "youtube_activities_forbidden" || reason === "youtube_activities_user_unlinked") {
    return 403;
  }

  if (reason === "youtube_activities_context_missing") {
    return 409;
  }

  return 503;
};

export const registerYouTubeActivitiesPollRoutes = (
  server: FastifyInstance,
  dependencies: YouTubeActivitiesPollRouteDependencies
): void => {
  const getService = (): Pick<YouTubeActivitiesPollControlService, "pollRecent"> =>
    dependencies.createService?.()
    ?? new YouTubeActivitiesPollControlService(
      createYouTubeActivitiesPollRepository(dependencies.getDatabasePool()),
      dependencies.intakeLogService
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<YouTubeActivitiesPollAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube activities authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.post("/admin/provider-integrations/youtube-activities/poll", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "youtube_activities_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().pollRecent({
        authUserId: session.user.id
      });

      if (!result.ok) {
        reply.code(getStatusCodeForReason(result.reason));
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube activities poll failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "youtube_activities_unavailable"
      };
    }
  });
};
