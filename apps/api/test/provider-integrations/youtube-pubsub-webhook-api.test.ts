import type { YouTubePubSubProjectedEvent } from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerYouTubePubSubWebhookRoutes } from "../../src/provider-integrations/youtube-pubsub-webhook.route.js";

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
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

class FakeIntakeLogService {
  public readonly recordProviderEvent = vi.fn(async (_event: YouTubePubSubProjectedEvent) => ({
    inserted: true,
    ok: true as const
  }));
}

const createServer = (service = new FakeIntakeLogService()) => {
  const server = Fastify();
  registerYouTubePubSubWebhookRoutes(server, {
    intakeLogService: service
  });
  return { server, service };
};

describe("YouTube PubSub webhook route", () => {
  it("returns the hub challenge for subscription verification", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/provider-webhooks/youtube/pubsub?hub.mode=subscribe&hub.topic=https%3A%2F%2Fwww.youtube.com%2Fxml%2Ffeeds%2Fvideos.xml%3Fchannel_id%3Dchannel-1&hub.challenge=challenge-value"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("challenge-value");
  });

  it("logs Atom feed entries into provider intake", async () => {
    const { server, service } = createServer();
    const response = await server.inject({
      headers: {
        "content-type": "application/atom+xml"
      },
      method: "POST",
      payload: feed,
      url: "/provider-webhooks/youtube/pubsub?hub.topic=https%3A%2F%2Fwww.youtube.com%2Fxml%2Ffeeds%2Fvideos.xml%3Fchannel_id%3Dchannel-1"
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(service.recordProviderEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorDisplayName: "MaiksMC",
      channelId: "channel-1",
      mechanism: "youtube-pubsub",
      providerEventName: "video.title.update",
      providerMessageId: "video-1",
      source: "youtube"
    }));
  });

  it("rejects invalid verification and malformed feeds", async () => {
    const { server } = createServer();
    const verifyResponse = await server.inject({
      method: "GET",
      url: "/provider-webhooks/youtube/pubsub?hub.mode=subscribe&hub.challenge=challenge-value"
    });
    const postResponse = await server.inject({
      headers: {
        "content-type": "application/atom+xml"
      },
      method: "POST",
      payload: "<not-feed />",
      url: "/provider-webhooks/youtube/pubsub"
    });

    expect(verifyResponse.statusCode).toBe(400);
    expect(verifyResponse.json()).toEqual({
      ok: false,
      reason: "youtube_pubsub_missing_topic"
    });
    expect(postResponse.statusCode).toBe(400);
    expect(postResponse.json()).toEqual({
      ok: false,
      reason: "youtube_pubsub_invalid_xml"
    });
  });

  it("returns a safe write failure without leaking payload data", async () => {
    const service = new FakeIntakeLogService();
    service.recordProviderEvent.mockResolvedValueOnce({
      ok: false,
      reason: "write_failed"
    });
    const { server } = createServer(service);
    const response = await server.inject({
      headers: {
        "content-type": "application/atom+xml"
      },
      method: "POST",
      payload: feed,
      url: "/provider-webhooks/youtube/pubsub"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_pubsub_write_failed"
    });
    expect(response.body).not.toContain("Video title");
  });
});
