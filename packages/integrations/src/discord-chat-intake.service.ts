import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  type Message
} from "discord.js";

import {
  projectDiscordGatewayEvent,
  projectDiscordChatMessage,
  resolveDiscordChatChannelIds,
  resolveDiscordChatGuildId
} from "./discord-chat-intake.rules.js";
import type {
  DiscordGatewayProjectedEvent,
  DiscordChatIntakeStatus,
  DiscordChatProjectedMessage
} from "./discord-chat-intake.types.js";

type DiscordReadyHandler = () => void;
type DiscordMessageHandler = (message: DiscordReadableMessage) => void;
type DiscordRawGatewayHandler = (packet: DiscordRawGatewayPacket) => void;
type DiscordDisconnectHandler = (event?: unknown) => void;
type DiscordErrorHandler = (error: unknown) => void;

export type DiscordReadableMessage = {
  author: {
    bot?: boolean;
    displayName?: string | null;
    username: string;
  };
  channelId: string;
  channelName?: string | null;
  content: string;
  createdAt: Date;
  guildId: string | null;
  id: string;
};

export type DiscordRawGatewayPacket = {
  d?: unknown;
  s?: number | null;
  t?: string | null;
};

type DiscordGatewayClientLike = {
  destroy: () => void;
  isReady: () => boolean;
  login: (token: string) => Promise<string>;
  off: {
    (event: "ready", handler: DiscordReadyHandler): DiscordGatewayClientLike;
    (event: "messageCreate", handler: DiscordMessageHandler): DiscordGatewayClientLike;
    (event: "raw", handler: DiscordRawGatewayHandler): DiscordGatewayClientLike;
    (event: "shardDisconnect", handler: DiscordDisconnectHandler): DiscordGatewayClientLike;
    (event: "error", handler: DiscordErrorHandler): DiscordGatewayClientLike;
  };
  on: {
    (event: "ready", handler: DiscordReadyHandler): DiscordGatewayClientLike;
    (event: "messageCreate", handler: DiscordMessageHandler): DiscordGatewayClientLike;
    (event: "raw", handler: DiscordRawGatewayHandler): DiscordGatewayClientLike;
    (event: "shardDisconnect", handler: DiscordDisconnectHandler): DiscordGatewayClientLike;
    (event: "error", handler: DiscordErrorHandler): DiscordGatewayClientLike;
  };
};

type DiscordChatReadOnlyIntakeOptions = {
  createClient?: () => DiscordGatewayClientLike;
  env?: Record<string, string | undefined>;
  maxRecentMessages?: number;
  maxUnexpectedDisconnectsInWindow?: number;
  onGatewayEvent?: (event: DiscordGatewayProjectedEvent) => void;
  onMessage?: (message: DiscordChatProjectedMessage) => void;
  onReconnectSuppressed?: (status: DiscordChatIntakeStatus) => void;
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

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim().slice(0, 180);
  }

  return "Discord chat intake unavailable.";
};

const getChannelNameFromDiscordMessage = (message: Message): string | null => {
  if ("name" in message.channel && typeof message.channel.name === "string") {
    return message.channel.name;
  }

  return message.channel.type === ChannelType.DM ? "direct-message" : message.channelId;
};

const mapDiscordMessage = (message: Message): DiscordReadableMessage => ({
  author: {
    bot: message.author.bot,
    displayName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    username: message.author.username
  },
  channelId: message.channelId,
  channelName: getChannelNameFromDiscordMessage(message),
  content: message.content,
  createdAt: message.createdAt,
  guildId: message.guildId,
  id: message.id
});

const createDiscordGatewayClient = (): DiscordGatewayClientLike => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  const wrappers = new Map<string, (...args: never[]) => void>();
  const wrapperKey = (event: string, handler: unknown): string => `${event}:${String(handler)}`;

  const adapter: DiscordGatewayClientLike = {
    destroy: () => client.destroy(),
    isReady: () => client.isReady(),
    login: (token) => client.login(token),
    on: (event, handler) => {
      const key = wrapperKey(event, handler);
      if (event === "messageCreate") {
        const wrapped = ((message: Message) => {
          (handler as DiscordMessageHandler)(mapDiscordMessage(message));
        }) as (...args: never[]) => void;
        wrappers.set(key, wrapped);
        client.on(Events.MessageCreate, wrapped as never);
        return adapter;
      }

      if (event === "raw") {
        const wrapped = ((packet: DiscordRawGatewayPacket) => {
          (handler as DiscordRawGatewayHandler)(packet);
        }) as (...args: never[]) => void;
        wrappers.set(key, wrapped);
        client.on(Events.Raw, wrapped as never);
        return adapter;
      }

      wrappers.set(key, handler as (...args: never[]) => void);
      client.on(event === "ready" ? Events.ClientReady : event, handler as never);
      return adapter;
    },
    off: (event, handler) => {
      const key = wrapperKey(event, handler);
      const wrapped = wrappers.get(key) ?? handler as (...args: never[]) => void;
      wrappers.delete(key);

      if (event === "messageCreate") {
        client.off(Events.MessageCreate, wrapped as never);
        return adapter;
      }

      if (event === "raw") {
        client.off(Events.Raw, wrapped as never);
        return adapter;
      }

      client.off(event === "ready" ? Events.ClientReady : event, wrapped as never);
      return adapter;
    }
  };

  return adapter;
};

