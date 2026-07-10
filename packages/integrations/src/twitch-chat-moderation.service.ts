import {
  createProviderModerationActionId,
  normalizeProviderModerationDurationSeconds,
  normalizeProviderModerationReason,
  normalizeProviderModerationText
} from "./provider-chat-moderation.rules.js";
import type {
  ProviderChatModerationResult,
  TwitchChatModerationInput
} from "./provider-chat-moderation.types.js";

type TwitchModerationFetchInit = {
  body?: string;
  headers: Record<string, string>;
  method: "DELETE" | "POST";
};

type FetchLike = (url: string, init: TwitchModerationFetchInit) => Promise<{
  ok: boolean;
  status: number;
}>;

const twitchApiBaseUrl = "https://api.twitch.tv/helix";

const normalizeEnv = (value: string | undefined): string => value?.trim() ?? "";

export class TwitchChatModerationService {
  private readonly accessToken: string;
  private readonly broadcasterId: string;
  private readonly clientId: string;
  private readonly fetchFn: FetchLike;
  private readonly moderatorId: string;

  public constructor(options: {
    env?: Record<string, string | undefined>;
    fetchFn?: FetchLike;
  } = {}) {
    const env = options.env ?? process.env;
    this.accessToken = normalizeEnv(
      env.TWITCH_CHAT_BOT_ACCESS_TOKEN
      ?? env.TWITCH_BOT_ACCESS_TOKEN
      ?? env.TWITCH_ACCESS_TOKEN
    );
    this.broadcasterId = normalizeEnv(
      env.TWITCH_BROADCASTER_ID
      ?? env.TWITCH_BROADCASTER_USER_ID
      ?? env.TWITCH_CHANNEL_ID
    );
    this.clientId = normalizeEnv(env.TWITCH_CLIENT_ID);
    this.fetchFn = options.fetchFn ?? fetch;
    this.moderatorId = normalizeEnv(
      env.TWITCH_MODERATOR_ID
      ?? env.TWITCH_MODERATOR_USER_ID
      ?? this.broadcasterId
    );
  }

  public async moderate(input: TwitchChatModerationInput): Promise<ProviderChatModerationResult> {
    if (!this.accessToken || !this.clientId) {
      return {
        ok: false,
        providerAction: false,
        providerActionId: null,
        providerActionSent: false,
        reason: "twitch_moderation_unconfigured"
      };
    }

    const broadcasterId = normalizeProviderModerationText(input.broadcasterId ?? this.broadcasterId);
    const messageId = normalizeProviderModerationText(input.messageId);
    const moderatorId = normalizeProviderModerationText(input.moderatorId ?? this.moderatorId);
    const userId = normalizeProviderModerationText(input.userId);
    const request = this.createRequest({ ...input, broadcasterId, messageId, moderatorId, userId });

    if (!request) {
      return {
        ok: false,
        providerAction: false,
        providerActionId: null,
        providerActionSent: false,
        reason: "twitch_moderation_missing_context"
      };
    }

    try {
      const response = await this.fetchFn(request.url, {
        ...request.init,
        headers: {
          ...request.init.headers,
          Authorization: `Bearer ${this.accessToken}`,
          "Client-Id": this.clientId
        }
      });
      const providerActionId = createProviderModerationActionId("twitch", input.action, response.ok ? "ok" : response.status);

      if (!response.ok) {
        return {
          ok: false,
          providerAction: true,
          providerActionId,
          providerActionSent: false,
          reason: "twitch_moderation_provider_rejected"
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
        providerActionId: createProviderModerationActionId("twitch", input.action, "unavailable"),
        providerActionSent: false,
        reason: "twitch_moderation_unavailable"
      };
    }
  }

  private createRequest(input: TwitchChatModerationInput & {
    broadcasterId: string;
    messageId: string;
    moderatorId: string;
    userId: string;
  }): { init: Omit<TwitchModerationFetchInit, "headers"> & { headers: Record<string, string> }; url: string } | null {
    if (!input.broadcasterId || !input.moderatorId) {
      return null;
    }

    const params = new URLSearchParams({
      broadcaster_id: input.broadcasterId,
      moderator_id: input.moderatorId
    });

    if (input.action === "delete_message") {
      if (!input.messageId) {
        return null;
      }

      params.set("message_id", input.messageId);

      return {
        url: `${twitchApiBaseUrl}/moderation/chat?${params.toString()}`,
        init: {
          headers: {},
          method: "DELETE"
        }
      };
    }

    if (!input.userId) {
      return null;
    }

    const data: {
      duration?: number;
      reason: string;
      user_id: string;
    } = {
      reason: normalizeProviderModerationReason(input.reason),
      user_id: input.userId
    };

    if (input.action === "timeout_author") {
      data.duration = normalizeProviderModerationDurationSeconds(input.durationSeconds);
    }

    return {
      url: `${twitchApiBaseUrl}/moderation/bans?${params.toString()}`,
      init: {
        body: JSON.stringify({ data }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    };
  }
}
