import { describe, expect, it } from "vitest";

import { YouTubeOwnerConsentService } from "../../src/provider-integrations/youtube-owner-consent.service.js";
import type { YouTubeOwnerConsentRepository } from "../../src/provider-integrations/youtube-owner-consent.types.js";

const createRepository = (): YouTubeOwnerConsentRepository => ({
  async resolveActor() {
    return {
      domainUserId: "domain-owner",
      rolePermissionValues: [["*"]]
    };
  },
  async getYouTubeCredentialSummary() {
    return null;
  },
  async upsertYouTubeCredential() {
    throw new Error("credential writes are not used in this test");
  }
});

describe("YouTubeOwnerConsentService production origins", () => {
  it("uses production callback and admin return origins when optional configuration is omitted", async () => {
    const repository = createRepository();
    const service = new YouTubeOwnerConsentService(repository, { env: {} });

    await expect(service.getCredential({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      action: "connect",
      credential: null
    });
    expect(service.getAdminRedirectUrl({
      ok: false,
      reason: "youtube_oauth_exchange_failed"
    })).toBe("https://maiks.yt/admin/provider-integrations?youtube=error&reason=youtube_oauth_exchange_failed");
  });

  it("keeps explicitly configured callback and admin return origins authoritative", async () => {
    const repository = createRepository();
    const service = new YouTubeOwnerConsentService(repository, {
      env: {
        API_PUBLIC_BASE_URL: "https://api-preview.example.test",
        WEB_PUBLIC_BASE_URL: "https://preview.example.test"
      }
    });

    await expect(service.getCredential({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      action: "connect",
      credential: null
    });
    expect(service.getAdminRedirectUrl({
      ok: false,
      reason: "youtube_oauth_exchange_failed"
    })).toBe("https://preview.example.test/admin/provider-integrations?youtube=error&reason=youtube_oauth_exchange_failed");
  });
});
