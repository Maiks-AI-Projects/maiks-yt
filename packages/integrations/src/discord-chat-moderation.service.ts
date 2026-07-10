import {
  createProviderModerationActionId,
  normalizeProviderModerationDurationSeconds,
  normalizeProviderModerationReason,
  normalizeProviderModerationText
} from "./provider-chat-moderation.rules.js";
import type {
  DiscordChatModerationInput,
  ProviderChatModerationResult
} from "./provider-chat-moderation.types.js";

type DiscordModerationFetchInit = {
  body?: string;
  headers: Record<string, string>;
  method: "DELETE" | "PATCH" | "PUT";
};

type FetchLike = (url: string, init: DiscordModerationFetchInit) => Promise<{
  ok: boolean;
  status: number;
}>;

const discordApiBaseUrl = "https://discord.com/api/v10";

const normalizeToken = (value: string | undefined): string => value?.trim() ?? "";

export class DiscordChatModerationService {
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

  public async moderate(input: DiscordChatModerationInput): Promise<ProviderChatModerationResult> {
    if (!this.botToken) {
      return {
        ok: false,
        providerAction: false,
        providerActionId: null,
        providerActionSent: false,
        reason: "discord_moderation_unconfigured"
      };
    }

    const channelId = normalizeProviderModerationText(input.channelId);
    const guildId = normalizeProviderModerationText(input.guildId);
    const messageId = normalizeProviderModerationText(input.messageId);
    const userId = normalizeProviderModerationText(input.userId);
    const request = this.createRequest({ ...input, channelId, guildId, messageId, userId });

    if (!request) {
      return {
        ok: false,
        providerAction: false,
        providerActionId: null,
        providerActionSent: false,
        reason: "discord_moderation_missing_context"
      };
    }

    try {
      const response = await this.fetchFn(request.url, {
        ...request.init,
        headers: {
          ...request.init.headers,
          Authorization: `Bot ${this.botToken}`,
          "X-Audit-Log-Reason": encodeURIComponent(normalizeProviderModerationReason(input.reason))
        }
      });
      const providerActionId = createProviderModerationActionId("discord", input.action, response.ok ? "ok" : response.status);

      if (!response.ok) {
        return {
          ok: false,
          providerAction: true,
          providerActionId,
          providerActionSent: false,
          reason: "discord_moderation_provider_rejected"
        };
      }

      return {
        ok: true,
        providerAction: true,
        providerActionId,
        providerActionSent: true
      };
    } catch {
      return {
        ok: false,
        providerAction: true,
        providerActionId: createProviderModerationActionId("discord", input.action, "unavailable"),
        providerActionSent: false,
        reason: "discord_moderation_unavailable"
      };
    }
  }

  private createRequest(input: DiscordChatModerationInput & {
    channelId: string;
    guildId: string;
    messageId: string;
    userId: string;
  }): { init: Omit<DiscordModerationFetchInit, "headers"> & { headers: Record<string, string> }; url: string } | null {
    if (input.action === "delete_message") {
      if (!input.channelId || !input.messageId) {
        return null;
      }

      return {
        url: `${discordApiBaseUrl}/channels/${input.channelId}/messages/${input.messageId}`,
        init: {
          headers: {},
          method: "DELETE"
        }
      };
    }

    if (!input.guildId || !input.userId) {
      return null;
    }

    if (input.action === "timeout_author") {
      const durationSeconds = normalizeProviderModerationDurationSeconds(input.durationSeconds);
      const timeoutUntil = new Date(Date.now() + durationSeconds * 1000).toISOString();

      return {
        url: `${discordApiBaseUrl}/guilds/${input.guildId}/members/${input.userId}`,
        init: {
          body: JSON.stringify({
            communication_disabled_until: timeoutUntil
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "PATCH"
        }
      };
    }

    return {
      url: `${discordApiBaseUrl}/guilds/${input.guildId}/bans/${input.userId}`,
      init: {
        body: JSON.stringify({
          delete_message_seconds: 0
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PUT"
      }
    };
  }
}
