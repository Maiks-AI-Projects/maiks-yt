import type { DatabasePool } from "@maiks-yt/database";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthDataCipher,
  isKnownAuthDataEnvelope
} from "../../src/auth/auth-sensitive-field-crypto.service.js";
import {
  protectProviderRuntimeCredentialTokens,
  revealProviderRuntimeCredentialTokens
} from "../../src/provider-integrations/provider-runtime-credential-token-crypto.service.js";
import { createYouTubeChannelDiscoveryRepository } from "../../src/provider-integrations/youtube-channel-discovery-store.service.js";
import { createYouTubeLiveChatContextRepository } from "../../src/provider-integrations/youtube-live-chat-intake-control-store.service.js";
import { createYouTubeOwnerConsentRepository } from "../../src/provider-integrations/youtube-owner-consent-store.service.js";

const cipher = createAuthDataCipher(Buffer.from("h".repeat(32), "utf8"));

describe("provider runtime credential token protection", () => {
  it("encrypts both token fields with provider-specific AAD and reveals legacy or protected values", () => {
    const protectedTokens = protectProviderRuntimeCredentialTokens({
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token"
    }, cipher);

    expect(isKnownAuthDataEnvelope(protectedTokens.accessToken ?? "")).toBe(true);
    expect(isKnownAuthDataEnvelope(protectedTokens.refreshToken ?? "")).toBe(true);
    expect(revealProviderRuntimeCredentialTokens(protectedTokens, cipher)).toEqual({
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token"
    });
    expect(revealProviderRuntimeCredentialTokens({
      accessToken: "legacy-access-token",
      refreshToken: "legacy-refresh-token"
    }, cipher)).toEqual({
      accessToken: "legacy-access-token",
      refreshToken: "legacy-refresh-token"
    });
  });

  it("protects YouTube credential writes before raw SQL persistence", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{
        status: "active",
        displayName: null,
        scopes: "[]",
        lastVerifiedAt: new Date("2026-08-29T00:00:00Z"),
        lastError: null,
        updatedAt: new Date("2026-08-29T00:00:00Z")
      }], []]);
    const repository = createYouTubeOwnerConsentRepository({ execute } as never, cipher);

    await repository.upsertYouTubeCredential({
      domainUserId: "user-1",
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token",
      accessTokenExpiresAt: new Date("2026-08-29T01:00:00Z"),
      scopes: [],
      verifiedAt: new Date("2026-08-29T00:00:00Z")
    });

    const parameters = execute.mock.calls[0]?.[1] as unknown[];
    expect(isKnownAuthDataEnvelope(String(parameters[3]))).toBe(true);
    expect(isKnownAuthDataEnvelope(String(parameters[4]))).toBe(true);
  });

  it("reveals protected tokens for channel discovery", async () => {
    const protectedTokens = protectProviderRuntimeCredentialTokens({
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token"
    }, cipher);
    const execute = vi.fn().mockResolvedValue([[{
      status: "active",
      scopes: "[]",
      accessToken: protectedTokens.accessToken,
      refreshToken: protectedTokens.refreshToken,
      accessTokenExpiresAt: null,
      lastError: null
    }], []]);
    const repository = createYouTubeChannelDiscoveryRepository({
      execute,
      getConnection: vi.fn()
    } as unknown as DatabasePool, cipher);

    await expect(repository.getActiveYouTubeCredential("user-1")).resolves.toMatchObject({
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token"
    });
  });

  it("reveals protected tokens for the live-chat runtime context", async () => {
    const protectedTokens = protectProviderRuntimeCredentialTokens({
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token"
    }, cipher);
    const execute = vi.fn().mockResolvedValue([[{
      accessToken: protectedTokens.accessToken,
      refreshToken: protectedTokens.refreshToken,
      accessTokenExpiresAt: null,
      scopes: JSON.stringify(["https://www.googleapis.com/auth/youtube.readonly"]),
      channelId: "channel-1",
      channelName: "MaiksPlays",
      channelHandle: "@MaiksPlays"
    }], []]);
    const repository = createYouTubeLiveChatContextRepository({ execute } as unknown as DatabasePool, {
      apiBaseUrl: "https://api.maiks.yt",
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret"
      },
      cipher
    });

    const context = await repository.resolveSelectedLiveChatContext();

    expect(context?.credential).toMatchObject({
      accessToken: "provider-access-token",
      refreshToken: "provider-refresh-token"
    });
  });
});
