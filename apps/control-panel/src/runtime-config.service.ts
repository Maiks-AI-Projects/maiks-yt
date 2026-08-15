export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
export const webBaseUrl = import.meta.env.VITE_WEB_BASE_URL ?? "https://web-dev.maiks.yt";

export const createWebUrl = (path: string): string =>
  new URL(path, webBaseUrl).toString();
