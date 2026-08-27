import type { StreamerChatLiveMessage, StreamerChatMessage } from "@maiks-yt/events";

import { mergeStreamerChatMessages } from "./streamer-chat-viewer.service.js";

export type StreamerChatVersionedState = {
  messages: StreamerChatMessage[];
  revision: number;
  sessionId: string | null;
};

export const createEmptyStreamerChatState = (): StreamerChatVersionedState => ({
  messages: [],
  revision: -1,
  sessionId: null
});

const streamerChatSources = new Set(["fake-local", "twitch", "youtube", "discord"]);
const authorKinds = new Set(["human", "bot", "system"]);

const isStreamerChatMessage = (value: unknown): value is StreamerChatMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<StreamerChatMessage>;

  return typeof message.id === "string"
    && typeof message.authorName === "string"
    && typeof message.message === "string"
    && typeof message.createdAt === "string"
    && typeof message.visibleOnOverlayByDefault === "boolean"
    && typeof message.source === "string"
    && streamerChatSources.has(message.source)
    && typeof message.authorKind === "string"
    && authorKinds.has(message.authorKind);
};

export const parseStreamerChatLiveMessage = (value: unknown): StreamerChatLiveMessage | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as Partial<StreamerChatLiveMessage> & {
    payload?: unknown;
    revision?: unknown;
    sessionId?: unknown;
    type?: unknown;
  };

  if (!Number.isSafeInteger(message.revision)
    || typeof message.sessionId !== "string"
    || message.sessionId.length === 0) {
    return null;
  }

  if (message.type === "streamer-chat.message.received") {
    return isStreamerChatMessage(message.payload) ? message as StreamerChatLiveMessage : null;
  }

  if (message.type === "streamer-chat.snapshot"
    && message.payload
    && typeof message.payload === "object") {
    const payload = message.payload as { messages?: unknown; sentAt?: unknown };

    return Array.isArray(payload.messages)
      && payload.messages.every(isStreamerChatMessage)
      && typeof payload.sentAt === "string"
      ? message as StreamerChatLiveMessage
      : null;
  }

  return null;
};

export const applyStreamerChatSnapshot = (
  current: StreamerChatVersionedState,
  snapshot: {
    messages: readonly StreamerChatMessage[];
    revision: number;
    sessionId: string;
  }
): StreamerChatVersionedState => {
  if (current.sessionId === snapshot.sessionId && snapshot.revision < current.revision) {
    return current;
  }

  return {
    messages: snapshot.messages.slice(0, 75),
    revision: snapshot.revision,
    sessionId: snapshot.sessionId
  };
};

export const applyStreamerChatMessage = (
  current: StreamerChatVersionedState,
  input: {
    message: StreamerChatMessage;
    revision: number;
    sessionId: string;
  }
): StreamerChatVersionedState => {
  if (current.sessionId === input.sessionId && input.revision <= current.revision) {
    return current;
  }

  return {
    messages: mergeStreamerChatMessages(
      [input.message],
      current.sessionId === input.sessionId ? current.messages : []
    ),
    revision: input.revision,
    sessionId: input.sessionId
  };
};
