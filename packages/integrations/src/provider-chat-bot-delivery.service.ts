import { refreshUserToken, StaticAuthProvider, type AccessToken } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { google } from "googleapis";

import type {
  ProviderChatBotDeliveryInput,
  ProviderChatBotDeliveryResult,
  ProviderChatBotYouTubeContextResolver,
  ProviderChatBotYouTubeInsert
} from "./provider-chat-bot-delivery.types.js";
import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";
import { hasYouTubeLiveChatWriteScope } from "./youtube-owner-oauth.rules.js";

type TwitchChatClientLike = {
  connect: () => void | Promise<void>;
  quit: () => void | Promise<void>;
  say: (target: string, text: string) => void | Promise<void>;
};

type TwitchClientFactory = (input: {
  accessToken: string;
  channelName: string;
  clientId: string;
}) => TwitchChatClientLike;

type TwitchTokenRefresh = (
  clientId: string,
  clientSecret: string,
  refreshToken: string
) => Promise<AccessToken>;

type FetchLike = (url: string, init: {
  body: string;
  headers: Record<string, string>;
  method: "POST";
}) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}>;

const discordApiBaseUrl = "https://discord.com/api/v10";
const maxProviderChatMessageLength = 500;

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

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeMessage = (value: string): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxProviderChatMessageLength).trim();

const normalizeTwitchChannelName = (value: string | null | undefined): string | null => {
  const normalized = normalizeMessage(value ?? "").replace(/^#/, "").toLowerCase();

  return /^[a-z0-9_]{1,40}$/.test(normalized) ? normalized : null;
};

const normalizeDiscordChannelId = (value: string | null | undefined): string | null => {
  const normalized = normalizeMessage(value ?? "");

  return /^\d{10,30}$/.test(normalized) ? normalized : null;
};

const resolveProviderMessageId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const id = (payload as { id?: unknown }).id;

  return typeof id === "string" && id.trim().length > 0 ? id.trim().slice(0, 191) : null;
};

const createFailure = (
  reason: Extract<ProviderChatBotDeliveryResult, { ok: false }>["reason"],
  providerAction: boolean,
  providerMessage: string | null,
  providerMessageId: string | null = null
): ProviderChatBotDeliveryResult => ({
  ok: false,
  authorKind: "bot",
  providerAction,
  providerMessage,
  providerMessageId,
  providerMessageSent: false,
  reason,
  visibleOnOverlayByDefault: false
});

const createSuccess = (
  providerMessage: string,
  providerMessageId: string
): ProviderChatBotDeliveryResult => ({
  ok: true,
  authorKind: "bot",
  providerAction: true,
  providerMessage,
  providerMessageId,
  providerMessageSent: true,
  visibleOnOverlayByDefault: false
});

const defaultCreateTwitchClient: TwitchClientFactory = ({ accessToken, channelName, clientId }) => {
  const authProvider = new StaticAuthProvider(clientId, accessToken);

  return new ChatClient({
    authProvider,
    channels: [channelName],
    readOnly: false
  });
};

const createYouTubeClient = (context: YouTubeLiveChatContext) => {
  const client = new google.auth.OAuth2(
    context.config.clientId,
    context.config.clientSecret,
    context.config.redirectUri
  );

  client.setCredentials({
    ...(context.credential.accessToken ? { access_token: context.credential.accessToken } : {}),
    refresh_token: context.credential.refreshToken,
    ...(context.credential.accessTokenExpiresAt ? { expiry_date: context.credential.accessTokenExpiresAt.getTime() } : {})
  });

  return google.youtube({
    auth: client,
    version: "v3"
  });
};

const defaultInsertYouTubeMessage: ProviderChatBotYouTubeInsert = async ({ context, liveChatId, text }) => {
  const youtube = createYouTubeClient(context);
  const response = await youtube.liveChatMessages.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        liveChatId,
        textMessageDetails: {
          messageText: text
        },
        type: "textMessageEvent"
      }
    }
  });

  return {
    id: response.data.id ?? null
  };
};

export class ProviderChatBotDeliveryService {
  private readonly discordBotToken: string;
  private readonly fetchFn: FetchLike;
  private twitchAccessToken: string;
  private readonly twitchClientSecret: string;
  private readonly twitchClientId: string;
  private readonly twitchClientFactory: TwitchClientFactory;
  private twitchRefreshInFlight: Promise<string | null> | null = null;
  private twitchRefreshToken: string;
  private readonly twitchTokenRefresh: TwitchTokenRefresh;
  private twitchTokenExpiresAt: number | null;
  private readonly youtubeContextResolver: ProviderChatBotYouTubeContextResolver | null;
  private readonly youtubeInsertMessage: ProviderChatBotYouTubeInsert;

  public constructor(options: {
    createTwitchClient?: TwitchClientFactory;
    env?: Record<string, string | undefined>;
    fetchFn?: FetchLike;
    refreshTwitchToken?: TwitchTokenRefresh;
    youtubeContextResolver?: ProviderChatBotYouTubeContextResolver;
    youtubeInsertMessage?: ProviderChatBotYouTubeInsert;
  } = {}) {
    const env = options.env ?? process.env;
    this.discordBotToken = normalizeEnv(env.DISCORD_BOT_TOKEN);
    this.fetchFn = options.fetchFn ?? fetch;
    this.twitchAccessToken = normalizeEnv(
      env.TWITCH_CHAT_BOT_ACCESS_TOKEN
      ?? env.TWITCH_BOT_ACCESS_TOKEN
      ?? env.TWITCH_ACCESS_TOKEN
    );
    this.twitchClientId = normalizeEnv(env.TWITCH_CLIENT_ID);
    this.twitchClientSecret = normalizeEnv(env.TWITCH_CLIENT_SECRET);
    this.twitchClientFactory = options.createTwitchClient ?? defaultCreateTwitchClient;
    this.twitchRefreshToken = normalizeEnv(env.TWITCH_CHAT_BOT_REFRESH_TOKEN);
    this.twitchTokenExpiresAt = parseExpiration(env.TWITCH_CHAT_BOT_TOKEN_EXPIRES_AT);
    this.twitchTokenRefresh = options.refreshTwitchToken ?? refreshUserToken;
    this.youtubeContextResolver = options.youtubeContextResolver ?? null;
    this.youtubeInsertMessage = options.youtubeInsertMessage ?? defaultInsertYouTubeMessage;
  }

