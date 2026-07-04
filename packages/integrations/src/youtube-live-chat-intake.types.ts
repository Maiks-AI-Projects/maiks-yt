import type { YouTubeChannelDiscoveryCredential } from "./youtube-channel-discovery.types.js";
import type { YouTubeOwnerOAuthConfig } from "./youtube-owner-oauth.types.js";

export type YouTubeLiveChatProjectedMessage = {
  id: string;
  authorKind: "human";
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
  providerMessageId: string;
  source: "youtube";
  visibleOnOverlayByDefault: false;
};

export type YouTubeLiveChatProjectionInput = {
  authorName?: string | null;
  channelName: string;
  createdAt?: string | null;
  messageId?: string | null;
  text: string;
};

export type YouTubeLiveChatProjectionResult =
  | {
    ok: true;
    message: YouTubeLiveChatProjectedMessage;
  }
  | {
    ok: false;
    reason: "empty_author" | "empty_channel" | "empty_message";
  };

export type YouTubeLiveChatSelectedChannel = {
  id: string;
  title: string;
  customUrl: string | null;
};

export type YouTubeLiveChatContext = {
  config: Extract<YouTubeOwnerOAuthConfig, { ok: true }>;
  credential: YouTubeChannelDiscoveryCredential;
  selectedChannel: YouTubeLiveChatSelectedChannel;
};

export type YouTubeActiveLiveChat = {
  liveChatId: string;
  title: string | null;
};

export type YouTubeLiveChatReadableMessage = {
  authorName: string | null;
  createdAt: string | null;
  id: string | null;
  text: string;
};

export type YouTubeLiveChatMessageBatch = {
  messages: readonly YouTubeLiveChatReadableMessage[];
  nextPageToken: string | null;
  pollingIntervalMs: number | null;
};

export type YouTubeLiveChatApi = {
  findActiveLiveChat(input: {
    context: YouTubeLiveChatContext;
  }): Promise<YouTubeActiveLiveChat | null>;
  listMessages(input: {
    context: YouTubeLiveChatContext;
    liveChatId: string;
    pageToken: string | null;
  }): Promise<YouTubeLiveChatMessageBatch>;
};

export type YouTubeLiveChatIntakeStatus =
  | {
    activeLiveChatId: string | null;
    channelId: string;
    channelName: string;
    connectedAt: string | null;
    lastError: string | null;
    lastMessageAt: string | null;
    nextPollAt: string | null;
    recentMessages: readonly YouTubeLiveChatProjectedMessage[];
    state: "stopped" | "connecting" | "waiting" | "connected";
  }
  | {
    activeLiveChatId: null;
    channelId: string | null;
    channelName: string | null;
    connectedAt: null;
    lastError: string;
    lastMessageAt: null;
    nextPollAt: null;
    recentMessages: readonly YouTubeLiveChatProjectedMessage[];
    state: "unconfigured";
  };
