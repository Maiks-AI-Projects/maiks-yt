import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  projectDiscordWebhookEvent,
  verifyDiscordWebhookSignature
} from "./discord-webhook-events.rules.js";

const createSignedDiscordPayload = (rawBody: string, timestamp = "2026-07-05T00:30:00.000Z") => {
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

  return {
    publicKeyHex,
    signature,
    timestamp
  };
};

describe("Discord webhook event signature verification", () => {
  it("verifies Ed25519 signatures over timestamp plus raw body", () => {
    const rawBody = JSON.stringify({ type: 0 });
    const signed = createSignedDiscordPayload(rawBody);

    expect(verifyDiscordWebhookSignature({
      publicKey: signed.publicKeyHex,
      rawBody,
      signature: signed.signature,
      timestamp: signed.timestamp
    })).toEqual({ ok: true });

    expect(verifyDiscordWebhookSignature({
      publicKey: signed.publicKeyHex,
      rawBody: JSON.stringify({ type: 1 }),
      signature: signed.signature,
      timestamp: signed.timestamp
    })).toEqual({
      ok: false,
      reason: "invalid_signature"
    });
  });

  it("rejects missing headers and malformed public keys", () => {
    expect(verifyDiscordWebhookSignature({
      publicKey: "not-a-key",
      rawBody: "{}",
      signature: "a".repeat(128),
      timestamp: "123"
    })).toEqual({
      ok: false,
      reason: "invalid_public_key"
    });

    expect(verifyDiscordWebhookSignature({
      publicKey: "a".repeat(64),
      rawBody: "{}"
    })).toEqual({
      ok: false,
      reason: "missing_header"
    });
  });
});

describe("Discord webhook event projection", () => {
  it("acknowledges ping events without projecting a ledger event", () => {
    expect(projectDiscordWebhookEvent({
      body: {
        type: 0
      }
    })).toEqual({
      event: null,
      kind: "ping",
      ok: true
    });
  });

  it("projects webhook events into provider intake shape", () => {
    const result = projectDiscordWebhookEvent({
      body: {
        application_id: "app-1",
        event: {
          channel_id: "channel-1",
          guild_id: "guild-1",
          id: "event-1",
          type: "ENTITLEMENT_CREATE",
          user: {
            global_name: "Viewer",
            id: "user-1",
            username: "viewer"
          }
        },
        type: 1,
        version: 1
      },
      receivedAt: new Date("2026-07-05T00:31:00.000Z"),
      signature: "abcd",
      timestamp: "2026-07-05T00:30:00.000Z"
    });

    expect(result).toEqual({
      kind: "event",
      ok: true,
      event: expect.objectContaining({
        actorDisplayName: "Viewer",
        actorExternalId: "user-1",
        channelId: "channel-1",
        guildId: "guild-1",
        mechanism: "discord-webhook",
        messageId: "event-1",
        providerEventName: "ENTITLEMENT_CREATE",
        source: "discord",
        sourceEventId: "discord-webhook:app-1:ENTITLEMENT_CREATE:event-1"
      })
    });
  });
});
