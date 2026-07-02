import { randomUUID } from "node:crypto";

import type {
  DiscordChatProjectionInput,
  DiscordChatProjectionResult
} from "./discord-chat-intake.types.js";

const maxAuthorNameLength = 40;
const maxChannelNameLength = 80;
const maxMessageLength = 500;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string, maxLength: number): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeId = (value: string | undefined): string => normalizeText(value ?? "", 80);

export const resolveDiscordChatGuildId = (env: Record<string, string | undefined>): string =>
  normalizeId(env.DISCORD_CHAT_GUILD_ID ?? env.DISCORD_GUILD_ID);

export const resolveDiscordChatChannelIds = (env: Record<string, string | undefined>): readonly string[] => {
  const configured = env.DISCORD_CHAT_CHANNEL_IDS ?? env.DISCORD_CHAT_CHANNEL_ID ?? env.DISCORD_CHANNEL_ID ?? "";

  return configured
    .split(",")
    .map((value) => normalizeId(value))
    .filter((value) => value.length > 0);
};

export const projectDiscordChatMessage = (
  input: DiscordChatProjectionInput
): DiscordChatProjectionResult => {
  const guildId = normalizeId(input.guildId);
  const channelId = normalizeId(input.channelId);
  const channelName = normalizeText(input.channelName ?? channelId, maxChannelNameLength);
  const authorName = normalizeText(input.authorDisplayName || input.authorUsername, maxAuthorNameLength);
  const message = normalizeText(input.text, maxMessageLength);

  if (!guildId) {
    return {
      ok: false,
      reason: "empty_guild"
    };
  }

  if (!channelId || !channelName) {
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
      channelId,
      channelName,
      createdAt: (input.createdAt ?? new Date()).toISOString(),
      guildId,
      message,
      providerMessageId: normalizeId(input.messageId) || randomUUID(),
      source: "discord",
      visibleOnOverlayByDefault: false
    }
  };
};
