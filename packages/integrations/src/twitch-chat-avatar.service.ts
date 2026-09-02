export type TwitchChatAvatarResolver = (userId: string) => Promise<string | null>;

type TwitchChatAvatarResolverOptions = {
  authentication: { accessToken: string; clientId: string } | null;
  cacheTtlMs?: number;
  failureCacheTtlMs?: number;
  fetchFn?: typeof fetch;
  maxCacheEntries?: number;
  now?: () => number;
  requestTimeoutMs?: number;
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
  const authentication = options.authentication;
  if (!authentication) {
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
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);
      try {
        const response = await fetchFn(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${authentication.accessToken}`,
            "Client-Id": authentication.clientId
          },
          signal: abortController.signal
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
      } finally {
        clearTimeout(timeout);
      }
    })().finally(() => {
      inFlight.delete(userId);
    });

    inFlight.set(userId, lookup);
    return await lookup;
  };
};
