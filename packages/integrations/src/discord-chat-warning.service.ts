import {
  createDiscordWarningMessage,
  normalizeDiscordWarningChannelId
} from "./discord-chat-warning.rules.js";
import type {
  DiscordChatWarningDeliveryResult,
  DiscordChatWarningInput
} from "./discord-chat-warning.types.js";

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

const normalizeToken = (value: string | undefined): string => value?.trim() ?? "";

const resolveProviderMessageId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const id = (payload as { id?: unknown }).id;

  return typeof id === "string" && id.trim().length > 0 ? id.trim().slice(0, 191) : null;
};

export class DiscordChatWarningDeliveryService {
  private readonly botToken: string;
  private readonly fetchFn: FetchLike;

  public constructor(options: {
    env?: Record<string, string | undefined>;
    fetchFn?: FetchLike;
  } = {}) {
    const env = options.env ?? process.env;
    this.botToken = normalizeToken(env.DISCORD_BOT_TOKEN);
    this.fetchFn = options.fetchFn ?? fetch;
  }

  public async sendWarning(input: DiscordChatWarningInput): Promise<DiscordChatWarningDeliveryResult> {
    const channelId = normalizeDiscordWarningChannelId(input.channelId);
    const warningMessage = createDiscordWarningMessage(input);

    if (!this.botToken) {
      return {
        ok: false,
        providerAction: false,
        providerMessageId: null,
        providerMessageSent: false,
        providerMessage: warningMessage.content,
        reason: "discord_warning_unconfigured"
      };
    }

    if (!channelId) {
      return {
        ok: false,
        providerAction: false,
        providerMessageId: null,
        providerMessageSent: false,
        providerMessage: warningMessage.content,
        reason: "discord_warning_missing_context"
      };
    }

    try {
      const response = await this.fetchFn(`${discordApiBaseUrl}/channels/${channelId}/messages`, {
        body: JSON.stringify({
          allowed_mentions: warningMessage.allowedUserId
            ? {
              parse: [],
              users: [warningMessage.allowedUserId]
            }
            : {
              parse: []
            },
          content: warningMessage.content
        }),
        headers: {
          Authorization: `Bot ${this.botToken}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        return {
          ok: false,
          providerAction: true,
          providerMessageId: `discord-http-${response.status}`,
          providerMessageSent: false,
          providerMessage: warningMessage.content,
          reason: "discord_warning_provider_rejected"
        };
      }

      const payload = await response.json();
      const providerMessageId = resolveProviderMessageId(payload) ?? `discord-warning-${Date.now()}`;

      return {
        ok: true,
        providerAction: true,
        providerMessageId,
        providerMessageSent: true,
        providerMessage: warningMessage.content
      };
    } catch {
      return {
        ok: false,
        providerAction: true,
        providerMessageId: "discord-warning-unavailable",
        providerMessageSent: false,
        providerMessage: warningMessage.content,
        reason: "discord_warning_unavailable"
      };
    }
  }
}
