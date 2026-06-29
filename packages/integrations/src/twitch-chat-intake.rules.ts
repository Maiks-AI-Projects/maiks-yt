import { randomUUID } from "node:crypto";

import type {
  TwitchChatProjectionInput,
  TwitchChatProjectionResult
} from "./twitch-chat-intake.types.js";

const maxAuthorNameLength = 40;
const maxMessageLength = 500;
const maxChannelNameLength = 40;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string, maxLength: number): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeChannelName = (value: string): string =>
  normalizeText(value.replace(/^#/, ""), maxChannelNameLength).toLowerCase();

export const resolveTwitchChatChannelName = (env: Record<string, string | undefined>): string => {
  const configured = env.TWITCH_CHAT_CHANNEL ?? env.TWITCH_CHANNEL ?? env.TWITCH_LOGIN;

  return normalizeChannelName(configured ?? "maiksmc");
};

export const projectTwitchChatMessage = (
  input: TwitchChatProjectionInput
): TwitchChatProjectionResult => {
  const channelName = normalizeChannelName(input.channelName);
  const authorName = normalizeText(input.displayName || input.userName, maxAuthorNameLength);
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
      createdAt: (input.createdAt ?? new Date()).toISOString(),
      message,
      providerMessageId: normalizeText(input.messageId ?? "", 80) || randomUUID(),
      source: "twitch",
      visibleOnOverlayByDefault: false
    }
  };
};
