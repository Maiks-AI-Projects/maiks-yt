import type { StreamerChatMessage } from "@maiks-yt/events";

import type { StreamerChatActionAccess } from "./streamer-chat-viewer.types.js";

export const noStreamerChatActionAccess: StreamerChatActionAccess = {
  canAllow: false,
  canBan: false,
  canHide: false,
  canProviderModerate: false,
  canWarn: false
};

export const defaultProviderTimeoutDurationSeconds = 10 * 60;

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

export const createStreamerChatModerationAccessUrl = (baseUrl: string, accessToken: string): string => {
  const url = new URL("/streamer-chat/moderation/access", baseUrl);
  url.searchParams.set("accessToken", accessToken);

  return url.toString();
};

export const canOpenStreamerChatOptions = (
  actionAccess: StreamerChatActionAccess,
  source: StreamerChatMessage["source"]
): boolean => actionAccess.canWarn
  || actionAccess.canAllow === true
  || (
    actionAccess.canProviderModerate === true
    && (source === "discord" || source === "twitch")
  );
