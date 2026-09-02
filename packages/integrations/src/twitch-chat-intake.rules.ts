import { randomUUID } from "node:crypto";

import { buildEmoteImageUrl, parseChatMessage } from "@twurple/chat";

import type {
  TwitchChatMessagePart,
  TwitchChatProjectionInput,
  TwitchChatProjectionResult
} from "./twitch-chat-intake.types.js";

const maxAuthorNameLength = 40;
const maxMessageLength = 500;
const maxChannelNameLength = 40;
const maxAvatarUrlLength = 2_048;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string, maxLength: number): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeChannelName = (value: string): string =>
  normalizeText(value.replace(/^#/, ""), maxChannelNameLength).toLowerCase();

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

const projectMessageParts = (
  text: string,
  emoteOffsets: ReadonlyMap<string, readonly string[]> | undefined
): TwitchChatMessagePart[] | undefined => {
  if (!emoteOffsets || emoteOffsets.size === 0) {
    return undefined;
  }

  const mutableOffsets = new Map(
    Array.from(emoteOffsets, ([id, ranges]) => [id, [...ranges]])
  );
  const parts: TwitchChatMessagePart[] = [];

  for (const part of parseChatMessage(text, mutableOffsets)) {
    if (part.type === "emote") {
      parts.push({
        type: "emote" as const,
        id: part.id.slice(0, 80),
        name: normalizeText(part.name, 80),
        imageUrl: buildEmoteImageUrl(part.id, {
          animationSettings: "default",
          backgroundType: "dark",
          size: "2.0"
        })
      });
      continue;
    }

    if (part.type === "text") {
      const partText = stripControlCharacters(part.text).slice(0, maxMessageLength);
      if (partText) {
        parts.push({ type: "text", text: partText });
      }
      continue;
    }

    parts.push({ type: "text", text: part.name });
  }

  const boundedParts = parts.slice(0, 80);
  return boundedParts.some((part) => part.type === "emote") ? boundedParts : undefined;
};

export const resolveTwitchChatChannelNames = (env: Record<string, string | undefined>): string[] => {
  const configured = env.TWITCH_CHAT_CHANNELS
    ?? env.TWITCH_CHAT_CHANNEL
    ?? env.TWITCH_CHANNEL
    ?? env.TWITCH_LOGIN
    ?? "maiksmc";

  return [...new Set(configured
    .split(",")
    .map(normalizeChannelName)
    .filter((channelName) => channelName.length > 0))];
};

export const resolveTwitchChatChannelName = (env: Record<string, string | undefined>): string =>
  resolveTwitchChatChannelNames(env)[0] ?? "";

export const projectTwitchChatMessage = (
  input: TwitchChatProjectionInput
): TwitchChatProjectionResult => {
  const channelName = normalizeChannelName(input.channelName);
  const userName = normalizeText(input.userName, maxAuthorNameLength).toLowerCase();
  const userId = normalizeText(input.userId ?? "", 80) || null;
  const authorName = normalizeText(input.displayName || input.userName, maxAuthorNameLength);
  const message = normalizeText(input.text, maxMessageLength);
  const parts = projectMessageParts(input.text, input.emoteOffsets);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);

  if (!channelName) {
    return {
      ok: false,
      reason: "empty_channel"
    };
  }

  if (!authorName || !userName) {
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
      channelName,
      createdAt: (input.createdAt ?? new Date()).toISOString(),
      message,
      ...(parts ? { parts } : {}),
      providerMessageId: normalizeText(input.messageId ?? "", 80) || randomUUID(),
      userId,
      userName,
      source: "twitch",
      visibleOnOverlayByDefault: true
    }
  };
};
