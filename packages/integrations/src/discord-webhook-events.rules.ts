import { createPublicKey, verify } from "node:crypto";

import type {
  DiscordWebhookProjectedEvent,
  DiscordWebhookProjectionInput,
  DiscordWebhookProjectionResult,
  DiscordWebhookVerificationInput,
  DiscordWebhookVerificationResult
} from "./discord-webhook-events.types.js";

const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const trimToNull = (value: unknown, maxLength = 191): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const normalizeWebhookType = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
};

const getNestedRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> | null =>
  asRecord(record[key]);

const resolveActor = (
  event: Record<string, unknown>
): { actorDisplayName: string | null; actorExternalId: string | null } => {
  const user = getNestedRecord(event, "user") ?? getNestedRecord(event, "author");

  return {
    actorDisplayName: trimToNull(user?.global_name) ?? trimToNull(user?.username) ?? trimToNull(event.user_name),
    actorExternalId: trimToNull(user?.id) ?? trimToNull(event.user_id)
  };
};

const resolveEventType = (event: Record<string, unknown>): string | null =>
  trimToNull(event.type) ?? trimToNull(event.event_type) ?? trimToNull(event.name);

const buildSourceEventId = (input: {
  applicationId: string | null;
  event: Record<string, unknown>;
  eventType: string;
  receivedAt: Date;
  signature?: string | null;
}): string => {
  const stableId = trimToNull(input.event.id)
    ?? trimToNull(input.event.message_id)
    ?? trimToNull(input.event.entitlement_id)
    ?? trimToNull(input.signature, 32);

  return `discord-webhook:${input.applicationId ?? "unknown-app"}:${input.eventType}:${stableId ?? input.receivedAt.toISOString()}`.slice(0, 191);
};

export const verifyDiscordWebhookSignature = (
  input: DiscordWebhookVerificationInput
): DiscordWebhookVerificationResult => {
  const publicKeyHex = input.publicKey.trim();
  const signatureHex = trimToNull(input.signature, 512);
  const timestamp = trimToNull(input.timestamp, 128);

  if (!signatureHex || !timestamp) {
    return {
      ok: false,
      reason: "missing_header"
    };
  }

  if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) {
    return {
      ok: false,
      reason: "invalid_public_key"
    };
  }

  if (!/^[0-9a-fA-F]{128}$/.test(signatureHex)) {
    return {
      ok: false,
      reason: "invalid_signature"
    };
  }

  try {
    const key = createPublicKey({
      format: "der",
      key: Buffer.concat([ed25519SpkiPrefix, Buffer.from(publicKeyHex, "hex")]),
      type: "spki"
    });
    const message = Buffer.concat([
      Buffer.from(timestamp, "utf8"),
      Buffer.isBuffer(input.rawBody) ? input.rawBody : Buffer.from(input.rawBody)
    ]);

    return verify(null, message, key, Buffer.from(signatureHex, "hex"))
      ? { ok: true }
      : {
        ok: false,
        reason: "invalid_signature"
      };
  } catch {
    return {
      ok: false,
      reason: "invalid_signature"
    };
  }
};

export const projectDiscordWebhookEvent = (
  input: DiscordWebhookProjectionInput
): DiscordWebhookProjectionResult => {
  const body = asRecord(input.body);
  if (!body) {
    return {
      ok: false,
      reason: "invalid_body"
    };
  }

  const webhookType = normalizeWebhookType(body.type);
  if (webhookType === 0) {
    return {
      event: null,
      kind: "ping",
      ok: true
    };
  }

  const event = asRecord(body.event);
  if (!event) {
    return {
      ok: false,
      reason: "invalid_body"
    };
  }

  const providerEventName = resolveEventType(event);
  if (!providerEventName) {
    return {
      ok: false,
      reason: "missing_event_type"
    };
  }

  const receivedAt = input.receivedAt ?? new Date();
  const actor = resolveActor(event);
  const applicationId = trimToNull(body.application_id);

  return {
    kind: "event",
    ok: true,
    event: {
      actorDisplayName: actor.actorDisplayName,
      actorExternalId: actor.actorExternalId,
      channelId: trimToNull(event.channel_id),
      guildId: trimToNull(event.guild_id),
      mechanism: "discord-webhook",
      messageId: trimToNull(event.message_id) ?? trimToNull(event.id),
      occurredAt: trimToNull(event.created_at) ?? receivedAt.toISOString(),
      providerEventName,
      redactedPayload: {
        applicationId,
        event,
        timestamp: input.timestamp ?? null,
        type: webhookType
      },
      source: "discord",
      sourceEventId: buildSourceEventId({
        applicationId,
        event,
        eventType: providerEventName,
        receivedAt,
        signature: input.signature ?? null
      })
    } satisfies DiscordWebhookProjectedEvent
  };
};
