import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerYouTubeChannelDiscoveryRoutes } from "../../src/provider-integrations/youtube-channel-discovery.route.js";
import { YouTubeChannelDiscoveryService } from "../../src/provider-integrations/youtube-channel-discovery.service.js";
import type {
  YouTubeChannelDiscoveryActor,
  YouTubeChannelDiscoveryRepository,
  YouTubeChannelDiscoveryServiceResult,
  YouTubeChannelDiscoveryStoredCredential,
  YouTubePersistedChannel
} from "../../src/provider-integrations/youtube-channel-discovery.types.js";

const savedChannel: YouTubePersistedChannel = {
  id: "youtube-channel-1",
  title: "Maiks Minecraft",
  customUrl: "@maiksmc",
  thumbnailUrl: null,
  selectedForLiveChat: false,
  discoveredAt: "2026-07-04T12:00:00.000Z",
  lastSeenAt: "2026-07-04T12:00:00.000Z",
  selectedAt: null,
  updatedAt: "2026-07-04T12:00:00.000Z"
};

const browserChannel = {
  channelRef: "youtube-channel:v1:opaque-test-ref",
  selectedForLiveChat: false,
  title: "Maiks Minecraft"
};

class FakeYouTubeChannelDiscoveryService {
  public result: YouTubeChannelDiscoveryServiceResult = {
    ok: true,
    channels: [browserChannel],
    selectedChannelRef: null
  };

  public async discover(): Promise<YouTubeChannelDiscoveryServiceResult> {
    return this.result;
  }

  public async listSelection(): Promise<YouTubeChannelDiscoveryServiceResult> {
    return this.result;
  }

  public async discoverAndStore(): Promise<YouTubeChannelDiscoveryServiceResult> {
    return this.result;
  }

  public async selectLiveChatChannel(): Promise<YouTubeChannelDiscoveryServiceResult> {
    return this.result;
  }
}

const createServer = (input: {
  service?: FakeYouTubeChannelDiscoveryService;
  session?: { user: { id: string } } | null;
} = {}) => {
  const server = Fastify();
  const service = input.service ?? new FakeYouTubeChannelDiscoveryService();

  registerYouTubeChannelDiscoveryRoutes(server, {
    getAuthSession: async () => "session" in input ? input.session ?? null : { user: { id: "auth-owner" } },
    getDatabasePool: () => {
      throw new Error("database should not be used by fake service");
    },
    createService: () => service
  });

  return { server, service };
};

const createRepository = (input: {
  actor?: YouTubeChannelDiscoveryActor | null;
  credential?: YouTubeChannelDiscoveryStoredCredential | null;
  channels?: YouTubePersistedChannel[];
  selectResult?: "selected" | "cleared" | "not_found";
} = {}): YouTubeChannelDiscoveryRepository => ({
  resolveActor: async () => input.actor ?? {
    domainUserId: "domain-owner",
    rolePermissionValues: [["*"]]
  },
  getActiveYouTubeCredential: async () => input.credential ?? {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accessTokenExpiresAt: new Date("2026-07-04T10:00:00.000Z"),
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    status: "active",
    lastError: null
  },
  listYouTubeChannels: async () => input.channels ?? [savedChannel],
  upsertYouTubeChannels: async () => undefined,
  selectYouTubeLiveChatChannel: async () => input.selectResult ?? "selected"
});

describe("YouTube channel discovery routes", () => {
  it("requires authentication", async () => {
    const { server } = createServer({ session: null });
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/channels"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns sanitized channel summaries for owner access", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/channels"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    });
    expect(response.body).not.toContain("youtube-channel-1");
    expect(response.body).not.toContain("@maiksmc");
    expect(response.body).not.toContain("publishedAt");
    expect(response.body).not.toContain("refresh-token");
    expect(response.body).not.toContain("access-token");
  });

  it("maps forbidden discovery to 403", async () => {
    const { server, service } = createServer();
    service.result = {
      ok: false,
      reason: "provider_integrations_forbidden"
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/channels"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_integrations_forbidden"
    });
  });

  it("maps missing credentials to a safe conflict", async () => {
    const { server, service } = createServer();
    service.result = {
      ok: false,
      reason: "youtube_channel_credential_missing"
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/channels"
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_channel_credential_missing"
    });
  });

  it("returns safe provider failure messages without leaking token details", async () => {
    const { server, service } = createServer();
    service.result = {
      ok: false,
      reason: "youtube_channel_discovery_failed"
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/channels"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_channel_discovery_failed"
    });
    expect(response.body).not.toContain("refresh-token");
    expect(response.body).not.toContain("access-token");
  });

  it("returns saved channel selection state", async () => {
    const { server, service } = createServer();
    service.result = {
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/channel-selection"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    });
    expect(response.body).not.toContain("youtube-channel-1");
    expect(response.body).not.toContain("discoveredAt");
    expect(response.body).not.toContain("lastSeenAt");
  });

  it("persists discovered channels through the discover-and-store endpoint", async () => {
    const { server, service } = createServer();
    service.result = {
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    };

    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube/channel-selection/discover"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    });
  });

  it("selects a saved live-chat channel", async () => {
    const selectedChannel = {
      ...savedChannel,
      selectedForLiveChat: true,
      selectedAt: "2026-07-04T12:05:00.000Z"
    };
    const { server, service } = createServer();
    service.result = {
      ok: true,
      channels: [{
        ...browserChannel,
        selectedForLiveChat: true
      }],
      selectedChannelRef: browserChannel.channelRef
    };

    const response = await server.inject({
      method: "PUT",
      url: "/admin/provider-integrations/youtube/channel-selection",
      payload: {
        channelRef: browserChannel.channelRef
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      channels: [{
        ...browserChannel,
        selectedForLiveChat: true
      }],
      selectedChannelRef: browserChannel.channelRef
    });
    expect(response.body).not.toContain(selectedChannel.id);
  });

  it("clears a selected live-chat channel", async () => {
    const { server, service } = createServer();
    service.result = {
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    };

    const response = await server.inject({
      method: "PUT",
      url: "/admin/provider-integrations/youtube/channel-selection",
      payload: {
        channelRef: null
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      channels: [browserChannel],
      selectedChannelRef: null
    });
  });

  it("rejects malformed selection input", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "PUT",
      url: "/admin/provider-integrations/youtube/channel-selection",
      payload: {
        channelRef: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_channel_invalid_input"
    });
  });
});

