import { generateKeyPairSync, sign } from "node:crypto";
import type { DiscordWebhookProjectedEvent } from "@maiks-yt/integrations";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerDiscordWebhookEventsRoutes } from "../../src/provider-integrations/discord-webhook-events.route.js";

const originalPublicKey = process.env.DISCORD_PUBLIC_KEY;
const timestamp = "2026-07-05T00:45:00.000Z";

class FakeIntakeLogService {
  public readonly recordProviderEvent = vi.fn(async (_event: DiscordWebhookProjectedEvent) => ({
    inserted: true,
    ok: true as const
  }));
}

const createSignedHeaders = (rawBody: string) => {
  const keyPair = generateKeyPairSync("ed25519");
  const publicKeyDer = keyPair.publicKey.export({
    format: "der",
    type: "spki"
  });
  const publicKeyHex = publicKeyDer.subarray(-32).toString("hex");
  const signature = sign(null, Buffer.concat([
    Buffer.from(timestamp, "utf8"),
    Buffer.from(rawBody)
  ]), keyPair.privateKey).toString("hex");

  process.env.DISCORD_PUBLIC_KEY = publicKeyHex;

  return {
    "content-type": "application/json",
    "x-signature-ed25519": signature,
    "x-signature-timestamp": timestamp
  };
};

const createServer = (service = new FakeIntakeLogService()) => {
  const server = Fastify();
  registerDiscordWebhookEventsRoutes(server, {
    intakeLogService: service
  });
  return { server, service };
};

describe("Discord webhook events route", () => {
  afterEach(() => {
    if (originalPublicKey === undefined) {
      delete process.env.DISCORD_PUBLIC_KEY;
    } else {
      process.env.DISCORD_PUBLIC_KEY = originalPublicKey;
    }
  });

  it("rejects requests when the public key is missing", async () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const { server } = createServer();

    const response = await server.inject({
      headers: {
        "content-type": "application/json"
      },
      method: "POST",
      payload: "{}",
      url: "/provider-webhooks/discord/events"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "discord_webhook_public_key_missing"
    });
  });

  it("acknowledges signed ping requests without writing intake rows", async () => {
    const { server, service } = createServer();
    const rawBody = JSON.stringify({
      type: 0
    });

    const response = await server.inject({
      headers: createSignedHeaders(rawBody),
      method: "POST",
      payload: rawBody,
      url: "/provider-webhooks/discord/events"
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(service.recordProviderEvent).not.toHaveBeenCalled();
  });

  it("logs signed webhook events into provider intake without returning payload data", async () => {
    const { server, service } = createServer();
    const rawBody = JSON.stringify({
      application_id: "app-1",
      event: {
        channel_id: "channel-1",
        guild_id: "guild-1",
        id: "event-1",
        type: "ENTITLEMENT_CREATE",
        user: {
          id: "user-1",
          username: "viewer"
        }
      },
      type: 1,
      version: 1
    });

    const response = await server.inject({
      headers: createSignedHeaders(rawBody),
      method: "POST",
      payload: rawBody,
      url: "/provider-webhooks/discord/events"
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(service.recordProviderEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorDisplayName: "viewer",
      actorExternalId: "user-1",
      mechanism: "discord-webhook",
      providerEventName: "ENTITLEMENT_CREATE",
      source: "discord"
    }));
  });

  it("rejects invalid signatures without writing intake rows", async () => {
    const { server, service } = createServer();
    process.env.DISCORD_PUBLIC_KEY = "a".repeat(64);

    const response = await server.inject({
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": "b".repeat(128),
        "x-signature-timestamp": timestamp
      },
      method: "POST",
      payload: JSON.stringify({ type: 0 }),
      url: "/provider-webhooks/discord/events"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "discord_webhook_signature_rejected"
    });
    expect(service.recordProviderEvent).not.toHaveBeenCalled();
  });
});
