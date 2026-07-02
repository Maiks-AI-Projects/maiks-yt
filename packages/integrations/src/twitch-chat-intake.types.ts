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
    disconnectsInWindow: number;
    lastError: string | null;
    lastDisconnectAt: string | null;
    lastMessageAt: string | null;
    nextReconnectAt: string | null;
    recentMessages: readonly TwitchChatProjectedMessage[];
    reconnectSuppressed: boolean;
    state: "stopped" | "connecting" | "connected";
  }
  | {
    channelName: string | null;
    connectedAt: null;
    disconnectsInWindow: 0;
    lastError: string;
    lastDisconnectAt: null;
    lastMessageAt: null;
    nextReconnectAt: null;
    recentMessages: readonly TwitchChatProjectedMessage[];
    reconnectSuppressed: false;
    state: "unconfigured";
  };
