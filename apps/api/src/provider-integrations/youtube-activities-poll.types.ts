import type {
  YouTubeActivitiesPollResult,
  YouTubeLiveChatContext
} from "@maiks-yt/integrations";

import type { ProviderEventIntakeLogResult } from "./provider-event-intake-log.types.js";

export type YouTubeActivitiesPollActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type YouTubeActivitiesPollControlResult =
  | {
    ok: true;
    channelId: string;
    events: readonly {
      catalogKnown?: boolean;
      inserted: boolean;
      providerEventName: string;
      providerMessageId: string | null;
      sourceEventId: string;
    }[];
    fetched: number;
    inserted: number;
    polledAt: string;
    readOnly: true;
  }
  | {
    ok: false;
    reason:
      | "youtube_activities_user_unlinked"
      | "youtube_activities_forbidden"
      | "youtube_activities_context_missing"
      | "youtube_activities_poll_failed"
      | "youtube_activities_write_failed";
  };

export type YouTubeActivitiesPollRepository = {
  resolveActor(authUserId: string): Promise<YouTubeActivitiesPollActor | null>;
  resolveSelectedLiveChatContext(): Promise<YouTubeLiveChatContext | null>;
};

export type YouTubeActivitiesReadOnlyPoller = {
  pollRecent(input: {
    context: YouTubeLiveChatContext;
  }): Promise<YouTubeActivitiesPollResult>;
};

export type YouTubeActivitiesIntakeWriter = {
  recordProviderEvent(event: Extract<YouTubeActivitiesPollResult, { ok: true }>["events"][number]): Promise<ProviderEventIntakeLogResult>;
};
