export type YouTubeOwnerOAuthEnvironment = Record<string, string | undefined>;

export type YouTubeOwnerOAuthConfig =
  | {
    ok: true;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }
  | {
    ok: false;
    reason: "youtube_oauth_client_missing" | "youtube_oauth_redirect_missing";
  };

export type YouTubeOwnerOAuthTokenResult =
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
  };