export class DiscordChatReadOnlyIntakeService {
  private readonly channelIds: readonly string[];
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly createClient: () => DiscordGatewayClientLike;
  private readonly guildId: string;
  private readonly maxUnexpectedDisconnectsInWindow: number;
  private readonly maxRecentMessages: number;
  private readonly now: () => Date;
  private readonly onProjectedGatewayEvent: ((event: DiscordGatewayProjectedEvent) => void) | undefined;
  private readonly onProjectedMessage: ((message: DiscordChatProjectedMessage) => void) | undefined;
  private readonly onReconnectSuppressed: ((status: DiscordChatIntakeStatus) => void) | undefined;
  private readonly reconnectDelayMs: number;
  private readonly reconnectWindowMs: number;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => unknown;
  private readonly token: string;
  private client: DiscordGatewayClientLike | null = null;
  private connectedAt: string | null = null;
  private readonly disconnectTimestamps: number[] = [];
  private lastError: string | null = null;
  private lastDisconnectAt: string | null = null;
  private lastMessageAt: string | null = null;
  private manualStopRequested = false;
  private nextReconnectAt: string | null = null;
  private readonly recentMessages: DiscordChatProjectedMessage[] = [];
  private reconnectSuppressed = false;
  private reconnectTimer: unknown | null = null;
  private state: "stopped" | "connecting" | "connected" = "stopped";

