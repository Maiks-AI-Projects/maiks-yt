import { describe, expect, it } from "vitest";

import {
  discoverYouTubeChannels,
  projectYouTubeDiscoveredChannels
} from "./youtube-channel-discovery.rules.js";

const config = {
  ok: true as const,
  clientId: "google-client",
  clientSecret: "google-secret",
  redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
};

const credential = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  accessTokenExpiresAt: new Date("2026-07-04T10:00:00.000Z")
};

describe("projectYouTubeDiscoveredChannels", () => {
  it("sanitizes channel summaries and filters unusable rows", () => {
    expect(projectYouTubeDiscoveredChannels({
      items: [
        {
          id: " channel-1 ",
          snippet: {
            title: " Maiks Minecraft ",
            customUrl: " @maiksmc ",
            publishedAt: "2020-01-02T03:04:05Z",
            thumbnails: {
              default: {
                url: " https://i.ytimg.com/default.jpg "
              }
            }
          }
        },
        {
          id: "missing-title",
          snippet: {
            title: " "
          }
        },
        {
          id: " ",
          snippet: {
            title: "Missing id"
          }
        }
      ]
    })).toEqual([{
      id: "channel-1",
      title: "Maiks Minecraft",
      customUrl: "@maiksmc",
      thumbnailUrl: "https://i.ytimg.com/default.jpg",
      publishedAt: "2020-01-02T03:04:05.000Z"
    }]);
  });

  it("uses nulls for optional channel fields", () => {
    expect(projectYouTubeDiscoveredChannels({
      items: [
        {
          id: "channel-2",
          snippet: {
            title: "Dev Channel",
            publishedAt: "not-a-date"
          }
        }
      ]
    })).toEqual([{
      id: "channel-2",
      title: "Dev Channel",
      customUrl: null,
      thumbnailUrl: null,
      publishedAt: null
    }]);
  });
});

describe("discoverYouTubeChannels", () => {
  it("returns sanitized channel summaries without exposing tokens", async () => {
    const result = await discoverYouTubeChannels({
      config,
      credential,
      now: new Date("2026-07-04T12:00:00.000Z"),
      listChannels: async () => ({
        items: [
          {
            id: "channel-1",
            snippet: {
              title: "Maiks Minecraft"
            }
          }
        ]
      })
    });

    expect(result).toEqual({
      ok: true,
      channels: [{
        id: "channel-1",
        title: "Maiks Minecraft",
        customUrl: null,
        thumbnailUrl: null,
        publishedAt: null
      }],
      discoveredAt: "2026-07-04T12:00:00.000Z"
    });
    expect(JSON.stringify(result)).not.toContain("refresh-token");
    expect(JSON.stringify(result)).not.toContain("access-token");
  });

  it("maps provider failures to a safe reason", async () => {
    await expect(discoverYouTubeChannels({
      config,
      credential,
      listChannels: async () => {
        throw new Error("token=refresh-token");
      }
    })).resolves.toEqual({
      ok: false,
      reason: "youtube_channel_discovery_failed"
    });
  });
});
