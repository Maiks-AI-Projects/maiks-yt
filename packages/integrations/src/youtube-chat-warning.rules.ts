import type { YouTubeChatWarningInput, YouTubeChatWarningMessage } from "./youtube-chat-warning.types.js";

const maxYouTubeMessageLength = 200;
const maxNameLength = 60;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string | null | undefined, maxLength: number): string =>
  stripControlCharacters(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

export const createYouTubeWarningMessage = (
  input: Pick<YouTubeChatWarningInput, "authorName" | "warningCount" | "warningThreshold">
): YouTubeChatWarningMessage => {
  const safeAuthorName = normalizeText(input.authorName, maxNameLength).replace(/^@+/, "") || "there";
  const safeWarningCount = Math.max(1, Math.floor(input.warningCount));
  const safeWarningThreshold = Math.max(safeWarningCount, Math.floor(input.warningThreshold));
  const content = normalizeText(
    `@${safeAuthorName} this is warning ${safeWarningCount}/${safeWarningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`,
    maxYouTubeMessageLength
  );

  return {
    content
  };
};
