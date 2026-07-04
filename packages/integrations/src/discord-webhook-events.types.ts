export type DiscordWebhookVerificationInput = {
  publicKey: string;
  rawBody: Buffer | string;
  signature?: string | null;
  timestamp?: string | null;
};

export type DiscordWebhookVerificationResult =
  | { ok: true }
  | { ok: false; reason: "invalid_public_key" | "missing_header" | "invalid_signature" };

export type DiscordWebhookProjectedEvent = {
  actorDisplayName: string | null;
  actorExternalId: string | null;
  channelId: string | null;
  guildId: string | null;
  messageId: string | null;
  mechanism: "discord-webhook";
  occurredAt: string;
  providerEventName: string;
  redactedPayload: Record<string, unknown>;
  source: "discord";
  sourceEventId: string;
};

export type DiscordWebhookProjectionInput = {
  body: unknown;
  receivedAt?: Date;
  signature?: string | null;
  timestamp?: string | null;
};

export type DiscordWebhookProjectionResult =
  | {
    ok: true;
    event: DiscordWebhookProjectedEvent | null;
    kind: "ping" | "event";
  }
  | {
    ok: false;
    reason: "invalid_body" | "missing_event_type";
  };
