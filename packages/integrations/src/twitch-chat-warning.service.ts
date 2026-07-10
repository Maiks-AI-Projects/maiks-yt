import { StaticAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";

import {
  createTwitchWarningMessage,
  normalizeTwitchWarningChannelName
} from "./twitch-chat-warning.rules.js";
import type {
  TwitchChatWarningDeliveryResult,
  TwitchChatWarningInput
} from "./twitch-chat-warning.types.js";

type TwitchWarningChatClientLike = {
  connect: () => void | Promise<void>;
  quit: () => void | Promise<void>;
  say: (target: string, text: string) => void | Promise<void>;
};

type TwitchWarningClientFactory = (input: {
  accessToken: string;
  channelName: string;
  clientId: string;
}) => TwitchWarningChatClientLike;

const normalizeEnv = (value: string | undefined): string => value?.trim() ?? "";

const defaultCreateClient: TwitchWarningClientFactory = ({ accessToken, channelName, clientId }) => {
  const authProvider = new StaticAuthProvider(clientId, accessToken);

  return new ChatClient({
    authProvider,
    channels: [channelName],
    readOnly: false
  });
};

export class TwitchChatWarningDeliveryService {
  private readonly accessToken: string;
  private readonly clientId: string;
  private readonly createClient: TwitchWarningClientFactory;

  public constructor(options: {
    createClient?: TwitchWarningClientFactory;
    env?: Record<string, string | undefined>;
  } = {}) {
    const env = options.env ?? process.env;
    this.accessToken = normalizeEnv(
      env.TWITCH_CHAT_BOT_ACCESS_TOKEN
      ?? env.TWITCH_BOT_ACCESS_TOKEN
      ?? env.TWITCH_ACCESS_TOKEN
    );
    this.clientId = normalizeEnv(env.TWITCH_CLIENT_ID);
    this.createClient = options.createClient ?? defaultCreateClient;
  }

  public async sendWarning(input: TwitchChatWarningInput): Promise<TwitchChatWarningDeliveryResult> {
    const channelName = normalizeTwitchWarningChannelName(input.channelName);
    const warningMessage = createTwitchWarningMessage(input);

    if (!this.clientId || !this.accessToken) {
      return {
        ok: false,
        providerAction: false,
        providerMessageId: null,
        providerMessageSent: false,
        providerMessage: warningMessage.content,
        reason: "twitch_warning_unconfigured"
      };
    }

    if (!channelName) {
      return {
        ok: false,
        providerAction: false,
        providerMessageId: null,
        providerMessageSent: false,
        providerMessage: warningMessage.content,
        reason: "twitch_warning_missing_context"
      };
    }

    const client = this.createClient({
      accessToken: this.accessToken,
      channelName,
      clientId: this.clientId
    });

    try {
      await client.connect();
      await client.say(channelName, warningMessage.content);

      return {
        ok: true,
        providerAction: true,
        providerMessageId: `twitch-warning-${Date.now()}`,
        providerMessageSent: true,
        providerMessage: warningMessage.content
      };
    } catch {
      return {
        ok: false,
        providerAction: true,
        providerMessageId: "twitch-warning-unavailable",
        providerMessageSent: false,
        providerMessage: warningMessage.content,
        reason: "twitch_warning_unavailable"
      };
    } finally {
      try {
        await client.quit();
      } catch {
        // The warning result should reflect send success/failure, not cleanup noise.
      }
    }
  }
}
