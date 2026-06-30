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

export type YouTubeOwnerConsentResult =
  | {
    ok: true;
    credential: ProviderRuntimeCredentialSummary | null;
    redirectUri: string;
    requiredScope: string;
    consentUrl?: string;
  }
  | {
    ok: false;
    reason:
      | "provider_integrations_user_unlinked"
      | "provider_integrations_forbidden"
      | "youtube_oauth_client_missing"
      | "youtube_oauth_redirect_missing"
      | "youtube_oauth_state_secret_missing"
      | "youtube_oauth_state_invalid"
      | "youtube_oauth_exchange_failed"
      | "youtube_oauth_refresh_token_missing";
  };
