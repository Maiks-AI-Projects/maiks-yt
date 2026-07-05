import {
  projectYouTubePubSubFeed,
  resolveYouTubePubSubVerification
} from "@maiks-yt/integrations";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { ProviderEventIntakeLogService } from "./provider-event-intake-log.service.js";

type YouTubePubSubWebhookRouteDependencies = {
  intakeLogService: Pick<ProviderEventIntakeLogService, "recordProviderEvent">;
};

const getQueryValue = (request: FastifyRequest, key: string): string | null => {
  const query = request.query && typeof request.query === "object"
    ? request.query as Record<string, unknown>
    : {};
  const directValue = query[key];
  const value = directValue ?? (key.startsWith("hub.") && query.hub && typeof query.hub === "object" && !Array.isArray(query.hub)
    ? (query.hub as Record<string, unknown>)[key.slice("hub.".length)]
    : undefined);
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === "string" && firstValue.trim().length > 0 ? firstValue.trim() : null;
};

export const registerYouTubePubSubWebhookRoutes = (
  server: FastifyInstance,
  dependencies: YouTubePubSubWebhookRouteDependencies
): void => {
  server.addContentTypeParser(
    ["application/atom+xml", "application/xml", "text/xml"],
    {
      parseAs: "buffer"
    },
    (_request, payload, done) => {
      done(null, payload);
    }
  );

  server.get("/provider-webhooks/youtube/pubsub", async (request, reply) => {
    const verification = resolveYouTubePubSubVerification({
      challenge: getQueryValue(request, "hub.challenge"),
      mode: getQueryValue(request, "hub.mode"),
      topic: getQueryValue(request, "hub.topic")
    });

    if (!verification.ok) {
      reply.code(400);
      return {
        ok: false,
        reason: `youtube_pubsub_${verification.reason}`
      };
    }

    reply.header("content-type", "text/plain; charset=utf-8");
    return verification.challenge;
  });

  server.post(
    "/provider-webhooks/youtube/pubsub",
    {
      bodyLimit: 1_048_576
    },
    async (request, reply) => {
      const rawBody = Buffer.isBuffer(request.body) || typeof request.body === "string" ? request.body : null;

      if (!rawBody) {
        reply.code(400);
        return {
          ok: false,
          reason: "youtube_pubsub_raw_body_missing"
        };
      }

      const projection = projectYouTubePubSubFeed({
        rawBody,
        topic: getQueryValue(request, "hub.topic")
      });

      if (!projection.ok) {
        reply.code(400);
        return {
          ok: false,
          reason: `youtube_pubsub_${projection.reason}`
        };
      }

      for (const event of projection.events) {
        const result = await dependencies.intakeLogService.recordProviderEvent(event);

        if (!result.ok) {
          server.log.warn({ reason: result.reason }, "YouTube PubSub intake ledger write failed.");
          reply.code(503);
          return {
            ok: false,
            reason: "youtube_pubsub_write_failed"
          };
        }
      }

      reply.code(204);
      return null;
    }
  );
};
