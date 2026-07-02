export type DiscordChatProjectedMessage = {
  id: string;
  authorKind: "human";
  authorName: string;
  channelId: string;
  channelName: string;
  createdAt: string;
  guildId: string;
  message: string;
  providerMessageId: string;
  source: "discord";
  visibleOnOverlayByDefault: false;
};

export type DiscordChatProjectionInput = {
  authorDisplayName?: string | null;
  authorUsername: string;
  channelId: string;
  channelName?: string | null;
  createdAt?: Date;
  guildId: string;
  messageId: string;
  text: string;
};

export type DiscordChatProjectionResult =
  | {
    ok: true;
    message: DiscordChatProjectedMessage;
  }
  | {
    ok: false;
    reason: "empty_author" | "empty_channel" | "empty_guild" | "empty_message";
  };

export type DiscordChatIntakeStatus =
  | {
    channelIds: readonly string[];
    connectedAt: string | null;
    disconnectsInWindow: number;
    guildId: string;
    lastError: string | null;
    lastDisconnectAt: string | null;
    lastMessageAt: string | null;
    nextReconnectAt: string | null;
    recentMessages: readonly DiscordChatProjectedMessage[];
    reconnectSuppressed: boolean;
    state: "stopped" | "connecting" | "connected";
  }
  | {
    channelIds: readonly string[];
    connectedAt: null;
    disconnectsInWindow: 0;
    guildId: string | null;
    lastError: string;
    lastDisconnectAt: null;
    lastMessageAt: null;
    nextReconnectAt: null;
    recentMessages: readonly DiscordChatProjectedMessage[];
    reconnectSuppressed: false;
    state: "unconfigured";
  };
