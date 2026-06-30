import { describe, expect, it } from "vitest";

import {
  createYouTubeOwnerConsentUrl,
  resolveYouTubeOwnerOAuthConfig,
  youtubeLiveChatReadOnlyScope
} from "./youtube-owner-oauth.rules.js";

describe("resolveYouTubeOwnerOAuthConfig", () => {
  it("uses Google OAuth client credentials with the configured redirect URI", () => {
    expect(resolveYouTubeOwnerOAuthConfig({
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      YOUTUBE_OAUTH_REDIRECT_URI: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
    })).toEqual({
      ok: true,
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
    });
  });

  it("falls back to the supplied redirect URI without exposing secrets", () => {
    expect(resolveYouTubeOwnerOAuthConfig({
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret"
    }, "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback")).toEqual({
      ok: true,
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
    });
  });

  it("reports missing OAuth credentials safely", () => {
    expect(resolveYouTubeOwnerOAuthConfig({})).toEqual({
      ok: false,
      reason: "youtube_oauth_client_missing"
    });
  });
});

describe("createYouTubeOwnerConsentUrl", () => {
  it("creates an offline read-only YouTube consent URL", () => {
    const url = new URL(createYouTubeOwnerConsentUrl({
      config: {
        ok: true,
        clientId: "google-client",
        clientSecret: "google-secret",
        redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
      },
      state: "signed-state"
    }));

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("scope")).toContain(youtubeLiveChatReadOnlyScope);
    expect(url.toString()).not.toContain("google-secret");
  });
});
