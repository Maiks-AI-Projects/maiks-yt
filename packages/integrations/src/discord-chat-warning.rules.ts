import type { DiscordChatWarningInput, DiscordChatWarningMessage } from "./discord-chat-warning.types.js";

const maxDiscordMessageLength = 500;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string, maxLength: number): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeSnowflake = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value ?? "", 80);

  return /^\d{10,30}$/.test(normalized) ? normalized : null;
};

export const createDiscordWarningMessage = (
  input: Pick<DiscordChatWarningInput, "authorName" | "userId" | "warningCount" | "warningThreshold">
): DiscordChatWarningMessage => {
  const allowedUserId = normalizeSnowflake(input.userId);
  const safeAuthorName = normalizeText(input.authorName, 40).replace(/^@+/, "") || "there";
  const mention = allowedUserId ? `<@${allowedUserId}>` : safeAuthorName;
  const safeWarningCount = Math.max(1, Math.floor(input.warningCount));
  const safeWarningThreshold = Math.max(safeWarningCount, Math.floor(input.warningThreshold));
  const content = normalizeText(
    `${mention} this is warning ${safeWarningCount}/${safeWarningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`,
    maxDiscordMessageLength
  );

  return {
    allowedUserId,
    content
  };
};

export const normalizeDiscordWarningChannelId = (channelId: string | null | undefined): string | null =>
  normalizeSnowflake(channelId);