  public constructor(options: DiscordChatReadOnlyIntakeOptions = {}) {
    const env = options.env ?? process.env;
    this.channelIds = resolveDiscordChatChannelIds(env);
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
    this.createClient = options.createClient ?? createDiscordGatewayClient;
    this.guildId = resolveDiscordChatGuildId(env);
    this.maxUnexpectedDisconnectsInWindow = options.maxUnexpectedDisconnectsInWindow ?? 10;
    this.maxRecentMessages = options.maxRecentMessages ?? 25;
    this.now = options.now ?? (() => new Date());
    this.onProjectedGatewayEvent = options.onGatewayEvent;
    this.onProjectedMessage = options.onMessage;
    this.onReconnectSuppressed = options.onReconnectSuppressed;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5_000;
    this.reconnectWindowMs = options.reconnectWindowMs ?? 10 * 60 * 1_000;
    this.setTimeoutFn = options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms));
    this.token = env.DISCORD_BOT_TOKEN?.trim() ?? "";
  }

  public getStatus(): DiscordChatIntakeStatus {
    if (!this.token || !this.guildId) {
      return {
        channelIds: this.channelIds,
        connectedAt: null,
        disconnectsInWindow: 0,
        guildId: this.guildId || null,
        lastError: !this.token ? "DISCORD_BOT_TOKEN is missing." : "DISCORD_GUILD_ID is missing.",
        lastDisconnectAt: null,
        lastMessageAt: null,
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "unconfigured"
      };
    }

    return {
      channelIds: this.channelIds,
      connectedAt: this.connectedAt,
      disconnectsInWindow: this.getDisconnectsInWindow(),
      guildId: this.guildId,
      lastError: this.lastError,
      lastDisconnectAt: this.lastDisconnectAt,
      lastMessageAt: this.lastMessageAt,
      nextReconnectAt: this.nextReconnectAt,
      recentMessages: this.recentMessages.map((message) => ({ ...message })),
      reconnectSuppressed: this.reconnectSuppressed,
      state: this.client?.isReady() ? "connected" : this.state
    };
  }

  public start(): DiscordChatIntakeStatus {
    return this.startInternal({ resetDisconnectWindow: true });
  }

  public stop(): DiscordChatIntakeStatus {
    this.manualStopRequested = true;
    this.clearReconnectTimer();

    if (this.client) {
      this.detachListeners(this.client);
      try {
        this.client.destroy();
      } catch (error) {
        this.lastError = sanitizeError(error);
      }
    }

    this.client = null;
    this.connectedAt = null;
    this.nextReconnectAt = null;
    this.state = "stopped";

    return this.getStatus();
  }

  private startInternal({ resetDisconnectWindow }: { resetDisconnectWindow: boolean }): DiscordChatIntakeStatus {
    if (!this.token || !this.guildId) {
      this.lastError = !this.token ? "DISCORD_BOT_TOKEN is missing." : "DISCORD_GUILD_ID is missing.";
      return this.getStatus();
    }

    if (this.client?.isReady() || this.state === "connecting") {
      return this.getStatus();
    }

    this.manualStopRequested = false;
    this.clearReconnectTimer();
    if (resetDisconnectWindow) {
      this.disconnectTimestamps.splice(0);
      this.reconnectSuppressed = false;
      this.lastDisconnectAt = null;
    }

    const nextClient = this.createClient();
    this.client = nextClient;
    this.lastError = null;
    this.nextReconnectAt = null;
    this.state = "connecting";
    this.attachListeners(nextClient);

    void nextClient.login(this.token).catch((error: unknown) => {
      if (this.client !== nextClient || this.manualStopRequested) {
        return;
      }

      this.lastError = sanitizeError(error);
      this.detachListeners(nextClient);
      this.client = null;
      this.connectedAt = null;
      this.state = "stopped";
      this.scheduleReconnect(error);
    });

    return this.getStatus();
  }

  private attachListeners(client: DiscordGatewayClientLike): void {
    client.on("ready", this.handleReady);
    client.on("messageCreate", this.handleMessage);
    client.on("raw", this.handleRawGatewayPacket);
    client.on("shardDisconnect", this.handleDisconnect);
    client.on("error", this.handleError);
  }

  private detachListeners(client: DiscordGatewayClientLike): void {
    client.off("ready", this.handleReady);
    client.off("messageCreate", this.handleMessage);
    client.off("raw", this.handleRawGatewayPacket);
    client.off("shardDisconnect", this.handleDisconnect);
    client.off("error", this.handleError);
  }

  private readonly handleReady = (): void => {
    this.connectedAt = this.now().toISOString();
    this.lastError = null;
    this.state = "connected";
  };

  private readonly handleMessage = (message: DiscordReadableMessage): void => {
    if (message.author.bot || message.guildId !== this.guildId) {
      return;
    }

    if (this.channelIds.length > 0 && !this.channelIds.includes(message.channelId)) {
      return;
    }

    const projection = projectDiscordChatMessage({
      ...(message.author.displayName !== undefined ? { authorDisplayName: message.author.displayName } : {}),
      authorUsername: message.author.username,
      channelId: message.channelId,
      ...(message.channelName !== undefined ? { channelName: message.channelName } : {}),
      createdAt: message.createdAt,
      guildId: message.guildId,
      messageId: message.id,
      text: message.content
    });

    if (!projection.ok) {
      return;
    }

    this.lastMessageAt = projection.message.createdAt;
    this.recentMessages.unshift(projection.message);
    this.recentMessages.splice(this.maxRecentMessages);
    this.onProjectedMessage?.({ ...projection.message });
  };

  private readonly handleRawGatewayPacket = (packet: DiscordRawGatewayPacket): void => {
    if (!packet.t || !packet.d || typeof packet.d !== "object" || Array.isArray(packet.d)) {
      return;
    }

    const projection = projectDiscordGatewayEvent({
      data: packet.d as Record<string, unknown>,
      guildId: this.guildId,
      providerEventName: packet.t,
      receivedAt: this.now(),
      ...(packet.s === undefined ? {} : { sequence: packet.s })
    });

    if (!projection.ok) {
      return;
    }

    this.onProjectedGatewayEvent?.({ ...projection.event });
  };

  private readonly handleDisconnect = (event?: unknown): void => {
    this.connectedAt = null;
    this.state = "stopped";
    const shouldReconnect = !this.manualStopRequested;
    const currentClient = this.client;
    if (currentClient) {
      this.detachListeners(currentClient);
    }
    this.client = null;

    if (shouldReconnect) {
      this.scheduleReconnect(event);
    }
  };

  private readonly handleError = (error: unknown): void => {
    this.lastError = sanitizeError(error);
  };

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
      this.lastError = "Discord chat disconnected too often; manual reconnect required.";
      this.onReconnectSuppressed?.(this.getStatus());
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
