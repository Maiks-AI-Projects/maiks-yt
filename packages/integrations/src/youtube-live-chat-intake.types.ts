import type { YouTubeChannelDiscoveryCredential } from "./youtube-channel-discovery.types.js";
import type { YouTubeOwnerOAuthConfig } from "./youtube-owner-oauth.types.js";

export type YouTubeLiveChatProjectedMessage = {
  id: string;
  authorKind: "human";
  authorName: string;
  avatarUrl?: string;
  authorChannelId: string | null;
  channelName: string;
  createdAt: string;
  message: string;
  providerMessageId: string;
  source: "youtube";
  visibleOnOverlayByDefault: true;
};

export type YouTubeLiveChatProjectionInput = {
  authorChannelId?: string | null;
  authorName?: string | null;
  avatarUrl?: string | null;
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
  authorChannelId: string | null;
  authorName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  id: string | null;
  text: string;
};

export type YouTubeLiveChatMessageBatch = {
  messages: readonly YouTubeLiveChatReadableMessage[];
  nextPageToken: string | null;
};

export type YouTubeLiveChatMessageStream = {
  cancel(): void;
  completion: Promise<void>;
};

export type YouTubeLiveChatApi = {
  close?(): void;
  findActiveLiveChat(input: {
    context: YouTubeLiveChatContext;
  }): Promise<YouTubeActiveLiveChat | null>;
  openMessageStream(input: {
    context: YouTubeLiveChatContext;
    liveChatId: string;
    onBatch: (batch: YouTubeLiveChatMessageBatch) => void;
    pageToken: string | null;
  }): Promise<YouTubeLiveChatMessageStream>;
};

export type YouTubeLiveChatQuotaGuard = {
  isBlocked(): Promise<boolean>;
  block(): Promise<void>;
  clear(): Promise<void>;
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
    state: "stopped" | "connecting" | "waiting" | "connected" | "quota_exhausted";
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
