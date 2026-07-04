import { createHmac } from "node:crypto";
import type { TwitchEventSubProjectedEvent } from "@maiks-yt/integrations";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerTwitchEventSubWebhookRoutes } from "../../src/provider-integrations/twitch-eventsub-webhook.route.js";

const originalWebhookSecret = process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET;
const secret = "0123456789abcdef0123456789abcdef";
const messageId = "eventsub-message-1";
const messageTimestamp = "2026-07-04T20:00:00.000Z";

class FakeIntakeLogService {
  public readonly recordProviderEvent = vi.fn(async (_event: TwitchEventSubProjectedEvent) => ({
    inserted: true,
    ok: true as const
  }));
}

const sign = (rawBody: string): string =>
  `sha256=${createHmac("sha256", secret).update(messageId).update(messageTimestamp).update(rawBody).digest("hex")}`;

const createServer = (service = new FakeIntakeLogService()) => {
  const server = Fastify();
  registerTwitchEventSubWebhookRoutes(server, {
    intakeLogService: service,
    now: () => new Date("2026-07-04T20:01:00.000Z")
  });
  return { server, service };
};

const signedHeaders = (rawBody: string, messageType = "notification") => ({
  "content-type": "application/json",
  "twitch-eventsub-message-id": messageId,
  "twitch-eventsub-message-signature": sign(rawBody),
  "twitch-eventsub-message-timestamp": messageTimestamp,
  "twitch-eventsub-message-type": messageType
});

describe("Twitch EventSub webhook route", () => {
  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET;
    } else {
      process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it("rejects requests when the webhook secret is missing", async () => {
    delete process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET;
    const { server } = createServer();

    const response = await server.inject({
      headers: {
        "content-type": "application/json"
      },
      method: "POST",
      payload: "{}",
      url: "/provider-webhooks/twitch/eventsub"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "twitch_eventsub_secret_missing"
    });
  });

  it("returns the Twitch verification challenge after signature verification", async () => {
    process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET = secret;
    const { server, service } = createServer();
    const rawBody = JSON.stringify({
      challenge: "challenge-value",
      subscription: {
        type: "channel.follow"
      }
    });

    const response = await server.inject({
      headers: signedHeaders(rawBody, "webhook_callback_verification"),
      method: "POST",
      payload: rawBody,
      url: "/provider-webhooks/twitch/eventsub"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("challenge-value");
    expect(service.recordProviderEvent).not.toHaveBeenCalled();
  });

  it("logs signed notifications into provider intake without returning payload data", async () => {
    process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET = secret;
    const { server, service } = createServer();
    const rawBody = JSON.stringify({
      event: {
        broadcaster_user_id: "broadcaster-1",
        user_id: "viewer-1",
        user_name: "Viewer"
      },
      subscription: {
        type: "channel.follow",
        version: "2"
      }
    });

    const response = await server.inject({
      headers: signedHeaders(rawBody),
      method: "POST",
      payload: rawBody,
      url: "/provider-webhooks/twitch/eventsub"
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(service.recordProviderEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorDisplayName: "Viewer",
      actorExternalId: "viewer-1",
      broadcasterUserId: "broadcaster-1",
      providerEventName: "channel.follow",
      source: "twitch"
    }));
  });

  it("rejects invalid signatures without writing intake rows", async () => {
    process.env.TWITCH_EVENTSUB_WEBHOOK_SECRET = secret;
    const { server, service } = createServer();

    const response = await server.inject({
      headers: {
        "content-type": "application/json",
        "twitch-eventsub-message-id": messageId,
        "twitch-eventsub-message-signature": "sha256=bad",
        "twitch-eventsub-message-timestamp": messageTimestamp,
        "twitch-eventsub-message-type": "notification"
      },
      method: "POST",
      payload: "{}",
      url: "/provider-webhooks/twitch/eventsub"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "twitch_eventsub_signature_rejected"
    });
    expect(service.recordProviderEvent).not.toHaveBeenCalled();
  });
});
