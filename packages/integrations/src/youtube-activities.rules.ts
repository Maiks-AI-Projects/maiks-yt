import type { youtube_v3 } from "googleapis";

import type {
  YouTubeActivityListResponse,
  YouTubeActivityProjectedEvent
} from "./youtube-activities.types.js";

const trimToNull = (value: unknown, maxLength = 191): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const toIso = (value: unknown, fallback: Date): string => {
  const trimmed = trimToNull(value, 80);
  const date = trimmed ? new Date(trimmed) : null;

  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback.toISOString();
};

const pickContentDetails = (
  contentDetails: youtube_v3.Schema$ActivityContentDetails | undefined
): Record<string, unknown> => ({
  bulletinResourceId: contentDetails?.bulletin?.resourceId ?? null,
  channelItemResourceId: contentDetails?.channelItem?.resourceId ?? null,
  commentResourceId: contentDetails?.comment?.resourceId ?? null,
  favoriteResourceId: contentDetails?.favorite?.resourceId ?? null,
  likeResourceId: contentDetails?.like?.resourceId ?? null,
  playlistItemResourceId: contentDetails?.playlistItem?.resourceId ?? null,
  promotedItem: contentDetails?.promotedItem ? "[present]" : null,
  recommendationResourceId: contentDetails?.recommendation?.resourceId ?? null,
  socialResourceId: contentDetails?.social?.resourceId ?? null,
  subscriptionResourceId: contentDetails?.subscription?.resourceId ?? null,
  uploadVideoId: contentDetails?.upload?.videoId ?? null
});

export const projectYouTubeActivities = (input: {
  channelId: string;
  now?: Date;
  response: YouTubeActivityListResponse;
}): readonly YouTubeActivityProjectedEvent[] => {
  const now = input.now ?? new Date();

  return (input.response.items ?? []).flatMap((item): YouTubeActivityProjectedEvent[] => {
    const providerMessageId = trimToNull(item.id);
    const providerEventName = trimToNull(item.snippet?.type);
    const occurredAt = toIso(item.snippet?.publishedAt, now);

    if (!providerMessageId || !providerEventName) {
      return [];
    }

    const channelId = trimToNull(item.snippet?.channelId) ?? input.channelId;

    return [{
      actorDisplayName: trimToNull(item.snippet?.channelTitle),
      actorExternalId: channelId,
      channelId,
      mechanism: "youtube-activity",
      occurredAt,
      providerEventName,
      providerMessageId,
      redactedPayload: {
        channelId,
        channelTitle: trimToNull(item.snippet?.channelTitle),
        contentDetails: pickContentDetails(item.contentDetails),
        description: trimToNull(item.snippet?.description, 512),
        publishedAt: trimToNull(item.snippet?.publishedAt, 80),
        title: trimToNull(item.snippet?.title, 280),
        type: providerEventName
      },
      source: "youtube",
      sourceEventId: `youtube-activity:${channelId}:${providerMessageId}`.slice(0, 191)
    }];
  });
};
