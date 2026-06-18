import type { OverlayFakeChatMessage } from "./overlay.events.js";

export type StreamerChatMessage = OverlayFakeChatMessage & {
  visibleOnOverlayByDefault: boolean;
};

export type StreamerChatMessageReceivedEvent = {
  type: "streamer-chat.message.received";
  payload: StreamerChatMessage;
};

export type StreamerChatSnapshotEvent = {
  type: "streamer-chat.snapshot";
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
