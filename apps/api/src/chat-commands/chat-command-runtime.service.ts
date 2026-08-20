import {
  createChatCommandExecutionProjection,
  createInMemoryChatCommandCooldownState,
  evaluateChatCommandCooldown,
  markChatCommandCooldownUsed,
  parseChatCommand,
  type ChatCommandBotIdentity,
  type ChatCommandProvider,
  type MutableChatCommandCooldownState
} from "@maiks-yt/domain";
import type {
  DiscordChatProjectedMessage,
  ProviderChatBotDeliveryInput,
  ProviderChatBotDeliveryResult,
  ProviderChatBotDeliveryService,
  TwitchChatProjectedMessage,
  YouTubeLiveChatProjectedMessage
} from "@maiks-yt/integrations";

export type ChatCommandRuntimeMessage =
  | TwitchChatProjectedMessage
  | DiscordChatProjectedMessage
  | YouTubeLiveChatProjectedMessage;

export type ChatCommandRuntimeDelivery = Pick<ProviderChatBotDeliveryService, "send">;

export type ChatCommandRuntimeClassification =
  | {
    consume: false;
    reason: "ordinary_chat";
  }
  | {
    consume: true;
    reason: "command_or_bot_message";
  };

export type ChatCommandRuntimeResult =
  | {
    handled: false;
    reason: "ordinary_chat";
  }
  | {
    handled: true;
    reason:
      | "cooldown"
      | "delivered"
      | "delivery_failed"
      | "malformed_or_unsupported"
      | "self_or_bot_message";
    deliveryResult?: ProviderChatBotDeliveryResult;
  };

