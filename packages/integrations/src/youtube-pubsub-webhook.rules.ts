import { XMLParser } from "fast-xml-parser";

import type {
  YouTubePubSubProjectedEvent,
  YouTubePubSubProjectionInput,
  YouTubePubSubProjectionResult,
  YouTubePubSubVerificationInput,
  YouTubePubSubVerificationResult
} from "./youtube-pubsub-webhook.types.js";

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true
});

const trimToNull = (value: unknown, maxLength = 191): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asRecordArray = (value: unknown): readonly Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null);
  }

  const record = asRecord(value);
  return record ? [record] : [];
};

const parseDate = (value: unknown, fallback: Date): string =>
  trimToNull(value, 80) && !Number.isNaN(new Date(String(value)).getTime())
    ? new Date(String(value)).toISOString()
    : fallback.toISOString();

const getText = (record: Record<string, unknown>, key: string): string | null =>
  trimToNull(record[key]);

const getLongText = (record: Record<string, unknown>, key: string, maxLength: number): string | null =>
  trimToNull(record[key], maxLength);

const getAlternateLink = (entry: Record<string, unknown>): string | null => {
  const links = asRecordArray(entry.link);
  const alternate = links.find((link) => getText(link, "rel") === "alternate") ?? links[0];

  return alternate ? getLongText(alternate, "href", 512) : null;
};

const getAuthor = (
  entry: Record<string, unknown>
): { actorDisplayName: string | null; actorExternalId: string | null } => {
  const author = asRecord(entry.author);
  const uri = getText(author ?? {}, "uri");

  return {
    actorDisplayName: getText(author ?? {}, "name"),
    actorExternalId: uri?.split("/channel/")[1]?.slice(0, 191) ?? null
  };
};

const resolveProviderEventName = (entry: Record<string, unknown>): YouTubePubSubProjectedEvent["providerEventName"] => {
  const published = getText(entry, "published");
  const updated = getText(entry, "updated");

  return published && updated && published !== updated ? "video.title.update" : "video.upload";
};

export const resolveYouTubePubSubVerification = (
  input: YouTubePubSubVerificationInput
): YouTubePubSubVerificationResult => {
  const challenge = trimToNull(input.challenge, 512);
  const topic = trimToNull(input.topic, 512);
  const mode = trimToNull(input.mode, 32);

  if (!challenge) {
    return {
      ok: false,
      reason: "missing_challenge"
    };
  }

  if (mode !== "subscribe" && mode !== "unsubscribe") {
    return {
      ok: false,
      reason: "missing_mode"
    };
  }

  if (!topic) {
    return {
      ok: false,
      reason: "missing_topic"
    };
  }

  return {
    challenge,
    mode,
    ok: true,
    topic
  };
};

export const projectYouTubePubSubFeed = (
  input: YouTubePubSubProjectionInput
): YouTubePubSubProjectionResult => {
  let parsed: unknown;

  try {
    parsed = parser.parse(Buffer.isBuffer(input.rawBody) ? input.rawBody.toString("utf8") : input.rawBody);
  } catch {
    return {
      ok: false,
      reason: "invalid_xml"
    };
  }

  const feed = asRecord(asRecord(parsed)?.feed);
  if (!feed) {
    return {
      ok: false,
      reason: "invalid_xml"
    };
  }

  const receivedAt = input.receivedAt ?? new Date();
  const entries = asRecordArray(feed.entry);
  if (entries.length === 0) {
    return {
      ok: false,
      reason: "missing_entry"
    };
  }

  return {
    ok: true,
    events: entries.map((entry) => {
      const author = getAuthor(entry);
      const videoId = getText(entry, "videoId");
      const channelId = getText(entry, "channelId");
      const providerEventName = resolveProviderEventName(entry);
      const occurredAt = parseDate(entry.updated ?? entry.published, receivedAt);

      return {
        actorDisplayName: author.actorDisplayName,
        actorExternalId: author.actorExternalId ?? channelId,
        channelId,
        mechanism: "youtube-pubsub",
        occurredAt,
        providerEventName,
        providerMessageId: videoId,
        redactedPayload: {
          alternateUrl: getAlternateLink(entry),
          channelId,
          entryId: getText(entry, "id"),
          published: getText(entry, "published"),
          title: getLongText(entry, "title", 280),
          topic: input.topic ?? null,
          updated: getText(entry, "updated"),
          videoId
        },
        source: "youtube",
        sourceEventId: `youtube-pubsub:${channelId ?? "unknown-channel"}:${videoId ?? occurredAt}:${providerEventName}`.slice(0, 191),
        videoId
      } satisfies YouTubePubSubProjectedEvent;
    })
  };
};
