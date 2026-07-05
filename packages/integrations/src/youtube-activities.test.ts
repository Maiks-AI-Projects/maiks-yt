import { describe, expect, it } from "vitest";

import { projectYouTubeActivities } from "./youtube-activities.rules.js";
import { YouTubeActivitiesReadOnlyService } from "./youtube-activities.service.js";
import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";

const context: YouTubeLiveChatContext = {
  config: {
    ok: true,
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
  },
  credential: {
    accessToken: null,
    refreshToken: "refresh-token",
    accessTokenExpiresAt: null
  },
  selectedChannel: {
    id: "UC123",
    title: "Maiks Minecraft",
    customUrl: "@maiksmc"
  }
};

describe("YouTube activities projection", () => {
  it("projects sanitized channel activity events", () => {
    expect(projectYouTubeActivities({
      channelId: "UC123",
      now: new Date("2026-07-05T08:00:00.000Z"),
      response: {
        items: [{
          id: "activity-1",
          snippet: {
            channelId: "UC123",
            channelTitle: " Maiks Minecraft ",
            description: " A video was uploaded. ",
            publishedAt: "2026-07-05T07:59:00Z",
            title: " Upload title ",
            type: "upload"
          },
          contentDetails: {
            upload: {
              videoId: "video-1"
            }
          }
        }]
      }
    })).toEqual([{
      actorDisplayName: "Maiks Minecraft",
      actorExternalId: "UC123",
      channelId: "UC123",
      mechanism: "youtube-activity",
      occurredAt: "2026-07-05T07:59:00.000Z",
      providerEventName: "upload",
      providerMessageId: "activity-1",
      redactedPayload: expect.objectContaining({
        channelId: "UC123",
        title: "Upload title",
        type: "upload",
        contentDetails: expect.objectContaining({
          uploadVideoId: "video-1"
        })
      }),
      source: "youtube",
      sourceEventId: "youtube-activity:UC123:activity-1"
    }]);
  });

  it("drops activities without ids or types", () => {
    expect(projectYouTubeActivities({
      channelId: "UC123",
      response: {
        items: [{
          id: "",
          snippet: {
            type: "upload"
          }
        }, {
          id: "activity-2",
          snippet: {
            type: ""
          }
        }]
      }
    })).toEqual([]);
  });
});

describe("YouTubeActivitiesReadOnlyService", () => {
  it("polls recent activities through the injected API", async () => {
    const service = new YouTubeActivitiesReadOnlyService({
      activitiesApi: {
        async listRecentActivities(input) {
          expect(input.context.selectedChannel.id).toBe("UC123");
          expect(input.maxResults).toBe(10);
          return {
            items: [{
              id: "activity-1",
              snippet: {
                channelId: "UC123",
                publishedAt: "2026-07-05T07:59:00Z",
                title: "Upload title",
                type: "upload"
              }
            }]
          };
        }
      },
      now: () => new Date("2026-07-05T08:00:00.000Z")
    });

    await expect(service.pollRecent({ context })).resolves.toMatchObject({
      ok: true,
      channelId: "UC123",
      events: [
        {
          providerEventName: "upload"
        }
      ],
      polledAt: "2026-07-05T08:00:00.000Z"
    });
  });

  it("returns safe failure when the API throws", async () => {
    const service = new YouTubeActivitiesReadOnlyService({
      activitiesApi: {
        async listRecentActivities() {
          throw new Error("secret-token-value");
        }
      }
    });

    await expect(service.pollRecent({ context })).resolves.toEqual({
      ok: false,
      reason: "youtube_activities_poll_failed"
    });
  });
});
