import type { StreamerChatMessage } from "@maiks-yt/events";

const maximumReadoutLength = 240;

export const normalizeChatAttentionText = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, maximumReadoutLength);

export const shouldAnnounceChatMessage = (message: StreamerChatMessage): boolean =>
  message.authorKind === "human" && normalizeChatAttentionText(message.message).length > 0;

export const createChatAttentionReadout = (message: StreamerChatMessage): string => {
  const authorName = normalizeChatAttentionText(message.authorName) || "Someone";
  const messageText = normalizeChatAttentionText(message.message);

  return `${authorName} says: ${messageText}`;
};

export const createChatAttentionTitle = (unreadCount: number): string =>
  unreadCount > 0 ? `(${unreadCount}) Maiks.yt Streamer Chat` : "Maiks.yt Streamer Chat";
