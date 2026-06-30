import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerYouTubeOwnerConsentRoutes } from "../../src/provider-integrations/youtube-owner-consent.route.js";
import type { YouTubeOwnerConsentResult } from "../../src/provider-integrations/youtube-owner-consent.types.js";

const activeCredential = {
  provider: "youtube" as const,
  purpose: "youtube_live_chat" as const,
  status: "active" as const,
  displayName: null,
  scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
  lastVerifiedAt: "2026-06-30T10:00:00.000Z",
  lastError: null,
  updatedAt: "2026-06-30T10:00:00.000Z"
};

class FakeYouTubeOwnerConsentService {
  public credentialResult: YouTubeOwnerConsentResult = {
    ok: true,
    credential: null,
    redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback",
    requiredScope: "https://www.googleapis.com/auth/youtube.readonly"
  };

  public consentResult: YouTubeOwnerConsentResult = {
    ok: true,
    credential: null,
    consentUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=signed-state",
    redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback",
    requiredScope: "https://www.googleapis.com/auth/youtube.readonly"
  };

  public completeResult: YouTubeOwnerConsentResult = {
    ok: true,
    credential: activeCredential,
    redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback",
    requiredScope: "https://www.googleapis.com/auth/youtube.readonly"
  };

  public async getCredential(): Promise<YouTubeOwnerConsentResult> {
    return this.credentialResult;
  }

  public async createConsentUrl(): Promise<YouTubeOwnerConsentResult> {
    return this.consentResult;
  }

  public async completeConsent(): Promise<YouTubeOwnerConsentResult> {
    return this.completeResult;
  }

  public getAdminRedirectUrl(result: YouTubeOwnerConsentResult): string {
    return result.ok
      ? "https://web-dev.maiks.yt/admin/provider-integrations?youtube=connected"
      : `https://web-dev.maiks.yt/admin/provider-integrations?youtube=error&reason=${result.reason}`;
  }
}

const createServer = (input: {
  service?: FakeYouTubeOwnerConsentService;
  session?: { user: { id: string } } | null;
} = {}) => {
  const server = Fastify();
  const service = input.service ?? new FakeYouTubeOwnerConsentService();

  registerYouTubeOwnerConsentRoutes(server, {
    getAuthSession: async () => "session" in input ? input.session ?? null : { user: { id: "auth-owner" } },
    getDatabasePool: () => {
      throw new Error("database should not be used by fake service");
    },
    createService: () => service
  });

  return { server, service };
};

describe("YouTube owner consent routes", () => {
  it("requires authentication for credential reads", async () => {
    const { server } = createServer({ session: null });
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/credential"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns a safe credential summary without tokens", async () => {
    const { server, service } = createServer();
    service.credentialResult = {
      ok: true,
      credential: activeCredential,
      redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback",
      requiredScope: "https://www.googleapis.com/auth/youtube.readonly"
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/credential"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      credential: {
        provider: "youtube",
        purpose: "youtube_live_chat",
        status: "active"
      }
    });
    expect(response.body).not.toContain("refresh");
    expect(response.body).not.toContain("access-token");
  });

  it("returns an owner consent URL without exposing client secrets", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/consent-url"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      consentUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=signed-state",
      redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
    });
    expect(response.body).not.toContain("secret");
  });

  it("maps forbidden consent attempts to 403", async () => {
    const { server, service } = createServer();
    service.consentResult = {
      ok: false,
      reason: "provider_integrations_forbidden"
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/consent-url"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_integrations_forbidden"
    });
  });

  it("redirects successful callbacks to the provider admin page", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/callback?code=oauth-code&state=signed-state-with-enough-length"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://web-dev.maiks.yt/admin/provider-integrations?youtube=connected");
  });

  it("redirects callback errors without leaking request details", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/callback?error=access_denied"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain("youtube=error");
    expect(response.headers.location).not.toContain("access_denied");
  });
});
