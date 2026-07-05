import type { youtube_v3 } from "googleapis";

import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";

export type YouTubeActivityProjectedEvent = {
  actorDisplayName: string | null;
  actorExternalId: string | null;
  channelId: string | null;
  mechanism: "youtube-activity";
  occurredAt: string;
  providerEventName: string;
  providerMessageId: string | null;
  redactedPayload: Record<string, unknown>;
  source: "youtube";
  sourceEventId: string;
};

export type YouTubeActivityListResponse = Pick<youtube_v3.Schema$ActivityListResponse, "items">;

export type YouTubeActivitiesApi = {
  listRecentActivities(input: {
    context: YouTubeLiveChatContext;
    maxResults: number;
    publishedAfter?: string | null;
  }): Promise<YouTubeActivityListResponse>;
};

export type YouTubeActivitiesPollResult =
  | {
    ok: true;
    channelId: string;
    events: readonly YouTubeActivityProjectedEvent[];
    polledAt: string;
    readOnly: true;
  }
  | {
    ok: false;
    reason: "youtube_activities_poll_failed";
  };
