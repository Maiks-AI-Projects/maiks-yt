import {
  projectDiscordWebhookEvent,
  verifyDiscordWebhookSignature
} from "@maiks-yt/integrations";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Readable } from "node:stream";

import type { ProviderEventIntakeLogService } from "./provider-event-intake-log.service.js";

type DiscordWebhookEventsRouteDependencies = {
  intakeLogService: Pick<ProviderEventIntakeLogService, "recordProviderEvent">;
};

type RawBodyRequest = FastifyRequest & {
  rawBody?: Buffer;
};

const getHeader = (request: FastifyRequest, name: string): string | null => {
  const value = request.headers[name.toLowerCase()];
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === "string" && firstValue.trim().length > 0 ? firstValue.trim() : null;
};

const getDiscordPublicKey = (): string | null => {
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim()
    ?? process.env.DISCORD_APPLICATION_PUBLIC_KEY?.trim()
    ?? "";

  return publicKey.length > 0 ? publicKey : null;
};

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

export const registerDiscordWebhookEventsRoutes = (
  server: FastifyInstance,
  dependencies: DiscordWebhookEventsRouteDependencies
): void => {
  server.post(
    "/provider-webhooks/discord/events",
    {
      bodyLimit: 1_048_576,
      preParsing: captureRawJsonBody
    },
    async (request: RawBodyRequest, reply) => {
      const publicKey = getDiscordPublicKey();
      if (!publicKey) {
        reply.code(503);
        return {
          ok: false,
          reason: "discord_webhook_public_key_missing"
        };
      }

      const signature = getHeader(request, "x-signature-ed25519");
      const timestamp = getHeader(request, "x-signature-timestamp");
      const rawBody = request.rawBody;

      if (!rawBody) {
        reply.code(400);
        return {
          ok: false,
          reason: "discord_webhook_raw_body_missing"
        };
      }

      const verified = verifyDiscordWebhookSignature({
        publicKey,
        rawBody,
        signature,
        timestamp
      });

      if (!verified.ok) {
        reply.code(verified.reason === "invalid_public_key" ? 503 : 401);
        return {
          ok: false,
          reason: "discord_webhook_signature_rejected"
        };
      }

      const projection = projectDiscordWebhookEvent({
        body: request.body,
        signature,
        timestamp
      });

      if (!projection.ok) {
        reply.code(400);
        return {
          ok: false,
          reason: "discord_webhook_invalid_event"
        };
      }

      if (projection.kind === "ping") {
        reply.code(204);
        return null;
      }

      const projectedEvent = projection.event;
      if (!projectedEvent) {
        reply.code(400);
        return {
          ok: false,
          reason: "discord_webhook_invalid_event"
        };
      }

      const result = await dependencies.intakeLogService.recordProviderEvent(projectedEvent);
      if (!result.ok) {
        server.log.warn({ reason: result.reason }, "Discord webhook intake ledger write failed.");
        reply.code(503);
        return {
          ok: false,
          reason: "discord_webhook_write_failed"
        };
      }

      reply.code(204);
      return null;
    }
  );
};
