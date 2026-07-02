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
  maxUnexpectedDisconnectsInWindow?: number;
  onMessage?: (message: TwitchChatProjectedMessage) => void;
  reconnectDelayMs?: number;
  reconnectWindowMs?: number;
  clearTimeoutFn?: (handle: unknown) => void;
  now?: () => Date;
  setTimeoutFn?: (callback: () => void, ms: number) => unknown;
};

const sanitizeError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 180);
  }

  return "Twitch chat intake unavailable.";
};

export class TwitchChatReadOnlyIntakeService {
  private readonly channelName: string;
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly createClient: (channelName: string) => TwitchChatClientLike;
  private readonly maxUnexpectedDisconnectsInWindow: number;
  private readonly maxRecentMessages: number;
  private readonly now: () => Date;
  private readonly onProjectedMessage: ((message: TwitchChatProjectedMessage) => void) | undefined;
  private readonly reconnectDelayMs: number;
  private readonly reconnectWindowMs: number;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => unknown;
  private client: TwitchChatClientLike | null = null;
  private connectedAt: string | null = null;
  private readonly disconnectTimestamps: number[] = [];
  private lastError: string | null = null;
  private lastDisconnectAt: string | null = null;
  private lastMessageAt: string | null = null;
  private readonly listenerIds: TwitchChatListener[] = [];
  private manualStopRequested = false;
  private nextReconnectAt: string | null = null;
  private readonly recentMessages: TwitchChatProjectedMessage[] = [];
  private reconnectSuppressed = false;
  private reconnectTimer: unknown | null = null;

  public constructor(options: TwitchChatReadOnlyIntakeOptions = {}) {
    this.channelName = resolveTwitchChatChannelName(options.env ?? process.env);
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
    this.createClient = options.createClient ?? ((channelName) => new ChatClient({
      channels: [channelName],
      readOnly: true
    }));
    this.maxUnexpectedDisconnectsInWindow = options.maxUnexpectedDisconnectsInWindow ?? 10;
    this.maxRecentMessages = options.maxRecentMessages ?? 25;
    this.now = options.now ?? (() => new Date());
    this.onProjectedMessage = options.onMessage;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5_000;
    this.reconnectWindowMs = options.reconnectWindowMs ?? 10 * 60 * 1_000;
    this.setTimeoutFn = options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms));
  }

  public getStatus(): TwitchChatIntakeStatus {
    if (!this.channelName) {
      return {
        channelName: null,
        connectedAt: null,
        disconnectsInWindow: 0,
        lastError: "TWITCH_CHAT_CHANNEL is empty.",
        lastDisconnectAt: null,
        lastMessageAt: null,
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "unconfigured"
      };
    }

    return {
      channelName: this.channelName,
      connectedAt: this.connectedAt,
      disconnectsInWindow: this.getDisconnectsInWindow(),
      lastError: this.lastError,
      lastDisconnectAt: this.lastDisconnectAt,
      lastMessageAt: this.lastMessageAt,
      nextReconnectAt: this.nextReconnectAt,
      recentMessages: this.recentMessages.map((message) => ({ ...message })),
      reconnectSuppressed: this.reconnectSuppressed,
      state: this.client?.isConnected
        ? "connected"
        : this.client?.isConnecting
          ? "connecting"
          : "stopped"
    };
  }

  public start(): TwitchChatIntakeStatus {
    return this.startInternal({ resetDisconnectWindow: true });
  }

  public stop(): TwitchChatIntakeStatus {
    this.manualStopRequested = true;
    this.clearReconnectTimer();

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
    this.nextReconnectAt = null;

    return this.getStatus();
  }

  private startInternal({ resetDisconnectWindow }: { resetDisconnectWindow: boolean }): TwitchChatIntakeStatus {
    if (!this.channelName) {
      this.lastError = "TWITCH_CHAT_CHANNEL is empty.";
      return this.getStatus();
    }

    if (this.client?.isConnected || this.client?.isConnecting) {
      return this.getStatus();
    }

    this.manualStopRequested = false;
    this.clearReconnectTimer();
    if (resetDisconnectWindow) {
      this.disconnectTimestamps.splice(0);
      this.reconnectSuppressed = false;
      this.lastDisconnectAt = null;
    }

    this.clearListeners();
    const nextClient = this.createClient(this.channelName);
    this.client = nextClient;
    this.lastError = null;
    this.nextReconnectAt = null;

    this.listenerIds.push(nextClient.onConnect(() => {
      this.connectedAt = this.now().toISOString();
      this.lastError = null;
    }));
    this.listenerIds.push(nextClient.onDisconnect((manually, reason) => {
      this.connectedAt = null;
      if (reason) {
        this.lastError = sanitizeError(reason);
      }
      const shouldReconnect = !manually && !this.manualStopRequested;
      this.clearListeners();
      this.client = null;

      if (shouldReconnect) {
        this.scheduleReconnect(reason);
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
      this.clearListeners();
      this.client = null;
      this.scheduleReconnect(error);
    }

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

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.nextReconnectAt = null;
  }

  private getDisconnectsInWindow(): number {
    this.pruneDisconnectWindow(this.now().getTime());
    return this.disconnectTimestamps.length;
  }

  private pruneDisconnectWindow(nowMs: number): void {
    const oldestAllowedMs = nowMs - this.reconnectWindowMs;
    while (this.disconnectTimestamps.length > 0 && (this.disconnectTimestamps[0] ?? Number.POSITIVE_INFINITY) < oldestAllowedMs) {
      this.disconnectTimestamps.shift();
    }
  }

  private scheduleReconnect(reason: unknown): void {
    const now = this.now();
    const nowMs = now.getTime();
    this.lastDisconnectAt = now.toISOString();
    this.pruneDisconnectWindow(nowMs);
    this.disconnectTimestamps.push(nowMs);

    if (this.disconnectTimestamps.length >= this.maxUnexpectedDisconnectsInWindow) {
      this.reconnectSuppressed = true;
      this.nextReconnectAt = null;
      this.lastError = "Twitch chat disconnected too often; manual reconnect required.";
      return;
    }

    this.reconnectSuppressed = false;
    this.lastError = reason ? sanitizeError(reason) : this.lastError;
    const nextReconnect = new Date(nowMs + this.reconnectDelayMs);
    this.nextReconnectAt = nextReconnect.toISOString();
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      this.startInternal({ resetDisconnectWindow: false });
    }, this.reconnectDelayMs);
  }
}
