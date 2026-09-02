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

const streamerChatReconnectDelaysMs = [1_000, 2_000, 4_000, 8_000, 15_000] as const;

export const getStreamerChatReconnectDelayMs = (attempt: number): number => {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;

  return streamerChatReconnectDelaysMs[
    Math.min(normalizedAttempt, streamerChatReconnectDelaysMs.length - 1)
  ] ?? streamerChatReconnectDelaysMs[0];
};

export const shouldReconnectStreamerChat = (_closeCode: number): boolean => true;

export const getStreamerChatAvatarUrl = (value: string | undefined): string | null => {
  if (!value || value.length > 2_048) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};

export const mergeStreamerChatMessages = (
  primaryMessages: readonly StreamerChatMessage[],
  secondaryMessages: readonly StreamerChatMessage[],
  maximumMessages = 75
): StreamerChatMessage[] => {
  const messagesById = new Map<string, StreamerChatMessage>();

  for (const message of [...primaryMessages, ...secondaryMessages]) {
    if (!messagesById.has(message.id)) {
      messagesById.set(message.id, message);
    }

    if (messagesById.size >= maximumMessages) {
      break;
    }
  }

  return [...messagesById.values()];
};

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
