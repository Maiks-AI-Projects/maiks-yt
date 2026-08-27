export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api.maiks.yt";
export const webBaseUrl = import.meta.env.VITE_WEB_BASE_URL ?? "https://maiks.yt";

export const createWebUrl = (path: string): string =>
  new URL(path, webBaseUrl).toString();
