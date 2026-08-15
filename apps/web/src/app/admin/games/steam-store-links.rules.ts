const steamStoreHost = "store.steampowered.com";
const steamAppPathPattern = /^\/app\/(\d+)(?:\/|$)/;

export const getSteamSuggestionUrl = (input: {
  title: string;
  storeUrl: string | null;
}): string => {
  if (input.storeUrl) {
    try {
      const url = new URL(input.storeUrl);
      const appMatch = url.hostname === steamStoreHost
        ? steamAppPathPattern.exec(url.pathname)
        : null;

      if (appMatch?.[1]) {
        return `https://${steamStoreHost}/app/${appMatch[1]}/`;
      }
    } catch {
      // The suggestion validator reports malformed URLs elsewhere.
    }
  }

  const searchUrl = new URL(`https://${steamStoreHost}/search/`);
  searchUrl.searchParams.set("term", input.title.trim());
  return searchUrl.toString();
};
