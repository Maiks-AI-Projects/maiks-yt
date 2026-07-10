import type { StreamerChatActionAccess } from "./streamer-chat-viewer.types.js";

export const defaultActionAccess: StreamerChatActionAccess = {
  canAllow: true,
  canBan: true,
  canHide: true,
  canProviderModerate: true,
  canWarn: true
};

export const defaultTemporaryMuteDurationSeconds = 10 * 60;

export const createWebSocketUrl = (baseUrl: string, path: string): string => {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
};

export const createAuthenticatedWebSocketUrl = (baseUrl: string, path: string, accessToken: string): string => {
  const url = new URL(createWebSocketUrl(baseUrl, path));
  url.searchParams.set("accessToken", accessToken);

  return url.toString();
};
