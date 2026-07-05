import { google } from "googleapis";

import { projectYouTubeActivities } from "./youtube-activities.rules.js";
import type {
  YouTubeActivitiesApi,
  YouTubeActivitiesPollResult
} from "./youtube-activities.types.js";
import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";

const createYouTubeClient = (context: YouTubeLiveChatContext) => {
  const client = new google.auth.OAuth2(
    context.config.clientId,
    context.config.clientSecret,
    context.config.redirectUri
  );

  client.setCredentials({
    ...(context.credential.accessToken ? { access_token: context.credential.accessToken } : {}),
    refresh_token: context.credential.refreshToken,
    ...(context.credential.accessTokenExpiresAt ? { expiry_date: context.credential.accessTokenExpiresAt.getTime() } : {})
  });

  return google.youtube({
    version: "v3",
    auth: client
  });
};

export const createGoogleYouTubeActivitiesApi = (): YouTubeActivitiesApi => ({
  async listRecentActivities({ context, maxResults, publishedAfter }) {
    const youtube = createYouTubeClient(context);
    const response = await youtube.activities.list({
      channelId: context.selectedChannel.id,
      maxResults,
      part: ["snippet", "contentDetails"],
      ...(publishedAfter ? { publishedAfter } : {})
    });

    return response.data;
  }
});

export class YouTubeActivitiesReadOnlyService {
  public constructor(
    private readonly options: {
      activitiesApi?: YouTubeActivitiesApi;
      maxResults?: number;
      now?: () => Date;
      publishedAfter?: () => string | null;
    } = {}
  ) {}

  public async pollRecent(input: {
    context: YouTubeLiveChatContext;
  }): Promise<YouTubeActivitiesPollResult> {
    const now = this.options.now?.() ?? new Date();

    try {
      const response = await (this.options.activitiesApi ?? createGoogleYouTubeActivitiesApi()).listRecentActivities({
        context: input.context,
        maxResults: this.options.maxResults ?? 10,
        publishedAfter: this.options.publishedAfter?.() ?? null
      });

      return {
        ok: true,
        channelId: input.context.selectedChannel.id,
        events: projectYouTubeActivities({
          channelId: input.context.selectedChannel.id,
          now,
          response
        }),
        polledAt: now.toISOString(),
        readOnly: true
      };
    } catch {
      return {
        ok: false,
        reason: "youtube_activities_poll_failed"
      };
    }
  }
}
