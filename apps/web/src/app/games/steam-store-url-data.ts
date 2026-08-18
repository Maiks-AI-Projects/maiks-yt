export const getSteamAppUrl = (storeUrl: string | null): string | null => {
  if (!storeUrl) {
    return null;
  }

  try {
    const url = new URL(storeUrl);

    if (
      url.protocol !== "https:"
      || url.hostname !== "store.steampowered.com"
      || url.port !== ""
      || url.username !== ""
      || url.password !== ""
    ) {
      return null;
    }

    const appId = /^\/app\/([1-9]\d*)(?:\/|$)/.exec(url.pathname)?.[1];

    return appId ? `steam://store/${appId}` : null;
  } catch {
    return null;
  }
};
