export type TwitchChatProjectedMessage = {
  id: string;
  authorKind: "human";
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
  providerMessageId: string;
  source: "twitch";
  visibleOnOverlayByDefault: false;
};

export type TwitchChatProjectionInput = {
  channelName: string;
  createdAt?: Date;
  displayName?: string | null;
  messageId?: string | null;
  text: string;
  userName: string;
};

export type TwitchChatProjectionResult =
  | {
    ok: true;
    message: TwitchChatProjectedMessage;
  }
  | {
    ok: false;
    reason: "empty_author" | "empty_channel" | "empty_message";
  };

export type TwitchChatIntakeStatus =
  | {
    channelName: string;
    connectedAt: string | null;
    lastError: string | null;
    lastMessageAt: string | null;
    recentMessages: readonly TwitchChatProjectedMessage[];
    state: "stopped" | "connecting" | "connected";
  }
  | {
    channelName: string | null;
    connectedAt: null;
    lastError: string;
    lastMessageAt: null;
    recentMessages: readonly TwitchChatProjectedMessage[];
    state: "unconfigured";
  };
