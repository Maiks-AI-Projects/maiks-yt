import { refreshUserToken, StaticAuthProvider, type AccessToken } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";

import {
  createTwitchChatAvatarResolver,
  type TwitchChatAvatarResolver
} from "./twitch-chat-avatar.service.js";
import {
  projectTwitchChatMessage,
  resolveTwitchChatChannelNames
} from "./twitch-chat-intake.rules.js";
import type {
  TwitchChatIntakeStatus,
  TwitchChatProjectedMessage
} from "./twitch-chat-intake.types.js";

type TwitchChatListener = ReturnType<ChatClient["onConnect"]>;

type TwitchChatClientLike = Pick<
  ChatClient,
  "connect" | "currentChannels" | "isConnected" | "isConnecting" | "onConnect" | "onDisconnect" | "onJoin" | "onJoinFailure" | "onMessage" | "quit"
> & {
  removeListener: (listener: TwitchChatListener) => void;
};

type TwitchChatReadOnlyIntakeOptions = {
  credential?: TwitchChatCredential | null;
  credentialRefreshLeadMs?: number;
  credentialRefreshRetryMs?: number;
  createClient?: (channelNames: readonly string[], authentication: TwitchChatAuthentication | null) => TwitchChatClientLike;
  env?: Record<string, string | undefined>;
  maxRecentMessages?: number;
  joinTimeoutMs?: number;
  maxUnexpectedDisconnectsInWindow?: number;
  onMessage?: (message: TwitchChatProjectedMessage) => void;
  onReconnectSuppressed?: (status: TwitchChatIntakeStatus) => void;
  reconnectDelayMs?: number;
  reconnectWindowMs?: number;
  clearTimeoutFn?: (handle: unknown) => void;
  now?: () => Date;
  setTimeoutFn?: (callback: () => void, ms: number) => unknown;
  resolveAvatarUrl?: TwitchChatAvatarResolver;
  onCredentialRefreshed?: (credential: TwitchChatCredential) => void | Promise<void>;
  refreshCredential?: (clientId: string, clientSecret: string, refreshToken: string) => Promise<AccessToken>;
};

export type TwitchChatAuthentication = {
  accessToken: string;
  clientId: string;
};

export type TwitchChatCredential = TwitchChatAuthentication & {
  accessTokenExpiresAt: number | null;
  clientSecret: string;
  refreshToken: string;
};

const sanitizeError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 180);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim().slice(0, 180);
  }

  return "Twitch chat intake unavailable.";
};

const normalizeEnv = (value: string | undefined): string => value?.trim() ?? "";

