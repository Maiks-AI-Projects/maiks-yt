import {
  projectTwitchEventSubEvent,
  resolveTwitchEventSubChallenge,
  verifyTwitchEventSubSignature,
  type TwitchEventSubMessageType
} from "@maiks-yt/integrations";
import { Readable } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { ProviderEventIntakeLogService } from "./provider-event-intake-log.service.js";

type TwitchEventSubWebhookRouteDependencies = {
  intakeLogService: Pick<ProviderEventIntakeLogService, "recordProviderEvent">;
  now?: () => Date;
};

type RawBodyRequest = FastifyRequest & {
  rawBody?: Buffer;
};

const getHeader = (request: FastifyRequest, name: string): string | null => {
  const value = request.headers[name.toLowerCase()];
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === "string" && firstValue.trim().length > 0 ? firstValue.trim() : null;
};

const getEventSubSecret = (): string | null => {
  const secret = process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET?.trim()
    ?? process.env.TWITCH_EVENTSUB_SECRET?.trim()
    ?? "";

  return secret.length > 0 ? secret : null;
};

const isEventSubMessageType = (value: string | null): value is TwitchEventSubMessageType =>
  value === "notification"
  || value === "webhook_callback_verification"
  || value === "revocation";

const captureRawJsonBody = async (
  request: RawBodyRequest,
  _reply: unknown,
  payload: NodeJS.ReadableStream
): Promise<Readable> => {
  const chunks: Buffer[] = [];

  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks);
  const replacementPayload = Readable.from(rawBody);
  request.rawBody = rawBody;
  (replacementPayload as Readable & { receivedEncodedLength?: number }).receivedEncodedLength = rawBody.length;

  return replacementPayload;
};

export const registerTwitchEventSubWebhookRoutes = (
  server: FastifyInstance,
  dependencies: TwitchEventSubWebhookRouteDependencies
): void => {
  server.post(
    "/provider-webhooks/twitch/eventsub",
    {
      bodyLimit: 1_048_576,
      preParsing: captureRawJsonBody
    },
    async (request: RawBodyRequest, reply) => {
      const secret = getEventSubSecret();
      if (!secret) {
        reply.code(503);
        return {
          ok: false,
          reason: "twitch_eventsub_secret_missing"
        };
      }

      const messageId = getHeader(request, "twitch-eventsub-message-id");
      const messageTimestamp = getHeader(request, "twitch-eventsub-message-timestamp");
      const messageSignature = getHeader(request, "twitch-eventsub-message-signature");
      const rawBody = request.rawBody;

      if (!rawBody) {
        reply.code(400);
        return {
          ok: false,
          reason: "twitch_eventsub_raw_body_missing"
        };
      }

      const signature = verifyTwitchEventSubSignature({
        messageId,
        messageSignature,
        messageTimestamp,
        rawBody,
        secret,
        ...(dependencies.now ? { now: dependencies.now() } : {})
      });

      if (!signature.ok) {
        reply.code(signature.reason === "invalid_secret" ? 503 : 403);
        return {
          ok: false,
          reason: "twitch_eventsub_signature_rejected"
        };
      }

      const messageType = getHeader(request, "twitch-eventsub-message-type");
      if (!isEventSubMessageType(messageType) || !messageId || !messageTimestamp) {
        reply.code(400);
        return {
          ok: false,
          reason: "twitch_eventsub_invalid_headers"
        };
      }

      if (messageType === "webhook_callback_verification") {
        const challenge = resolveTwitchEventSubChallenge(request.body);
        if (!challenge.ok) {
          reply.code(400);
          return {
            ok: false,
            reason: "twitch_eventsub_invalid_challenge"
          };
        }

        return reply.type("text/plain").send(challenge.challenge);
      }

      const projection = projectTwitchEventSubEvent({
        body: request.body,
        messageId,
        messageTimestamp,
        messageType
      });

      if (!projection.ok) {
        reply.code(400);
        return {
          ok: false,
          reason: "twitch_eventsub_invalid_event"
        };
      }

      const result = await dependencies.intakeLogService.recordProviderEvent(projection.event);
      if (!result.ok) {
        server.log.warn({ reason: result.reason }, "Twitch EventSub intake ledger write failed.");
        reply.code(503);
        return {
          ok: false,
          reason: "twitch_eventsub_write_failed"
        };
      }

      reply.code(204);
      return undefined;
    }
  );
};
