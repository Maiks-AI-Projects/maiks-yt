import type { TwitchChatWarningInput, TwitchChatWarningMessage } from "./twitch-chat-warning.types.js";

const maxTwitchMessageLength = 500;
const maxNameLength = 40;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string, maxLength: number): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeTwitchLogin = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value ?? "", maxNameLength).replace(/^@+/, "").toLowerCase();

  return /^[a-z0-9_]{1,40}$/.test(normalized) ? normalized : null;
};

export const normalizeTwitchWarningChannelName = (channelName: string | null | undefined): string | null =>
  normalizeTwitchLogin(channelName?.replace(/^#/, ""));

export const createTwitchWarningMessage = (
  input: Pick<TwitchChatWarningInput, "authorName" | "userName" | "warningCount" | "warningThreshold">
): TwitchChatWarningMessage => {
  const userName = normalizeTwitchLogin(input.userName);
  const safeAuthorName = normalizeText(input.authorName, maxNameLength).replace(/^@+/, "") || "there";
  const mention = userName ? `@${userName}` : safeAuthorName;
  const safeWarningCount = Math.max(1, Math.floor(input.warningCount));
  const safeWarningThreshold = Math.max(safeWarningCount, Math.floor(input.warningThreshold));
  const content = normalizeText(
    `${mention} this is warning ${safeWarningCount}/${safeWarningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`,
    maxTwitchMessageLength
  );

  return {
    content,
    targetChannelName: null
  };
};