describe("YouTubeChannelDiscoveryService", () => {
  it("discovers channels through the stored credential", async () => {
    const service = new YouTubeChannelDiscoveryService(createRepository(), {
      env: {
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret"
      },
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      listChannels: async ({ credential }) => {
        expect(credential.refreshToken).toBe("refresh-token");
        return {
          items: [
            {
              id: "youtube-channel-1",
              snippet: {
                title: "Maiks Minecraft"
              }
            }
          ]
        };
      }
    });

    await expect(service.discover({ authUserId: "auth-owner" })).resolves.toEqual({
      ok: true,
      channels: [{
        channelRef: null,
        selectedForLiveChat: false,
        title: "Maiks Minecraft",
      }],
      selectedChannelRef: null
    });
  });

  it("rejects actors without provider integration rights", async () => {
    const service = new YouTubeChannelDiscoveryService(createRepository({
      actor: {
        domainUserId: "domain-user",
        rolePermissionValues: [["chat:moderate"]]
      }
    }));

    await expect(service.discover({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "provider_integrations_forbidden"
    });
  });

  it("requires a stored active credential with the readonly YouTube scope", async () => {
    const service = new YouTubeChannelDiscoveryService(createRepository({
      credential: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        accessTokenExpiresAt: null,
        scopes: ["https://www.googleapis.com/auth/userinfo.email"],
        status: "active",
        lastError: null
      }
    }));

    await expect(service.discover({ authUserId: "auth-owner" })).resolves.toEqual({
      ok: false,
      reason: "youtube_channel_scope_missing"
    });
  });

  it("discovers and stores channels before returning selection state", async () => {
    const storedChannels: YouTubePersistedChannel[] = [{
      ...savedChannel,
      lastSeenAt: "2026-07-04T12:00:00.000Z"
    }];
    const service = new YouTubeChannelDiscoveryService(createRepository({
      channels: storedChannels
    }), {
      env: {
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret"
      },
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      listChannels: async () => ({
        items: [
          {
            id: savedChannel.id,
            snippet: {
              title: savedChannel.title,
              customUrl: savedChannel.customUrl
            }
          }
        ]
      })
    });

    const result = await service.discoverAndStore({ authUserId: "auth-owner" });
    expect(result).toMatchObject({
      ok: true,
      channels: [{
        channelRef: expect.stringMatching(/^youtube-channel:v1:/),
        selectedForLiveChat: false,
        title: "Maiks Minecraft"
      }],
      selectedChannelRef: null
    });
    expect(JSON.stringify(result)).not.toContain("youtube-channel-1");
    expect(JSON.stringify(result)).not.toContain("@maiksmc");
    expect(JSON.stringify(result)).not.toContain("lastSeenAt");
  });

  it("selects and clears the persisted live-chat channel", async () => {
    const selectedChannel = {
      ...savedChannel,
      selectedForLiveChat: true,
      selectedAt: "2026-07-04T12:05:00.000Z"
    };
    const service = new YouTubeChannelDiscoveryService(createRepository({
      channels: [selectedChannel],
      selectResult: "selected"
    }), {
      now: () => new Date("2026-07-04T12:05:00.000Z")
    });

    const listResult = await service.listSelection({ authUserId: "auth-owner" });
    const channelRef = listResult.ok ? listResult.channels[0]?.channelRef : null;

    expect(channelRef).toMatch(/^youtube-channel:v1:/);
    await expect(service.selectLiveChatChannel({
      authUserId: "auth-owner",
      channelRef
    })).resolves.toMatchObject({
      ok: true,
      channels: [{
        channelRef,
        selectedForLiveChat: true,
        title: "Maiks Minecraft"
      }],
      selectedChannelRef: channelRef
    });
  });

  it("rejects selecting an unknown persisted channel", async () => {
    const service = new YouTubeChannelDiscoveryService(createRepository({
      selectResult: "not_found"
    }));

    await expect(service.selectLiveChatChannel({
      authUserId: "auth-owner",
      channelRef: "youtube-channel:v1:unknown"
    })).resolves.toEqual({
      ok: false,
      reason: "youtube_channel_not_found"
    });
  });
});