const parseExpiration = (value: string | undefined): number | null => {
  const normalized = normalizeEnv(value);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  const parsed = Number.isFinite(numeric)
    ? (numeric < 10_000_000_000 ? numeric * 1_000 : numeric)
    : Date.parse(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveTwitchChatAuthentication = (
  env: Record<string, string | undefined>
): TwitchChatAuthentication | null => {
  const clientId = normalizeEnv(env.TWITCH_CLIENT_ID);
  const accessToken = normalizeEnv(
    env.TWITCH_CHAT_BOT_ACCESS_TOKEN
    ?? env.TWITCH_BOT_ACCESS_TOKEN
    ?? env.TWITCH_ACCESS_TOKEN
  );

  return clientId && accessToken ? { accessToken, clientId } : null;
};

export const resolveTwitchChatCredential = (
  env: Record<string, string | undefined>
): TwitchChatCredential | null => {
  const authentication = resolveTwitchChatAuthentication(env);
  const clientSecret = normalizeEnv(env.TWITCH_CLIENT_SECRET);
  const refreshToken = normalizeEnv(env.TWITCH_CHAT_BOT_REFRESH_TOKEN);

  return authentication && clientSecret && refreshToken
    ? {
        ...authentication,
        accessTokenExpiresAt: parseExpiration(env.TWITCH_CHAT_BOT_TOKEN_EXPIRES_AT),
        clientSecret,
        refreshToken
      }
    : null;
};

export class TwitchChatReadOnlyIntakeService {
  private readonly channelNames: readonly string[];
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly createClient: (channelNames: readonly string[], authentication: TwitchChatAuthentication | null) => TwitchChatClientLike;
  private readonly requiresAuthentication: boolean;
  private readonly credentialRefreshLeadMs: number;
  private readonly credentialRefreshRetryMs: number;
  private readonly maxUnexpectedDisconnectsInWindow: number;
  private readonly maxRecentMessages: number;
  private readonly joinTimeoutMs: number;
  private readonly now: () => Date;
  private readonly onProjectedMessage: ((message: TwitchChatProjectedMessage) => void) | undefined;
  private readonly onReconnectSuppressed: ((status: TwitchChatIntakeStatus) => void) | undefined;
  private readonly reconnectDelayMs: number;
  private readonly reconnectWindowMs: number;
  private readonly resolveAvatarUrl: TwitchChatAvatarResolver | null;
  private readonly onCredentialRefreshed: ((credential: TwitchChatCredential) => void | Promise<void>) | undefined;
  private readonly refreshCredentialFn: (clientId: string, clientSecret: string, refreshToken: string) => Promise<AccessToken>;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => unknown;
  private authentication: TwitchChatAuthentication | null;
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
  private joinTimer: unknown | null = null;
  private credential: TwitchChatCredential | null;
  private credentialPersistenceTimer: unknown | null = null;
  private credentialRefreshInFlight: Promise<boolean> | null = null;
  private credentialRefreshTimer: unknown | null = null;

  public constructor(options: TwitchChatReadOnlyIntakeOptions = {}) {
    const env = options.env ?? process.env;
    this.channelNames = resolveTwitchChatChannelNames(env);
    this.credential = options.credential === undefined
      ? resolveTwitchChatCredential(env)
      : options.credential;
    this.authentication = this.credential ?? resolveTwitchChatAuthentication(env);
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
    this.requiresAuthentication = !options.createClient;
    this.createClient = options.createClient ?? ((channelNames, authentication) => {
      if (!authentication) {
        throw new Error("Authenticated Twitch chat intake is not configured.");
      }

      return new ChatClient({
        authProvider: new StaticAuthProvider(authentication.clientId, authentication.accessToken),
        channels: [...channelNames],
        readOnly: true
      });
    });
    this.credentialRefreshLeadMs = options.credentialRefreshLeadMs ?? 5 * 60 * 1_000;
    this.credentialRefreshRetryMs = options.credentialRefreshRetryMs ?? 60_000;
    this.maxUnexpectedDisconnectsInWindow = options.maxUnexpectedDisconnectsInWindow ?? 10;
    this.maxRecentMessages = options.maxRecentMessages ?? 25;
    this.joinTimeoutMs = options.joinTimeoutMs ?? 15_000;
    this.now = options.now ?? (() => new Date());
    this.onProjectedMessage = options.onMessage;
    this.onReconnectSuppressed = options.onReconnectSuppressed;
    this.onCredentialRefreshed = options.onCredentialRefreshed;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5_000;
    this.reconnectWindowMs = options.reconnectWindowMs ?? 10 * 60 * 1_000;
    const avatarClientId = normalizeEnv(env.TWITCH_CLIENT_ID);
    const avatarClientSecret = normalizeEnv(env.TWITCH_CLIENT_SECRET);
    this.resolveAvatarUrl = options.resolveAvatarUrl ?? createTwitchChatAvatarResolver({
      appAuthentication: avatarClientId && avatarClientSecret
        ? { clientId: avatarClientId, clientSecret: avatarClientSecret }
        : null,
      authentication: resolveTwitchChatAuthentication(env)
    });
    this.refreshCredentialFn = options.refreshCredential ?? refreshUserToken;
    this.setTimeoutFn = options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms));
  }

  public getStatus(): TwitchChatIntakeStatus {
    const primaryChannelName = this.channelNames[0];

    if (!primaryChannelName) {
      return {
        channelName: null,
        channelNames: [],
        joinedChannelNames: [],
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
      channelName: primaryChannelName,
      channelNames: [...this.channelNames],
      joinedChannelNames: this.getJoinedChannelNames(),
      connectedAt: this.connectedAt,
      disconnectsInWindow: this.getDisconnectsInWindow(),
      lastError: this.lastError,
      lastDisconnectAt: this.lastDisconnectAt,
      lastMessageAt: this.lastMessageAt,
      nextReconnectAt: this.nextReconnectAt,
      recentMessages: this.recentMessages.map((message) => ({ ...message })),
      reconnectSuppressed: this.reconnectSuppressed,
      state: this.hasJoinedEveryConfiguredChannel()
        ? "connected"
        : this.client?.isConnecting || this.client?.isConnected
          ? "connecting"
          : "stopped"
    };
  }

  public start(): TwitchChatIntakeStatus {
    return this.startInternal({ resetDisconnectWindow: true });
  }

  public stop(): TwitchChatIntakeStatus {
    this.manualStopRequested = true;
    this.clearJoinTimer();
    this.clearReconnectTimer();
    this.clearCredentialRefreshTimer();
    this.clearCredentialPersistenceTimer();

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
    if (this.channelNames.length === 0) {
      this.lastError = "TWITCH_CHAT_CHANNELS is empty.";
      return this.getStatus();
    }

    if (this.client?.isConnected || this.client?.isConnecting) {
      return this.getStatus();
    }

    this.manualStopRequested = false;

    if (!this.authentication && this.requiresAuthentication) {
      this.lastError = "Authenticated Twitch chat intake is not configured.";
      return this.getStatus();
    }

    if (this.shouldRefreshCredential()) {
      void this.refreshCredentialAndStart(resetDisconnectWindow);
      return this.getStatus();
    }

    this.clearReconnectTimer();
    if (resetDisconnectWindow) {
      this.disconnectTimestamps.splice(0);
      this.reconnectSuppressed = false;
      this.lastDisconnectAt = null;
    }

    this.clearListeners();
    const nextClient = this.createClient(this.channelNames, this.authentication);
    this.client = nextClient;
    this.lastError = null;
    this.nextReconnectAt = null;

    this.listenerIds.push(nextClient.onConnect(() => {
      this.startJoinTimer(nextClient);
    }));
    this.listenerIds.push(nextClient.onJoin(() => {
      this.refreshJoinedState(nextClient);
    }));
    this.listenerIds.push(nextClient.onJoinFailure((channel, reason) => {
      this.failJoin(nextClient, `Twitch chat failed to join #${channel.replace(/^#/, "")}: ${reason}`);
    }));
    this.listenerIds.push(nextClient.onDisconnect((manually, reason) => {
      this.connectedAt = null;
      this.clearJoinTimer();
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
      const userId = (msg.userInfo as { userId?: string | null }).userId ?? null;
      const projectionInput = {
        channelName: channel,
        createdAt: msg.date,
        displayName: msg.userInfo.displayName,
        emoteOffsets: msg.emoteOffsets,
        messageId: msg.id,
        text,
        userId,
        userName: user
      };
      const recordMessage = (avatarUrl?: string | null): void => {
        const projection = projectTwitchChatMessage({
          ...projectionInput,
          ...(avatarUrl ? { avatarUrl } : {})
        });
        if (!projection.ok) {
          return;
        }

        this.lastMessageAt = projection.message.createdAt;
        this.recentMessages.unshift(projection.message);
        this.recentMessages.splice(this.maxRecentMessages);
        this.onProjectedMessage?.({ ...projection.message });
      };

      if (!userId || !this.resolveAvatarUrl) {
        recordMessage();
        return;
      }

      void this.resolveAvatarUrl(userId).then(recordMessage, () => recordMessage());
    }));

    try {
      const connectResult = nextClient.connect();
      void Promise.resolve(connectResult).catch((error: unknown) => {
        if (this.client !== nextClient || this.manualStopRequested) {
          return;
        }

        this.lastError = sanitizeError(error);
        this.clearListeners();
        this.client = null;
        this.connectedAt = null;
        this.clearJoinTimer();
        this.scheduleReconnect(error);
      });
    } catch (error) {
      this.lastError = sanitizeError(error);
      this.clearListeners();
      this.client = null;
      this.connectedAt = null;
      this.clearJoinTimer();
      this.scheduleReconnect(error);
    }

    this.scheduleCredentialRefresh();

    return this.getStatus();
  }

  private async refreshCredentialAndStart(resetDisconnectWindow: boolean): Promise<void> {
    const refreshed = await this.refreshCredential();
    if (refreshed && !this.manualStopRequested) {
      this.startInternal({ resetDisconnectWindow });
    }
  }

  private shouldRefreshCredential(): boolean {
    return Boolean(
      this.credential
      && this.credential.accessTokenExpiresAt !== null
      && this.credential.accessTokenExpiresAt <= this.now().getTime() + this.credentialRefreshLeadMs
    );
  }

  private async refreshCredential(): Promise<boolean> {
    if (this.credentialRefreshInFlight) {
      return this.credentialRefreshInFlight;
    }

    const current = this.credential;
    if (!current) {
      return false;
    }

    this.clearCredentialRefreshTimer();
    this.credentialRefreshInFlight = (async () => {
      try {
        const refreshed = await this.refreshCredentialFn(
          current.clientId,
          current.clientSecret,
          current.refreshToken
        );
        const nextCredential: TwitchChatCredential = {
          accessToken: refreshed.accessToken,
          accessTokenExpiresAt: refreshed.expiresIn === null
            ? null
            : refreshed.obtainmentTimestamp + refreshed.expiresIn * 1_000,
          clientId: current.clientId,
          clientSecret: current.clientSecret,
          refreshToken: refreshed.refreshToken ?? current.refreshToken
        };

        this.credential = nextCredential;
        this.authentication = nextCredential;
        this.lastError = null;
        await this.persistCredential(nextCredential);
        this.scheduleCredentialRefresh();
        return true;
      } catch (error) {
        this.lastError = sanitizeError(error);
        this.credentialRefreshTimer = this.setTimeoutFn(() => {
          this.credentialRefreshTimer = null;
          void this.refreshCredential().then((refreshed) => {
            if (refreshed && !this.client && !this.manualStopRequested) {
              this.startInternal({ resetDisconnectWindow: false });
            }
          });
        }, this.credentialRefreshRetryMs);
        return false;
      } finally {
        this.credentialRefreshInFlight = null;
      }
    })();

    return this.credentialRefreshInFlight;
  }

  private async persistCredential(credential: TwitchChatCredential): Promise<void> {
    if (!this.onCredentialRefreshed) {
      return;
    }

    this.clearCredentialPersistenceTimer();
    try {
      await this.onCredentialRefreshed({ ...credential });
    } catch (error) {
      this.lastError = `Twitch credential persistence failed: ${sanitizeError(error)}`;
      this.credentialPersistenceTimer = this.setTimeoutFn(() => {
        this.credentialPersistenceTimer = null;
        if (this.credential === credential && !this.manualStopRequested) {
          void this.persistCredential(credential);
        }
      }, this.credentialRefreshRetryMs);
    }
  }

  private scheduleCredentialRefresh(): void {
    this.clearCredentialRefreshTimer();
    if (!this.credential || this.credential.accessTokenExpiresAt === null || this.manualStopRequested) {
      return;
    }

    const delayMs = Math.max(
      0,
      this.credential.accessTokenExpiresAt - this.now().getTime() - this.credentialRefreshLeadMs
    );
    this.credentialRefreshTimer = this.setTimeoutFn(() => {
      this.credentialRefreshTimer = null;
      void this.refreshCredential();
    }, delayMs);
  }

  private clearCredentialRefreshTimer(): void {
    if (this.credentialRefreshTimer) {
      this.clearTimeoutFn(this.credentialRefreshTimer);
      this.credentialRefreshTimer = null;
    }
  }

  private clearCredentialPersistenceTimer(): void {
    if (this.credentialPersistenceTimer) {
      this.clearTimeoutFn(this.credentialPersistenceTimer);
      this.credentialPersistenceTimer = null;
    }
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

  private clearJoinTimer(): void {
    if (this.joinTimer) {
      this.clearTimeoutFn(this.joinTimer);
      this.joinTimer = null;
    }
  }

  private getJoinedChannelNames(client = this.client): string[] {
    if (!client) {
      return [];
    }

    return [...new Set(client.currentChannels
      .map((channel) => channel.replace(/^#/, "").trim().toLowerCase())
      .filter((channel) => channel.length > 0))];
  }

  private hasJoinedEveryConfiguredChannel(client = this.client): boolean {
    const joined = new Set(this.getJoinedChannelNames(client));
    return this.channelNames.length > 0 && this.channelNames.every((channel) => joined.has(channel));
  }

  private refreshJoinedState(client: TwitchChatClientLike): void {
    if (this.client !== client || !this.hasJoinedEveryConfiguredChannel(client)) {
      return;
    }

    this.clearJoinTimer();
    this.connectedAt ??= this.now().toISOString();
    this.lastError = null;
  }

  private startJoinTimer(client: TwitchChatClientLike): void {
    this.clearJoinTimer();
    this.refreshJoinedState(client);
    if (this.client !== client || this.hasJoinedEveryConfiguredChannel(client)) {
      return;
    }

    this.joinTimer = this.setTimeoutFn(() => {
      this.joinTimer = null;
      if (this.client === client && !this.hasJoinedEveryConfiguredChannel(client)) {
        const missing = this.channelNames.filter((channel) => !this.getJoinedChannelNames(client).includes(channel));
        this.failJoin(client, `Twitch chat did not join ${missing.map((channel) => `#${channel}`).join(", ")} within ${Math.ceil(this.joinTimeoutMs / 1_000)} seconds.`);
      }
    }, this.joinTimeoutMs);
  }

  private failJoin(client: TwitchChatClientLike, reason: string): void {
    if (this.client !== client) {
      return;
    }

    this.clearJoinTimer();
    this.lastError = sanitizeError(new Error(reason));
    this.clearListeners();
    try {
      client.quit();
    } catch {
      // The reconnect below owns recovery even if the failed socket cannot close cleanly.
    }
    this.client = null;
    this.connectedAt = null;
    this.scheduleReconnect(this.lastError);
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
