export type TwitchEventSubMessageType =
  | "notification"
  | "webhook_callback_verification"
  | "revocation";

export type TwitchEventSubSignatureInput = {
  messageId?: string | null;
  messageSignature?: string | null;
  messageTimestamp?: string | null;
  now?: Date;
  rawBody: Buffer | string;
  secret: string;
};

export type TwitchEventSubSignatureResult =
  | { ok: true }
  | { ok: false; reason: "missing_header" | "invalid_signature" | "stale_timestamp" | "invalid_secret" };

export type TwitchEventSubProjectionInput = {
  body: unknown;
  messageId: string;
  messageTimestamp: string;
  messageType: TwitchEventSubMessageType;
};

export type TwitchEventSubProjectedEvent = {
  actorDisplayName: string | null;
  actorExternalId: string | null;
  broadcasterUserId: string | null;
  occurredAt: string;
  providerEventName: string;
  providerMessageId: string | null;
  redactedPayload: Record<string, unknown>;
  source: "twitch";
  sourceEventId: string;
};

export type TwitchEventSubProjectionResult =
  | {
    ok: true;
    event: TwitchEventSubProjectedEvent;
  }
  | {
    ok: false;
    reason: "invalid_body" | "unsupported_message_type" | "missing_challenge" | "missing_subscription_type";
  };

export type TwitchEventSubChallengeResult =
  | {
    ok: true;
    challenge: string;
  }
  | {
    ok: false;
    reason: "invalid_body" | "missing_challenge";
  };
