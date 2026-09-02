export type TwitchChatProjectedMessage = {
  id: string;
  authorKind: "human";
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
  parts?: TwitchChatMessagePart[];
  providerMessageId: string;
  userId: string | null;
  userName: string;
  source: "twitch";
  visibleOnOverlayByDefault: true;
};

export type TwitchChatMessagePart =
  | {
    type: "text";
    text: string;
  }
  | {
    type: "emote";
    id: string;
    name: string;
    imageUrl: string;
  };

export type TwitchChatProjectionInput = {
  channelName: string;
  createdAt?: Date;
  displayName?: string | null;
  emoteOffsets?: ReadonlyMap<string, readonly string[]>;
  messageId?: string | null;
  text: string;
  userId?: string | null;
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
    channelNames: readonly string[];
    joinedChannelNames?: readonly string[];
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
    channelNames: readonly string[];
    joinedChannelNames?: readonly string[];
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
