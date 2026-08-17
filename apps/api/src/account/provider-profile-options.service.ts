export type ProviderProfileAccount = {
  id: string;
  providerId: string;
  accessToken: string | null;
};

export type ProviderProfileOption = {
  accountId: string;
  providerId: string;
  displayName: string;
  email: string | null;
  imageUrl: string | null;
};

type FetchImplementation = typeof fetch;

const requestJson = async (
  url: string,
  headers: Record<string, string>,
  fetchImplementation: FetchImplementation
): Promise<Record<string, unknown> | null> => {
  try {
    const response = await fetchImplementation(url, {
      headers,
      signal: AbortSignal.timeout(5_000)
    });

    if (!response.ok) {
      return null;
    }

    const value = await response.json() as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const fetchGoogleProfile = async (
  account: ProviderProfileAccount,
  fetchImplementation: FetchImplementation
): Promise<ProviderProfileOption | null> => {
  const profile = await requestJson(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { Authorization: `Bearer ${account.accessToken}` },
    fetchImplementation
  );
  const displayName = readString(profile?.name);

  return displayName ? {
    accountId: account.id,
    providerId: account.providerId,
    displayName,
    email: readString(profile?.email),
    imageUrl: readString(profile?.picture)
  } : null;
};

const fetchGitHubProfile = async (
  account: ProviderProfileAccount,
  fetchImplementation: FetchImplementation
): Promise<ProviderProfileOption | null> => {
  const profile = await requestJson("https://api.github.com/user", {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${account.accessToken}`,
    "User-Agent": "Maiks.yt"
  }, fetchImplementation);
  const displayName = readString(profile?.login);

  return displayName ? {
    accountId: account.id,
    providerId: account.providerId,
    displayName,
    email: readString(profile?.email),
    imageUrl: readString(profile?.avatar_url)
  } : null;
};

const fetchDiscordProfile = async (
  account: ProviderProfileAccount,
  fetchImplementation: FetchImplementation
): Promise<ProviderProfileOption | null> => {
  const profile = await requestJson(
    "https://discord.com/api/v10/users/@me",
    { Authorization: `Bearer ${account.accessToken}` },
    fetchImplementation
  );
  const id = readString(profile?.id);
  const avatar = readString(profile?.avatar);
  const displayName = readString(profile?.global_name) ?? readString(profile?.username);

  return displayName ? {
    accountId: account.id,
    providerId: account.providerId,
    displayName,
    email: readString(profile?.email),
    imageUrl: id && avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=512`
      : null
  } : null;
};

const fetchTwitchProfile = async (
  account: ProviderProfileAccount,
  twitchClientId: string | undefined,
  fetchImplementation: FetchImplementation
): Promise<ProviderProfileOption | null> => {
  if (!twitchClientId) {
    return null;
  }

  const response = await requestJson("https://api.twitch.tv/helix/users", {
    Authorization: `Bearer ${account.accessToken}`,
    "Client-Id": twitchClientId
  }, fetchImplementation);
  const profile = Array.isArray(response?.data)
    ? response.data[0] as Record<string, unknown> | undefined
    : undefined;
  const displayName = readString(profile?.display_name) ?? readString(profile?.login);

  return displayName ? {
    accountId: account.id,
    providerId: account.providerId,
    displayName,
    email: readString(profile?.email),
    imageUrl: readString(profile?.profile_image_url)
  } : null;
};

export const fetchProviderProfileOption = async (
  account: ProviderProfileAccount,
  options: {
    fetchImplementation?: FetchImplementation;
    twitchClientId?: string | undefined;
  } = {}
): Promise<ProviderProfileOption | null> => {
  if (!account.accessToken) {
    return null;
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;

  switch (account.providerId) {
    case "google":
      return await fetchGoogleProfile(account, fetchImplementation);
    case "github":
      return await fetchGitHubProfile(account, fetchImplementation);
    case "discord":
      return await fetchDiscordProfile(account, fetchImplementation);
    case "twitch":
      return await fetchTwitchProfile(account, options.twitchClientId, fetchImplementation);
    default:
      return null;
  }
};

const allowedImageHosts = new Set([
  "avatars.githubusercontent.com",
  "cdn.discordapp.com",
  "lh3.googleusercontent.com",
  "static-cdn.jtvnw.net"
]);

export const downloadProviderProfileImage = async (
  imageUrl: string,
  maximumBytes: number,
  fetchImplementation: FetchImplementation = fetch
): Promise<Buffer | null> => {
  try {
    const parsedUrl = new URL(imageUrl);

    if (parsedUrl.protocol !== "https:" || !allowedImageHosts.has(parsedUrl.hostname)) {
      return null;
    }

    const response = await fetchImplementation(parsedUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(5_000)
    });
    const declaredLength = Number(response.headers.get("content-length") ?? "0");

    if (
      !response.ok
      || (declaredLength > 0 && declaredLength > maximumBytes)
      || !response.headers.get("content-type")?.startsWith("image/")
    ) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length <= maximumBytes ? bytes : null;
  } catch {
    return null;
  }
};
