import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  createYouTubeOwnerConsentUrl,
  youtubeLiveChatReadOnlyScope
} from "@maiks-yt/integrations";
import { youtubeOwnerConsentConnectPath } from "../../src/provider-integrations/provider-integrations-browser-contract.rules.js";
import { registerYouTubeOwnerConsentRoutes } from "../../src/provider-integrations/youtube-owner-consent.route.js";
import { YouTubeOwnerConsentService } from "../../src/provider-integrations/youtube-owner-consent.service.js";
import type { YouTubeOwnerConsentResult } from "../../src/provider-integrations/youtube-owner-consent.types.js";

type YouTubeOwnerConsentRouteService = Pick<
  YouTubeOwnerConsentService,
  "getCredential" | "createConsentLauncher" | "createConsentRedirectUrl" | "completeConsent" | "getAdminRedirectUrl"
>;

const activeCredential = {
  state: "connected" as const
};

class FakeYouTubeOwnerConsentService {
  public credentialResult: YouTubeOwnerConsentResult = {
    ok: true,
    credential: null,
    action: "connect"
  };

  public consentResult: YouTubeOwnerConsentResult = {
    ok: true,
    credential: null,
    connectPath: youtubeOwnerConsentConnectPath,
    action: "connect"
  };

  public redirectResult = {
    ok: true as const,
    redirectUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=signed-state"
  };

  public completeResult: YouTubeOwnerConsentResult = {
    ok: true,
    credential: activeCredential,
    action: "none"
  };

  public async getCredential(): Promise<YouTubeOwnerConsentResult> {
    return this.credentialResult;
  }

  public async createConsentLauncher(): Promise<YouTubeOwnerConsentResult> {
    return this.consentResult;
  }

  public async createConsentRedirectUrl(): Promise<typeof this.redirectResult | Extract<YouTubeOwnerConsentResult, { ok: false }>> {
    return this.redirectResult;
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

const createRepository = (permissions: readonly unknown[] = [["*"]]) => ({
  async resolveActor() {
    return {
      domainUserId: "domain-owner",
      rolePermissionValues: permissions
    };
  },
  async getYouTubeCredentialSummary() {
    return null;
  },
  async upsertYouTubeCredential() {
    throw new Error("credential writes are not used by launcher tests");
  }
});

const createServer = <Service extends YouTubeOwnerConsentRouteService = FakeYouTubeOwnerConsentService>(input: {
  service?: Service;
  session?: { user: { id: string } } | null;
} = {}) => {
  const server = Fastify();
  const service = (input.service ?? new FakeYouTubeOwnerConsentService()) as Service;

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
      action: "none"
    };

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/credential"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      credential: {
        state: "connected"
      }
    });
    expect(response.body).not.toContain("refresh");
    expect(response.body).not.toContain("access-token");
    expect(response.body).not.toContain("lastError");
    expect(response.body).not.toContain("updatedAt");
    expect(response.body).not.toContain("youtube.readonly");
    expect(response.body).not.toContain("redirectUri");
  });

  it("returns an owner consent launcher without exposing provider URLs, client ids, redirect URI, or scopes", async () => {
    const { server } = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/consent-url"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      credential: null,
      action: "connect",
      connectPath: youtubeOwnerConsentConnectPath
    });
    expect(response.body).not.toContain("secret");
    expect(response.body).not.toContain("client_id");
    expect(response.body).not.toContain("browser-contract-client-id");
    expect(response.body).not.toContain("https://accounts.google.com");
    expect(response.body).not.toContain("redirect_uri");
    expect(response.body).not.toContain("api-dev.maiks.yt/admin/provider-integrations/youtube/callback");
    expect(response.body).not.toContain("redirectUri");
    expect(response.body).not.toContain("requiredScope");
    expect(response.body).not.toContain("youtube.readonly");
  });

  it("keeps the real OAuth URL out of browser JSON while exposing only the fixed launcher path", async () => {
    const redirectUri = "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback";
    const clientId = "browser-contract-client-id.apps.googleusercontent.com";
    const service = new YouTubeOwnerConsentService(createRepository(), {
      env: {
        API_PUBLIC_BASE_URL: "https://api-dev.maiks.yt",
        PROVIDER_OAUTH_STATE_SECRET: "state-secret",
        YOUTUBE_CLIENT_ID: clientId,
        YOUTUBE_CLIENT_SECRET: "client-secret"
      },
      now: () => new Date("2026-08-27T08:00:00.000Z")
    });
    const { server } = createServer({ service });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/consent-url"
    });
    const realProviderUrl = createYouTubeOwnerConsentUrl({
      config: {
        ok: true,
        clientId,
        clientSecret: "client-secret",
        redirectUri
      },
      state: "signed-state"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      action: "connect",
      connectPath: youtubeOwnerConsentConnectPath,
      credential: null,
      ok: true
    });
    expect(response.body).not.toContain(realProviderUrl);
    expect(response.body).not.toContain(clientId);
    expect(response.body).not.toContain(redirectUri);
    expect(response.body).not.toContain("accounts.google.com");
    expect(response.body).not.toContain(youtubeLiveChatReadOnlyScope);
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

  it("requires an authenticated owner before launching provider OAuth", async () => {
    const { server } = createServer({ session: null });
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/connect"
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers.location).toBeUndefined();
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(response.body).not.toContain("accounts.google.com");
    expect(response.body).not.toContain("client_id");
    expect(response.body).not.toContain("redirect_uri");
    expect(response.body).not.toContain("youtube.readonly");
  });

  it("requires provider-integration ownership before launching provider OAuth", async () => {
    const service = new YouTubeOwnerConsentService(createRepository([]), {
      env: {
        API_PUBLIC_BASE_URL: "https://api-dev.maiks.yt",
        PROVIDER_OAUTH_STATE_SECRET: "state-secret",
        YOUTUBE_CLIENT_ID: "browser-contract-client-id.apps.googleusercontent.com",
        YOUTUBE_CLIENT_SECRET: "client-secret"
      }
    });
    const { server } = createServer({ service });
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/connect"
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers.location).toBeUndefined();
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_integrations_forbidden"
    });
  });

  it("redirects the authenticated owner launcher using the real Google OAuth URL shape", async () => {
    const redirectUri = "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback";
    const clientId = "browser-contract-client-id.apps.googleusercontent.com";
    const service = new YouTubeOwnerConsentService(createRepository(), {
      env: {
        API_PUBLIC_BASE_URL: "https://api-dev.maiks.yt",
        PROVIDER_OAUTH_STATE_SECRET: "state-secret",
        YOUTUBE_CLIENT_ID: clientId,
        YOUTUBE_CLIENT_SECRET: "client-secret"
      },
      now: () => new Date("2026-08-27T08:00:00.000Z")
    });
    const { server } = createServer({ service });
    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/youtube/connect"
    });

    expect(response.statusCode).toBe(302);
    const location = new URL(String(response.headers.location));

    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.pathname).toBe("/o/oauth2/v2/auth");
    expect(location.searchParams.get("client_id")).toBe(clientId);
    expect(location.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(location.searchParams.get("scope")).toContain(youtubeLiveChatReadOnlyScope);
    expect(location.searchParams.get("state")?.length).toBeGreaterThan(20);
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
