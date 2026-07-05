export type YouTubePubSubVerificationInput = {
  challenge?: string | null;
  mode?: string | null;
  topic?: string | null;
};

export type YouTubePubSubVerificationResult =
  | {
    ok: true;
    challenge: string;
    mode: "subscribe" | "unsubscribe";
    topic: string;
  }
  | {
    ok: false;
    reason: "missing_challenge" | "missing_mode" | "missing_topic";
  };

export type YouTubePubSubProjectedEvent = {
  actorDisplayName: string | null;
  actorExternalId: string | null;
  channelId: string | null;
  mechanism: "youtube-pubsub";
  occurredAt: string;
  providerEventName: "video.upload" | "video.title.update" | "video.description.update";
  providerMessageId: string | null;
  redactedPayload: Record<string, unknown>;
  source: "youtube";
  sourceEventId: string;
  videoId: string | null;
};

export type YouTubePubSubProjectionInput = {
  rawBody: Buffer | string;
  receivedAt?: Date;
  topic?: string | null;
};

export type YouTubePubSubProjectionResult =
  | {
    ok: true;
    events: readonly YouTubePubSubProjectedEvent[];
  }
  | {
    ok: false;
    reason: "invalid_xml" | "missing_entry";
  };
