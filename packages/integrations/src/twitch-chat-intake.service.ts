import { ChatClient } from "@twurple/chat";

import {
  projectTwitchChatMessage,
  resolveTwitchChatChannelName
} from "./twitch-chat-intake.rules.js";
import type {
  TwitchChatIntakeStatus,
  TwitchChatProjectedMessage
} from "./twitch-chat-intake.types.js";

type TwitchChatListener = ReturnType<ChatClient["onConnect"]>;

type TwitchChatClientLike = Pick<
  ChatClient,
  "connect" | "isConnected" | "isConnecting" | "onConnect" | "onDisconnect" | "onMessage" | "quit"
> & {
  removeListener: (listener: TwitchChatListener) => void;
};

type TwitchChatReadOnlyIntakeOptions = {
  createClient?: (channelName: string) => TwitchChatClientLike;
  env?: Record<string, string | undefined>;
  maxRecentMessages?: number;
  onMessage?: (message: TwitchChatProjectedMessage) => void;
};

const sanitizeError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 180);
  }

  return "Twitch chat intake unavailable.";
};

export class TwitchChatReadOnlyIntakeService {
  private readonly channelName: string;
  private readonly createClient: (channelName: string) => TwitchChatClientLike;
  private readonly maxRecentMessages: number;
  private readonly onProjectedMessage: ((message: TwitchChatProjectedMessage) => void) | undefined;
  private client: TwitchChatClientLike | null = null;
  private connectedAt: string | null = null;
  private lastError: string | null = null;
  private lastMessageAt: string | null = null;
  private readonly listenerIds: TwitchChatListener[] = [];
  private readonly recentMessages: TwitchChatProjectedMessage[] = [];

  public constructor(options: TwitchChatReadOnlyIntakeOptions = {}) {
    this.channelName = resolveTwitchChatChannelName(options.env ?? process.env);
    this.createClient = options.createClient ?? ((channelName) => new ChatClient({
      channels: [channelName],
      readOnly: true
    }));
    this.maxRecentMessages = options.maxRecentMessages ?? 25;
    this.onProjectedMessage = options.onMessage;
  }

  public getStatus(): TwitchChatIntakeStatus {
    if (!this.channelName) {
      return {
        channelName: null,
        connectedAt: null,
        lastError: "TWITCH_CHAT_CHANNEL is empty.",
        lastMessageAt: null,
        recentMessages: [],
        state: "unconfigured"
      };
    }

    return {
      channelName: this.channelName,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
      recentMessages: this.recentMessages.map((message) => ({ ...message })),
      state: this.client?.isConnected
        ? "connected"
        : this.client?.isConnecting
          ? "connecting"
          : "stopped"
    };
  }

  public start(): TwitchChatIntakeStatus {
    if (!this.channelName) {
      this.lastError = "TWITCH_CHAT_CHANNEL is empty.";
      return this.getStatus();
    }

    if (this.client?.isConnected || this.client?.isConnecting) {
      return this.getStatus();
    }

    this.clearListeners();
    const nextClient = this.createClient(this.channelName);
    this.client = nextClient;
    this.lastError = null;

    this.listenerIds.push(nextClient.onConnect(() => {
      this.connectedAt = new Date().toISOString();
      this.lastError = null;
    }));
    this.listenerIds.push(nextClient.onDisconnect((_manually, reason) => {
      this.connectedAt = null;
      if (reason) {
        this.lastError = sanitizeError(reason);
      }
    }));
    this.listenerIds.push(nextClient.onMessage((channel, user, text, msg) => {
      const projection = projectTwitchChatMessage({
        channelName: channel,
        createdAt: msg.date,
        displayName: msg.userInfo.displayName,
        messageId: msg.id,
        text,
        userName: user
      });

      if (!projection.ok) {
        return;
      }

      this.lastMessageAt = projection.message.createdAt;
      this.recentMessages.unshift(projection.message);
      this.recentMessages.splice(this.maxRecentMessages);
      this.onProjectedMessage?.({ ...projection.message });
    }));

    try {
      nextClient.connect();
    } catch (error) {
      this.lastError = sanitizeError(error);
    }

    return this.getStatus();
  }

  public stop(): TwitchChatIntakeStatus {
    if (this.client) {
      try {
        this.client.quit();
      } catch (error) {
        this.lastError = sanitizeError(error);
      }
    }

    this.clearListeners();
    this.client = null;
    this.connectedAt = null;

    return this.getStatus();
  }

  private clearListeners(): void {
    if (!this.client) {
      this.listenerIds.splice(0);
      return;
    }

    while (this.listenerIds.length > 0) {
      const listenerId = this.listenerIds.pop();
      if (listenerId) {
        this.client.removeListener(listenerId);
      }
    }
  }
}