  public async send(input: ProviderChatBotDeliveryInput): Promise<ProviderChatBotDeliveryResult> {
    if (input.provider === "twitch") {
      return this.sendTwitch(input.channelName, input.message);
    }

    if (input.provider === "discord") {
      return this.sendDiscord(input.channelId, input.message);
    }

    return this.sendYouTube(input.liveChatId, input.message);
  }

  private async sendTwitch(
    channelNameInput: string | null | undefined,
    messageInput: string
  ): Promise<ProviderChatBotDeliveryResult> {
    const message = normalizeMessage(messageInput);
    const channelName = normalizeTwitchChannelName(channelNameInput);

    if (!this.twitchClientId || !this.twitchAccessToken) {
      return createFailure("provider_chat_bot_unconfigured", false, message);
    }

    if (!channelName || !message) {
      return createFailure("provider_chat_bot_context_missing", false, message);
    }

    const accessToken = await this.resolveTwitchAccessToken();

    if (!accessToken) {
      return createFailure("provider_chat_bot_unavailable", false, message);
    }

    const client = this.twitchClientFactory({
      accessToken,
      channelName,
      clientId: this.twitchClientId
    });

    try {
      await client.connect();
      await client.say(channelName, message);

      return createSuccess(message, `twitch-bot-command-${Date.now()}`);
    } catch {
      return createFailure("provider_chat_bot_unavailable", true, message, "twitch-bot-command-unavailable");
    } finally {
      try {
        await client.quit();
      } catch {
        // Delivery status should not be changed by cleanup noise.
      }
    }
  }

  private async resolveTwitchAccessToken(): Promise<string | null> {
    if (!this.twitchTokenExpiresAt || this.twitchTokenExpiresAt > Date.now() + 60_000) {
      return this.twitchAccessToken;
    }

    if (!this.twitchClientId || !this.twitchClientSecret || !this.twitchRefreshToken) {
      return null;
    }

    if (!this.twitchRefreshInFlight) {
      this.twitchRefreshInFlight = this.refreshTwitchAccessToken().finally(() => {
        this.twitchRefreshInFlight = null;
      });
    }

    return this.twitchRefreshInFlight;
  }

  private async refreshTwitchAccessToken(): Promise<string | null> {
    try {
      const refreshed = await this.twitchTokenRefresh(
        this.twitchClientId,
        this.twitchClientSecret,
        this.twitchRefreshToken
      );
      this.twitchAccessToken = refreshed.accessToken;
      this.twitchRefreshToken = refreshed.refreshToken ?? this.twitchRefreshToken;
      this.twitchTokenExpiresAt = refreshed.expiresIn
        ? refreshed.obtainmentTimestamp + refreshed.expiresIn * 1_000
        : null;

      return this.twitchAccessToken;
    } catch {
      return null;
    }
  }

  private async sendDiscord(
    channelIdInput: string | null | undefined,
    messageInput: string
  ): Promise<ProviderChatBotDeliveryResult> {
    const message = normalizeMessage(messageInput);
    const channelId = normalizeDiscordChannelId(channelIdInput);

    if (!this.discordBotToken) {
      return createFailure("provider_chat_bot_unconfigured", false, message);
    }

    if (!channelId || !message) {
      return createFailure("provider_chat_bot_context_missing", false, message);
    }

    try {
      const response = await this.fetchFn(`${discordApiBaseUrl}/channels/${channelId}/messages`, {
        body: JSON.stringify({
          allowed_mentions: {
            parse: []
          },
          content: message
        }),
        headers: {
          Authorization: `Bot ${this.discordBotToken}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        return createFailure("provider_chat_bot_provider_rejected", true, message, `discord-http-${response.status}`);
      }

      const payload = await response.json();

      return createSuccess(message, resolveProviderMessageId(payload) ?? `discord-bot-command-${Date.now()}`);
    } catch {
      return createFailure("provider_chat_bot_unavailable", true, message, "discord-bot-command-unavailable");
    }
  }

  private async sendYouTube(
    liveChatIdInput: string | null | undefined,
    messageInput: string
  ): Promise<ProviderChatBotDeliveryResult> {
    const message = normalizeMessage(messageInput).slice(0, 200).trim();
    const liveChatId = normalizeMessage(liveChatIdInput ?? "");

    if (!liveChatId || !message) {
      return createFailure("provider_chat_bot_context_missing", false, message);
    }

    if (!this.youtubeContextResolver) {
      return createFailure("provider_chat_bot_unconfigured", false, message);
    }

    const context = await this.youtubeContextResolver();

    if (!context) {
      return createFailure("provider_chat_bot_context_missing", false, message);
    }

    if (!hasYouTubeLiveChatWriteScope(context.credential.scopes ?? [])) {
      return createFailure("provider_chat_bot_scope_missing", false, message);
    }

    try {
      const inserted = await this.youtubeInsertMessage({
        context,
        liveChatId,
        text: message
      });

      return createSuccess(message, inserted.id ?? `youtube-bot-command-${Date.now()}`);
    } catch {
      return createFailure("provider_chat_bot_unavailable", true, message, "youtube-bot-command-unavailable");
    }
  }
}
