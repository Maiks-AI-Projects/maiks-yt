import { randomUUID } from "node:crypto";

import type {
  YouTubeLiveChatProjectionInput,
  YouTubeLiveChatProjectionResult
} from "./youtube-live-chat-intake.types.js";

const maxAuthorNameLength = 60;
const maxChannelNameLength = 80;
const maxMessageLength = 500;
const maxAvatarUrlLength = 2_048;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string | null | undefined, maxLength: number): string =>
  stripControlCharacters(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeIso = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : new Date();

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeAvatarUrl = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maxAvatarUrlLength) {
    return undefined;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

export const projectYouTubeLiveChatMessage = (
  input: YouTubeLiveChatProjectionInput
): YouTubeLiveChatProjectionResult => {
  const channelName = normalizeText(input.channelName, maxChannelNameLength);
  const authorName = normalizeText(input.authorName, maxAuthorNameLength);
  const message = normalizeText(input.text, maxMessageLength);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);

  if (!channelName) {
    return {
      ok: false,
      reason: "empty_channel"
    };
  }

  if (!authorName) {
    return {
      ok: false,
      reason: "empty_author"
    };
  }

  if (!message) {
    return {
      ok: false,
      reason: "empty_message"
    };
  }

  return {
    ok: true,
    message: {
      id: randomUUID(),
      authorKind: "human",
      authorName,
      ...(avatarUrl ? { avatarUrl } : {}),
      authorChannelId: normalizeText(input.authorChannelId, 120) || null,
      channelName,
      createdAt: normalizeIso(input.createdAt),
      message,
      providerMessageId: normalizeText(input.messageId, 120) || randomUUID(),
      source: "youtube",
      visibleOnOverlayByDefault: true
    }
  };
};
