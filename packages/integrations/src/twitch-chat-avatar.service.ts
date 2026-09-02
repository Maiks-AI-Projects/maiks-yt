export type TwitchChatAvatarResolver = (userId: string) => Promise<string | null>;

type TwitchChatAvatarResolverOptions = {
  appAuthentication?: { clientId: string; clientSecret: string } | null;
  authentication: { accessToken: string; clientId: string } | null;
  cacheTtlMs?: number;
  failureCacheTtlMs?: number;
  fetchFn?: typeof fetch;
  maxCacheEntries?: number;
  now?: () => number;
  requestTimeoutMs?: number;
};

type TwitchAccessTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type TwitchUserResponse = {
  data?: Array<{
    id?: unknown;
    profile_image_url?: unknown;
  }>;
};

const normalizeUserId = (value: string): string | null => {
  const normalized = value.trim();
  return /^\d{1,32}$/.test(normalized) ? normalized : null;
};

const normalizeAvatarUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 2_048) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};

export const createTwitchChatAvatarResolver = (
  options: TwitchChatAvatarResolverOptions
): TwitchChatAvatarResolver | null => {
  const appAuthentication = options.appAuthentication ?? null;
  const authentication = options.authentication;
  if (!appAuthentication && !authentication) {
    return null;
  }

  const cacheTtlMs = options.cacheTtlMs ?? 6 * 60 * 60 * 1_000;
  const failureCacheTtlMs = options.failureCacheTtlMs ?? 60_000;
  const fetchFn = options.fetchFn ?? fetch;
  const maxCacheEntries = Math.max(1, options.maxCacheEntries ?? 500);
  const now = options.now ?? Date.now;
  const requestTimeoutMs = Math.max(100, options.requestTimeoutMs ?? 1_500);
  const cache = new Map<string, { avatarUrl: string | null; expiresAt: number }>();
  const inFlight = new Map<string, Promise<string | null>>();
  let appAccessToken: { accessToken: string; expiresAt: number } | null = null;
  let appAccessTokenFlight: Promise<string | null> | null = null;

  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);
    try {
      return await fetchFn(url, {
        ...init,
        signal: abortController.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const getAppAccessToken = async (): Promise<string | null> => {
    if (!appAuthentication) {
      return null;
    }

    if (appAccessToken && appAccessToken.expiresAt > now()) {
      return appAccessToken.accessToken;
    }
    appAccessToken = null;

    if (appAccessTokenFlight) {
      return await appAccessTokenFlight;
    }

    const flight = (async (): Promise<string | null> => {
      try {
        const response = await request("https://id.twitch.tv/oauth2/token", {
          body: new URLSearchParams({
            client_id: appAuthentication.clientId,
            client_secret: appAuthentication.clientSecret,
            grant_type: "client_credentials"
          }),
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          },
          method: "POST"
        });
        if (!response.ok) {
          return null;
        }

        const payload = await response.json() as TwitchAccessTokenResponse;
        const accessToken = typeof payload.access_token === "string"
          ? payload.access_token.trim()
          : "";
        const expiresInSeconds = payload.expires_in;
        if (!accessToken
          || typeof expiresInSeconds !== "number"
          || !Number.isSafeInteger(expiresInSeconds)
          || expiresInSeconds <= 0) {
          return null;
        }

        appAccessToken = {
          accessToken,
          expiresAt: now() + Math.max(0, (expiresInSeconds * 1_000) - 60_000)
        };
        return accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      appAccessTokenFlight = null;
    });
    appAccessTokenFlight = flight;
    return await flight;
  };

  const remember = (userId: string, avatarUrl: string | null): string | null => {
    cache.delete(userId);
    cache.set(userId, {
      avatarUrl,
      expiresAt: now() + (avatarUrl ? cacheTtlMs : failureCacheTtlMs)
    });
    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      cache.delete(oldest);
    }
    return avatarUrl;
  };

  return async (rawUserId) => {
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
      return null;
    }

    const cached = cache.get(userId);
    if (cached && cached.expiresAt > now()) {
      return cached.avatarUrl;
    }
    cache.delete(userId);

    const pending = inFlight.get(userId);
    if (pending) {
      return await pending;
    }

    const lookup = (async (): Promise<string | null> => {
      try {
        const appToken = await getAppAccessToken();
        const helixAuthentication = appToken && appAuthentication
          ? { accessToken: appToken, clientId: appAuthentication.clientId }
          : authentication;
        if (!helixAuthentication) {
          return remember(userId, null);
        }

        const response = await request(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${helixAuthentication.accessToken}`,
            "Client-Id": helixAuthentication.clientId
          }
        });
        if (!response.ok) {
          return remember(userId, null);
        }

        const payload = await response.json() as TwitchUserResponse;
        const user = Array.isArray(payload.data)
          ? payload.data.find((candidate) => candidate.id === userId)
          : undefined;
        return remember(userId, normalizeAvatarUrl(user?.profile_image_url));
      } catch {
        return remember(userId, null);
      }
    })().finally(() => {
      inFlight.delete(userId);
    });

    inFlight.set(userId, lookup);
    return await lookup;
  };
};
