import type { YouTubeOwnerConsentBrowserResult } from "./provider-integrations-browser-contract.rules.js";

export type ProviderRuntimeCredentialActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ProviderRuntimeCredentialSummary = {
  provider: "youtube";
  purpose: "youtube_live_chat";
  status: "active" | "revoked" | "error";
  displayName: string | null;
  scopes: readonly string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type YouTubeOwnerConsentRepository = {
  resolveActor(authUserId: string): Promise<ProviderRuntimeCredentialActor | null>;
  getYouTubeCredentialSummary(domainUserId: string): Promise<ProviderRuntimeCredentialSummary | null>;
  upsertYouTubeCredential(input: {
    domainUserId: string;
    accessToken: string | null;
    refreshToken: string;
    accessTokenExpiresAt: Date | null;
    scopes: readonly string[];
    verifiedAt: Date;
  }): Promise<ProviderRuntimeCredentialSummary>;
};

export type YouTubeOwnerConsentExchangeCode = (input: {
  code: string;
  redirectUri: string;
}) => Promise<
  | {
    ok: true;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: readonly string[];
  }
  | {
    ok: false;
    reason: "youtube_oauth_exchange_failed" | "youtube_oauth_refresh_token_missing";
  }
>;

export type { YouTubeOwnerConsentBrowserResult as YouTubeOwnerConsentResult } from "./provider-integrations-browser-contract.rules.js";

export type YouTubeOwnerConsentRedirectResult =
  | {
    ok: true;
    redirectUrl: string;
  }
  | Extract<YouTubeOwnerConsentBrowserResult, { ok: false }>;
