import { describe, expect, it } from "vitest";

import { buildYouTubePubSubTopicUrl, resolveYouTubePubSubSubscriptionTarget } from "./youtube-pubsub-subscriptions.rules.js";
import { YouTubePubSubSubscriptionService } from "./youtube-pubsub-subscriptions.service.js";

describe("YouTube PubSub subscription rules", () => {
  it("builds the official channel feed topic URL", () => {
    expect(buildYouTubePubSubTopicUrl("UC123")).toBe("https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123");
  });

  it("resolves callback and hub targets without leaking secrets", () => {
    expect(resolveYouTubePubSubSubscriptionTarget({
      channelId: "UC123",
      env: {
        API_PUBLIC_BASE_URL: "https://api-dev.maiks.yt"
      }
    })).toEqual({
      callbackUrl: "https://api-dev.maiks.yt/provider-webhooks/youtube/pubsub",
      channelId: "UC123",
      hubUrl: "https://pubsubhubbub.appspot.com/subscribe",
      topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123"
    });
  });

  it("defaults webhook delivery to the production API origin", () => {
    expect(resolveYouTubePubSubSubscriptionTarget({
      channelId: "UC123",
      env: {}
    })).toMatchObject({
      callbackUrl: "https://api.maiks.yt/provider-webhooks/youtube/pubsub"
    });
  });

  it("rejects missing or malformed channel ids", () => {
    expect(resolveYouTubePubSubSubscriptionTarget({
      channelId: "",
      env: {}
    })).toBeNull();
    expect(resolveYouTubePubSubSubscriptionTarget({
      channelId: "bad channel",
      env: {}
    })).toBeNull();
  });
});

describe("YouTubePubSubSubscriptionService", () => {
  it("requests subscribe and unsubscribe through the hub transport", async () => {
    const calls: string[] = [];
    const service = new YouTubePubSubSubscriptionService({
      env: {
        API_PUBLIC_BASE_URL: "https://api-dev.maiks.yt"
      },
      transport: {
        async requestSubscription(input) {
          calls.push(`${input.mode}:${input.topicUrl}`);
          return true;
        }
      }
    });

    await expect(service.request({ channelId: "UC123", mode: "subscribe" })).resolves.toMatchObject({
      ok: true,
      mode: "subscribe",
      state: "requested"
    });
    await expect(service.request({ channelId: "UC123", mode: "unsubscribe" })).resolves.toMatchObject({
      ok: true,
      mode: "unsubscribe",
      state: "requested"
    });
    expect(calls).toEqual([
      "subscribe:https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123",
      "unsubscribe:https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123"
    ]);
  });

  it("returns safe unavailable state when the hub request fails", async () => {
    const service = new YouTubePubSubSubscriptionService({
      transport: {
        async requestSubscription() {
          return false;
        }
      }
    });

    await expect(service.request({ channelId: "UC123", mode: "subscribe" })).resolves.toEqual({
      ok: false,
      reason: "youtube_pubsub_hub_unavailable"
    });
  });
});
