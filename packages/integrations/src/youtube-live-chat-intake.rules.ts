import { randomUUID } from "node:crypto";

import type {
  YouTubeLiveChatProjectionInput,
  YouTubeLiveChatProjectionResult
} from "./youtube-live-chat-intake.types.js";

const maxAuthorNameLength = 60;
const maxChannelNameLength = 80;
const maxMessageLength = 500;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string | null | undefined, maxLength: number): string =>
  stripControlCharacters(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeIso = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : new Date();

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export const projectYouTubeLiveChatMessage = (
  input: YouTubeLiveChatProjectionInput
): YouTubeLiveChatProjectionResult => {
  const channelName = normalizeText(input.channelName, maxChannelNameLength);
  const authorName = normalizeText(input.authorName, maxAuthorNameLength);
  const message = normalizeText(input.text, maxMessageLength);

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
      channelName,
      createdAt: normalizeIso(input.createdAt),
      message,
      providerMessageId: normalizeText(input.messageId, 120) || randomUUID(),
      source: "youtube",
      visibleOnOverlayByDefault: false
    }
  };
};
