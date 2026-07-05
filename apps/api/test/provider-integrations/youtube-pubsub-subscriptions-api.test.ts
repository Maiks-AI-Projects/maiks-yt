import type {
  YouTubePubSubSubscriptionRequestResult,
  YouTubePubSubSubscriptionStatusResult
} from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerYouTubePubSubSubscriptionRoutes } from "../../src/provider-integrations/youtube-pubsub-subscriptions.route.js";
import { YouTubePubSubSubscriptionControlService } from "../../src/provider-integrations/youtube-pubsub-subscriptions.service.js";
import type {
  YouTubePubSubSelectedChannel,
  YouTubePubSubSubscriptionActor,
  YouTubePubSubSubscriptionRepository
} from "../../src/provider-integrations/youtube-pubsub-subscriptions.types.js";

class FakeYouTubePubSubRepository implements YouTubePubSubSubscriptionRepository {
  public actor: YouTubePubSubSubscriptionActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public selectedChannel: YouTubePubSubSelectedChannel | null = {
    id: "UC123",
    title: "Maiks Minecraft"
  };

  public async resolveActor(): Promise<YouTubePubSubSubscriptionActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async getSelectedYouTubeChannel(): Promise<YouTubePubSubSelectedChannel | null> {
    return this.selectedChannel ? structuredClone(this.selectedChannel) : null;
  }
}

class FakeYouTubePubSubProviderService {
  public requests: string[] = [];

  public getStatus(input: { channelId: string | null }): YouTubePubSubSubscriptionStatusResult {
    if (!input.channelId) {
      return {
        ok: false,
        reason: "youtube_pubsub_channel_missing"
      };
    }

    return {
      ok: true,
      callbackUrl: "https://api-dev.maiks.yt/provider-webhooks/youtube/pubsub",
      channelId: input.channelId,
      hubUrl: "https://pubsubhubbub.appspot.com/subscribe",
      readOnly: true,
      state: "ready",
      topicUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${input.channelId}`
    };
  }

  public async request(input: {
    channelId: string | null;
    mode: "subscribe" | "unsubscribe";
  }): Promise<YouTubePubSubSubscriptionRequestResult> {
    const status = this.getStatus({ channelId: input.channelId });

    if (!status.ok) {
      return status;
    }

    this.requests.push(input.mode);

    return {
      ...status,
      mode: input.mode,
      state: "requested"
    };
  }
}

describe("YouTubePubSubSubscriptionControlService", () => {
  it("allows owner wildcard to read status and request subscribe/unsubscribe", async () => {
    const providerService = new FakeYouTubePubSubProviderService();
    const service = new YouTubePubSubSubscriptionControlService(
      new FakeYouTubePubSubRepository(),
      providerService
    );

    await expect(service.getStatus({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      channelId: "UC123",
      readOnly: true,
      state: "ready"
    });
    await expect(service.subscribe({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      mode: "subscribe",
      state: "requested"
    });
    await expect(service.unsubscribe({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      mode: "unsubscribe",
      state: "requested"
    });
    expect(providerService.requests).toEqual(["subscribe", "unsubscribe"]);
  });

  it("denies unlinked and non-provider-management users", async () => {
    const repository = new FakeYouTubePubSubRepository();
    const service = new YouTubePubSubSubscriptionControlService(repository, new FakeYouTubePubSubProviderService());

    repository.actor = null;
    await expect(service.getStatus({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "youtube_pubsub_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.subscribe({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "youtube_pubsub_forbidden"
    });
  });

  it("fails closed when no selected YouTube channel exists", async () => {
    const repository = new FakeYouTubePubSubRepository();
    repository.selectedChannel = null;
    const service = new YouTubePubSubSubscriptionControlService(repository, new FakeYouTubePubSubProviderService());

    await expect(service.subscribe({ authUserId: "auth-owner" })).resolves.toEqual({
      ok: false,
      reason: "youtube_pubsub_channel_missing"
    });
  });
});

describe("YouTube PubSub subscription routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerYouTubePubSubSubscriptionRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new YouTubePubSubSubscriptionControlService(
        new FakeYouTubePubSubRepository(),
        new FakeYouTubePubSubProviderService()
      )
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube-pubsub/subscription"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("reads status and requests subscribe/unsubscribe through authenticated owner routes", async () => {
    const server = Fastify();
    const providerService = new FakeYouTubePubSubProviderService();
    const service = new YouTubePubSubSubscriptionControlService(
      new FakeYouTubePubSubRepository(),
      providerService
    );

    registerYouTubePubSubSubscriptionRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const statusResponse = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube-pubsub/subscription"
    });
    const subscribeResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-pubsub/subscribe"
    });
    const unsubscribeResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-pubsub/unsubscribe"
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({
      ok: true,
      channelId: "UC123",
      state: "ready"
    });
    expect(subscribeResponse.statusCode).toBe(200);
    expect(subscribeResponse.json()).toMatchObject({
      ok: true,
      mode: "subscribe"
    });
    expect(unsubscribeResponse.statusCode).toBe(200);
    expect(unsubscribeResponse.json()).toMatchObject({
      ok: true,
      mode: "unsubscribe"
    });
    expect(providerService.requests).toEqual(["subscribe", "unsubscribe"]);
  });

  it("returns safe errors without leaking thrown values", async () => {
    const server = Fastify();
    const service = {
      getStatus: vi.fn(async () => {
        throw new Error("secret-youtube-token-value exploded");
      }),
      subscribe: vi.fn(async () => {
        throw new Error("secret-youtube-token-value exploded");
      }),
      unsubscribe: vi.fn(async () => {
        throw new Error("secret-youtube-token-value exploded");
      })
    };

    registerYouTubePubSubSubscriptionRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-pubsub/subscribe"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_pubsub_unavailable"
    });
    expect(response.body).not.toContain("secret-youtube-token-value");
  });
});
