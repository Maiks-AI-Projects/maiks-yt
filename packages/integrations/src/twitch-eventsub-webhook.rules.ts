import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  TwitchEventSubChallengeResult,
  TwitchEventSubProjectionInput,
  TwitchEventSubProjectionResult,
  TwitchEventSubSignatureInput,
  TwitchEventSubSignatureResult
} from "./twitch-eventsub-webhook.types.js";

const maxTimestampSkewMs = 10 * 60 * 1000;
const hmacPrefix = "sha256=";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const trimToNull = (value: unknown, maxLength = 191): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const isSupportedMessageType = (messageType: string): messageType is TwitchEventSubProjectionInput["messageType"] =>
  messageType === "notification"
  || messageType === "webhook_callback_verification"
  || messageType === "revocation";

const getSubscription = (body: Record<string, unknown>): Record<string, unknown> | null =>
  asRecord(body.subscription);

const getEvent = (body: Record<string, unknown>): Record<string, unknown> | null =>
  asRecord(body.event);

const resolveActor = (
  event: Record<string, unknown> | null
): { actorDisplayName: string | null; actorExternalId: string | null } => {
  if (!event) {
    return {
      actorDisplayName: null,
      actorExternalId: null
    };
  }

  return {
    actorDisplayName: trimToNull(event.user_name)
      ?? trimToNull(event.from_broadcaster_user_name)
      ?? trimToNull(event.chatter_user_name)
      ?? trimToNull(event.user_login),
    actorExternalId: trimToNull(event.user_id)
      ?? trimToNull(event.from_broadcaster_user_id)
      ?? trimToNull(event.chatter_user_id)
  };
};

const resolveBroadcasterUserId = (event: Record<string, unknown> | null): string | null => {
  if (!event) {
    return null;
  }

  return trimToNull(event.broadcaster_user_id)
    ?? trimToNull(event.to_broadcaster_user_id)
    ?? trimToNull(event.user_id);
};

const resolveProviderMessageId = (event: Record<string, unknown> | null): string | null => {
  if (!event) {
    return null;
  }

  return trimToNull(event.message_id)
    ?? trimToNull(event.id)
    ?? trimToNull(event.reward?.toString());
};

const buildExpectedSignature = (
  secret: string,
  messageId: string,
  messageTimestamp: string,
  rawBody: Buffer | string
): string =>
  `${hmacPrefix}${createHmac("sha256", secret).update(messageId).update(messageTimestamp).update(rawBody).digest("hex")}`;

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyTwitchEventSubSignature = (
  input: TwitchEventSubSignatureInput
): TwitchEventSubSignatureResult => {
  const secret = input.secret.trim();
  const messageId = trimToNull(input.messageId);
  const messageTimestamp = trimToNull(input.messageTimestamp);
  const messageSignature = trimToNull(input.messageSignature, 512);

  if (secret.length < 10 || secret.length > 100) {
    return {
      ok: false,
      reason: "invalid_secret"
    };
  }

  if (!messageId || !messageTimestamp || !messageSignature) {
    return {
      ok: false,
      reason: "missing_header"
    };
  }

  const timestamp = new Date(messageTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return {
      ok: false,
      reason: "missing_header"
    };
  }

  const now = input.now ?? new Date();
  if (Math.abs(now.getTime() - timestamp.getTime()) > maxTimestampSkewMs) {
    return {
      ok: false,
      reason: "stale_timestamp"
    };
  }

  const expected = buildExpectedSignature(secret, messageId, messageTimestamp, input.rawBody);
  if (!safeCompare(expected, messageSignature)) {
    return {
      ok: false,
      reason: "invalid_signature"
    };
  }

  return { ok: true };
};

export const resolveTwitchEventSubChallenge = (body: unknown): TwitchEventSubChallengeResult => {
  const record = asRecord(body);
  if (!record) {
    return {
      ok: false,
      reason: "invalid_body"
    };
  }

  const challenge = trimToNull(record.challenge, 512);
  if (!challenge) {
    return {
      ok: false,
      reason: "missing_challenge"
    };
  }

  return {
    challenge,
    ok: true
  };
};

export const projectTwitchEventSubEvent = (
  input: TwitchEventSubProjectionInput
): TwitchEventSubProjectionResult => {
  if (!isSupportedMessageType(input.messageType) || input.messageType === "webhook_callback_verification") {
    return {
      ok: false,
      reason: input.messageType === "webhook_callback_verification" ? "missing_challenge" : "unsupported_message_type"
    };
  }

  const body = asRecord(input.body);
  if (!body) {
    return {
      ok: false,
      reason: "invalid_body"
    };
  }

  const subscription = getSubscription(body);
  const providerEventName = trimToNull(subscription?.type);
  if (!providerEventName) {
    return {
      ok: false,
      reason: "missing_subscription_type"
    };
  }

  const event = getEvent(body);
  const actor = resolveActor(event);

  return {
    ok: true,
    event: {
      actorDisplayName: actor.actorDisplayName,
      actorExternalId: actor.actorExternalId,
      broadcasterUserId: resolveBroadcasterUserId(event),
      occurredAt: input.messageTimestamp,
      providerEventName,
      providerMessageId: resolveProviderMessageId(event),
      redactedPayload: {
        event: event ?? null,
        messageId: input.messageId,
        messageType: input.messageType,
        subscription: subscription ?? null
      },
      source: "twitch",
      sourceEventId: `twitch-eventsub:${input.messageId}`.slice(0, 191)
    }
  };
};
