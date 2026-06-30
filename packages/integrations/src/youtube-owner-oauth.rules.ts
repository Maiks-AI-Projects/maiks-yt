import { google } from "googleapis";

import type {
  YouTubeOwnerOAuthConfig,
  YouTubeOwnerOAuthEnvironment,
  YouTubeOwnerOAuthTokenResult
} from "./youtube-owner-oauth.types.js";

export const youtubeLiveChatReadOnlyScope = "https://www.googleapis.com/auth/youtube.readonly";

const trimToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

export const resolveYouTubeOwnerOAuthConfig = (
  env: YouTubeOwnerOAuthEnvironment,
  fallbackRedirectUri?: string
): YouTubeOwnerOAuthConfig => {
  const clientId = trimToNull(env.YOUTUBE_CLIENT_ID) ?? trimToNull(env.GOOGLE_CLIENT_ID);
  const clientSecret = trimToNull(env.YOUTUBE_CLIENT_SECRET) ?? trimToNull(env.GOOGLE_CLIENT_SECRET);
  const redirectUri = trimToNull(env.YOUTUBE_OAUTH_REDIRECT_URI) ?? trimToNull(fallbackRedirectUri);

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      reason: "youtube_oauth_client_missing"
    };
  }

  if (!redirectUri) {
    return {
      ok: false,
      reason: "youtube_oauth_redirect_missing"
    };
  }

  return {
    ok: true,
    clientId,
    clientSecret,
    redirectUri
  };
};

export const createYouTubeOwnerConsentUrl = (input: {
  config: Extract<YouTubeOwnerOAuthConfig, { ok: true }>;
  state: string;
}): string => {
  const client = new google.auth.OAuth2(
    input.config.clientId,
    input.config.clientSecret,
    input.config.redirectUri
  );

  return client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: [youtubeLiveChatReadOnlyScope],
    state: input.state
  });
};

export const exchangeYouTubeOwnerCode = async (input: {
  code: string;
  config: Extract<YouTubeOwnerOAuthConfig, { ok: true }>;
}): Promise<YouTubeOwnerOAuthTokenResult> => {
  const client = new google.auth.OAuth2(
    input.config.clientId,
    input.config.clientSecret,
    input.config.redirectUri
  );

  try {
    const { tokens } = await client.getToken(input.code);
    const scopes = typeof tokens.scope === "string"
      ? tokens.scope.split(/\s+/).filter((scope) => scope.length > 0)
      : [youtubeLiveChatReadOnlyScope];

    if (!tokens.refresh_token) {
      return {
        ok: false,
        reason: "youtube_oauth_refresh_token_missing"
      };
    }

    return {
      ok: true,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token,
      expiresAt: typeof tokens.expiry_date === "number" ? new Date(tokens.expiry_date) : null,
      scopes
    };
  } catch {
    return {
      ok: false,
      reason: "youtube_oauth_exchange_failed"
    };
  }
};