const normalizeEnvList = (...values: Array<string | undefined>): readonly string[] =>
  values
    .flatMap((value) => (value ?? "").split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const createBotIdentityFromEnv = (env: Record<string, string | undefined>): ChatCommandBotIdentity => ({
  displayNames: normalizeEnvList(env.CHAT_COMMAND_BOT_DISPLAY_NAMES, env.BOT_DISPLAY_NAMES),
  providerUserIds: normalizeEnvList(env.TWITCH_CHAT_BOT_USER_ID, env.DISCORD_BOT_USER_ID, env.YOUTUBE_BOT_CHANNEL_ID),
  providerUserLogins: normalizeEnvList(env.TWITCH_CHAT_BOT_LOGIN, env.TWITCH_BOT_LOGIN)
});

const resolveUserKey = (message: ChatCommandRuntimeMessage): string =>
  "userId" in message && typeof message.userId === "string" && message.userId.trim().length > 0
    ? message.userId
    : "authorChannelId" in message && typeof message.authorChannelId === "string" && message.authorChannelId.trim().length > 0
      ? message.authorChannelId
      : "userName" in message && typeof message.userName === "string" && message.userName.trim().length > 0
        ? message.userName
        : message.authorName;

const resolveProviderUserLogin = (message: ChatCommandRuntimeMessage): string | null =>
  "userName" in message ? message.userName : null;

const resolveProviderUserId = (message: ChatCommandRuntimeMessage): string | null => {
  if ("userId" in message) {
    return message.userId;
  }

  if ("authorChannelId" in message) {
    return message.authorChannelId;
  }

  return null;
};

const createDeliveryInput = (
  provider: ChatCommandProvider,
  message: ChatCommandRuntimeMessage,
  replyText: string,
  activeYouTubeLiveChatId: string | null
): ProviderChatBotDeliveryInput => {
  if (provider === "twitch") {
    return {
      channelName: "channelName" in message ? message.channelName : null,
      message: replyText,
      provider
    };
  }

  if (provider === "discord") {
    return {
      channelId: "channelId" in message ? message.channelId : null,
      message: replyText,
      provider
    };
  }

  return {
    liveChatId: activeYouTubeLiveChatId,
    message: replyText,
    provider
  };
};

export class ChatCommandRuntime {
  private readonly botIdentity: ChatCommandBotIdentity;
  private readonly cooldownState: MutableChatCommandCooldownState;
  private readonly delivery: ChatCommandRuntimeDelivery;
  private readonly getActiveYouTubeLiveChatId: () => string | null;
  private readonly nowMs: () => number;
  private readonly recentBotReplies = new Map<string, number>();

  public constructor(options: {
    botIdentity?: ChatCommandBotIdentity;
    cooldownState?: MutableChatCommandCooldownState;
    delivery: ChatCommandRuntimeDelivery;
    env?: Record<string, string | undefined>;
    getActiveYouTubeLiveChatId?: () => string | null;
    nowMs?: () => number;
  }) {
    this.botIdentity = options.botIdentity ?? createBotIdentityFromEnv(options.env ?? process.env);
    this.cooldownState = options.cooldownState ?? createInMemoryChatCommandCooldownState();
    this.delivery = options.delivery;
    this.getActiveYouTubeLiveChatId = options.getActiveYouTubeLiveChatId ?? (() => null);
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  public classifyProviderMessage(message: ChatCommandRuntimeMessage): ChatCommandRuntimeClassification {
    if (this.isRecentBotReply(message)) {
      return {
        consume: true,
        reason: "command_or_bot_message"
      };
    }

    const parsedCommand = this.parseProviderMessage(message);

    return parsedCommand.ok || parsedCommand.reason !== "ordinary_chat"
      ? {
        consume: true,
        reason: "command_or_bot_message"
      }
      : {
        consume: false,
        reason: "ordinary_chat"
      };
  }

  public async processProviderMessage(message: ChatCommandRuntimeMessage): Promise<ChatCommandRuntimeResult> {
    if (this.isRecentBotReply(message)) {
      return {
        handled: true,
        reason: "self_or_bot_message"
      };
    }

    const provider = message.source;
    const parsedCommand = this.parseProviderMessage(message);

    if (!parsedCommand.ok) {
      if (parsedCommand.reason === "ordinary_chat") {
        return {
          handled: false,
          reason: "ordinary_chat"
        };
      }

      return {
        handled: true,
        reason: parsedCommand.reason === "self_or_bot_message" ? "self_or_bot_message" : "malformed_or_unsupported"
      };
    }

    const nowMs = this.nowMs();
    const userKey = resolveUserKey(message);
    const cooldown = evaluateChatCommandCooldown({
      command: parsedCommand.command,
      nowMs,
      provider,
      userKey
    }, this.cooldownState);

    if (!cooldown.ok) {
      return {
        handled: true,
        reason: "cooldown"
      };
    }

    markChatCommandCooldownUsed({
      command: parsedCommand.command,
      nowMs,
      provider,
      userKey
    }, this.cooldownState);

    const projection = createChatCommandExecutionProjection(parsedCommand.command);
    const botReplyKey = this.createBotReplyKey(provider, projection.message);
    this.recentBotReplies.set(botReplyKey, this.nowMs() + 30_000);
    const deliveryResult = await this.delivery.send(createDeliveryInput(
      provider,
      message,
      projection.message,
      this.getActiveYouTubeLiveChatId()
    ));

    if (!deliveryResult.ok) {
      this.recentBotReplies.delete(botReplyKey);
    }

    return {
      handled: true,
      deliveryResult,
      reason: deliveryResult.ok ? "delivered" : "delivery_failed"
    };
  }

  private parseProviderMessage(message: ChatCommandRuntimeMessage): ReturnType<typeof parseChatCommand> {
    return parseChatCommand({
      actorKind: message.authorKind,
      authorName: message.authorName,
      botIdentity: this.botIdentity,
      message: message.message,
      provider: message.source,
      providerUserId: resolveProviderUserId(message),
      providerUserLogin: resolveProviderUserLogin(message)
    });
  }

  private createBotReplyKey(provider: ChatCommandProvider, message: string): string {
    return `${provider}:${message.replace(/\s+/g, " ").trim().toLowerCase()}`;
  }

  private isRecentBotReply(message: ChatCommandRuntimeMessage): boolean {
    const nowMs = this.nowMs();

    for (const [key, expiresAt] of this.recentBotReplies) {
      if (expiresAt <= nowMs) {
        this.recentBotReplies.delete(key);
      }
    }

    return (this.recentBotReplies.get(this.createBotReplyKey(message.source, message.message)) ?? 0) > nowMs;
  }
}
