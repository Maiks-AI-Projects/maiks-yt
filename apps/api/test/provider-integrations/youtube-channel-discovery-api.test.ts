import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerYouTubeChannelDiscoveryRoutes } from "../../src/provider-integrations/youtube-channel-discovery.route.js";
import { YouTubeChannelDiscoveryService } from "../../src/provider-integrations/youtube-channel-discovery.service.js";
import type {
  YouTubeChannelDiscoveryActor,
  YouTubeChannelDiscoveryRepository,
  YouTubeChannelDiscoveryServiceResult,
  YouTubeChannelDiscoveryStoredCredential
} from "../../src/provider-integrations/youtube-channel-discovery.types.js";

class FakeYouTubeChannelDiscoveryService {
  public result: YouTubeChannelDiscoveryServiceResult = {
    ok: true,
    channels: [{
      id: "youtube-channel-1",
      title: "Maiks Minecraft",
      customUrl: "@maiksmc",
      thumbnailUrl: null,
      publishedAt: null
    }],
    discoveredAt: "2026-07-04T12:00:00.000Z"
  };

  public async discover(): Promise<YouTubeChannelDiscoveryServiceResult> {
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
  }
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
      channels: [{
        id: "youtube-channel-1",
        title: "Maiks Minecraft",
        customUrl: "@maiksmc",
        thumbnailUrl: null,
        publishedAt: null
      }],
      discoveredAt: "2026-07-04T12:00:00.000Z"
    });
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
        id: "youtube-channel-1",
        title: "Maiks Minecraft",
        customUrl: null,
        thumbnailUrl: null,
        publishedAt: null
      }],
      discoveredAt: "2026-07-04T12:00:00.000Z"
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
});
