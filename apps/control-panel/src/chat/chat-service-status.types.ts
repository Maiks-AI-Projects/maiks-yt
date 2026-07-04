export type TwitchChatIntakeStatus = {
  channelName: string | null;
  connectedAt: string | null;
  disconnectsInWindow: number;
  lastError: string | null;
  lastDisconnectAt: string | null;
  lastMessageAt: string | null;
  nextReconnectAt: string | null;
  recentMessages: Array<{
    id: string;
    authorName: string;
    createdAt: string;
    message: string;
  }>;
  reconnectSuppressed: boolean;
  state: "stopped" | "connecting" | "connected" | "unconfigured";
};

export type DiscordChatIntakeStatus = {
  channelIds: readonly string[];
  connectedAt: string | null;
  disconnectsInWindow: number;
  guildId: string | null;
  lastError: string | null;
  lastDisconnectAt: string | null;
  lastMessageAt: string | null;
  nextReconnectAt: string | null;
  recentMessages: Array<{
    id: string;
    authorName: string;
    channelName: string;
    createdAt: string;
    message: string;
  }>;
  reconnectSuppressed: boolean;
  state: "stopped" | "connecting" | "connected" | "unconfigured";
};

export type YouTubeLiveChatIntakeStatus = {
  activeLiveChatId: string | null;
  channelId: string | null;
  channelName: string | null;
  connectedAt: string | null;
  lastError: string | null;
  lastMessageAt: string | null;
  nextPollAt: string | null;
  recentMessages: Array<{
    id: string;
    authorName: string;
    createdAt: string;
    message: string;
  }>;
  state: "stopped" | "connecting" | "waiting" | "connected" | "unconfigured";
};

export type TwitchChatStatusResponse = {
  ok: true;
  readOnly: true;
  status: TwitchChatIntakeStatus;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type DiscordChatStatusResponse = {
  ok: true;
  readOnly: true;
  status: DiscordChatIntakeStatus;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type YouTubeLiveChatStatusResponse = {
  ok: true;
  readOnly: true;
  status: YouTubeLiveChatIntakeStatus;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type ServiceConnectionTone = "connected" | "problem" | "disconnected" | "loading";

export type ChatServiceStatusStripProps = {
  apiBaseUrl: string;
};
