import type { OverlayFakeChatMessage } from "./overlay.events.js";

export type StreamerChatSource = "fake-local" | "twitch" | "youtube" | "discord";

export type StreamerChatMessage = Omit<OverlayFakeChatMessage, "source"> & {
  source: StreamerChatSource;
  visibleOnOverlayByDefault: boolean;
  channelName?: string;
  providerChannelId?: string;
  providerGuildId?: string;
  providerMessageId?: string;
  providerUserLogin?: string;
  providerUserId?: string;
};

export type StreamerChatMessageReceivedEvent = {
  type: "streamer-chat.message.received";
  payload: StreamerChatMessage;
  revision: number;
  sessionId: string;
};

export type StreamerChatSnapshotEvent = {
  type: "streamer-chat.snapshot";
  revision: number;
  sessionId: string;
  payload: {
    messages: StreamerChatMessage[];
    sentAt: string;
  };
};

export type StreamerChatLiveMessage =
  | StreamerChatMessageReceivedEvent
  | StreamerChatSnapshotEvent;

export const createStreamerChatMessageFromFakeLocal = (
  message: OverlayFakeChatMessage
): StreamerChatMessage => ({
  ...message,
  visibleOnOverlayByDefault: message.source === "fake-local" && message.authorKind === "human"
});
