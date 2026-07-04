import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  projectTwitchEventSubEvent,
  resolveTwitchEventSubChallenge,
  verifyTwitchEventSubSignature
} from "./twitch-eventsub-webhook.rules.js";

const secret = "0123456789abcdef0123456789abcdef";
const messageId = "eventsub-message-1";
const messageTimestamp = "2026-07-04T20:00:00.000Z";
const body = JSON.stringify({
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

const sign = (rawBody: string): string =>
  `sha256=${createHmac("sha256", secret).update(messageId).update(messageTimestamp).update(rawBody).digest("hex")}`;

describe("verifyTwitchEventSubSignature", () => {
  it("accepts Twitch EventSub signatures over id, timestamp, and raw body", () => {
    expect(verifyTwitchEventSubSignature({
      messageId,
      messageSignature: sign(body),
      messageTimestamp,
      now: new Date("2026-07-04T20:01:00.000Z"),
      rawBody: body,
      secret
    })).toEqual({ ok: true });
  });

  it("rejects bad signatures and stale timestamps", () => {
    expect(verifyTwitchEventSubSignature({
      messageId,
      messageSignature: "sha256=bad",
      messageTimestamp,
      now: new Date("2026-07-04T20:01:00.000Z"),
      rawBody: body,
      secret
    })).toEqual({
      ok: false,
      reason: "invalid_signature"
    });

    expect(verifyTwitchEventSubSignature({
      messageId,
      messageSignature: sign(body),
      messageTimestamp,
      now: new Date("2026-07-04T21:00:00.000Z"),
      rawBody: body,
      secret
    })).toEqual({
      ok: false,
      reason: "stale_timestamp"
    });
  });
});

describe("Twitch EventSub projection", () => {
  it("extracts verification challenges", () => {
    expect(resolveTwitchEventSubChallenge({ challenge: "challenge-value" })).toEqual({
      challenge: "challenge-value",
      ok: true
    });
  });

  it("projects notification payloads into provider intake events", () => {
    const result = projectTwitchEventSubEvent({
      body: JSON.parse(body) as unknown,
      messageId,
      messageTimestamp,
      messageType: "notification"
    });

    expect(result).toEqual({
      ok: true,
      event: expect.objectContaining({
        actorDisplayName: "Viewer",
        actorExternalId: "viewer-1",
        broadcasterUserId: "broadcaster-1",
        occurredAt: messageTimestamp,
        providerEventName: "channel.follow",
        source: "twitch",
        sourceEventId: "twitch-eventsub:eventsub-message-1"
      })
    });
  });
});
