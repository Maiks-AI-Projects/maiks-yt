import { describe, expect, it } from "vitest";

import {
  projectYouTubePubSubFeed,
  resolveYouTubePubSubVerification
} from "./youtube-pubsub-webhook.rules.js";

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
  <link rel="self" href="https://www.youtube.com/xml/feeds/videos.xml?channel_id=channel-1"/>
  <title>YouTube video feed</title>
  <updated>2026-07-05T00:50:00+00:00</updated>
  <entry>
    <id>yt:video:video-1</id>
    <yt:videoId>video-1</yt:videoId>
    <yt:channelId>channel-1</yt:channelId>
    <title>Video title</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=video-1"/>
    <author>
      <name>MaiksMC</name>
      <uri>https://www.youtube.com/channel/channel-1</uri>
    </author>
    <published>2026-07-05T00:40:00+00:00</published>
    <updated>2026-07-05T00:50:00+00:00</updated>
  </entry>
</feed>`;

describe("resolveYouTubePubSubVerification", () => {
  it("returns the verification challenge for subscribe and unsubscribe checks", () => {
    expect(resolveYouTubePubSubVerification({
      challenge: "challenge-value",
      mode: "subscribe",
      topic: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=channel-1"
    })).toEqual({
      challenge: "challenge-value",
      mode: "subscribe",
      ok: true,
      topic: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=channel-1"
    });
  });

  it("rejects incomplete verification requests", () => {
    expect(resolveYouTubePubSubVerification({
      challenge: "challenge-value",
      mode: "subscribe"
    })).toEqual({
      ok: false,
      reason: "missing_topic"
    });
  });
});

describe("projectYouTubePubSubFeed", () => {
  it("projects Atom entries into provider intake events", () => {
    expect(projectYouTubePubSubFeed({
      rawBody: feed,
      receivedAt: new Date("2026-07-05T00:55:00.000Z"),
      topic: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=channel-1"
    })).toEqual({
      ok: true,
      events: [
        expect.objectContaining({
          actorDisplayName: "MaiksMC",
          actorExternalId: "channel-1",
          channelId: "channel-1",
          mechanism: "youtube-pubsub",
          providerEventName: "video.title.update",
          providerMessageId: "video-1",
          source: "youtube",
          sourceEventId: "youtube-pubsub:channel-1:video-1:video.title.update",
          videoId: "video-1"
        })
      ]
    });
  });

  it("rejects malformed or empty feeds", () => {
    expect(projectYouTubePubSubFeed({
      rawBody: "<not-feed />"
    })).toEqual({
      ok: false,
      reason: "invalid_xml"
    });

    expect(projectYouTubePubSubFeed({
      rawBody: "<feed />"
    })).toEqual({
      ok: false,
      reason: "invalid_xml"
    });
  });
});
