export type ProviderChatModerationAction = "delete_message" | "timeout_author" | "ban_author";

export type ProviderChatModerationResult = {
  ok: true;
  providerAction: true;
  providerActionId: string;
  providerActionSent: true;
} | {
  ok: false;
  providerAction: boolean;
  providerActionId: string | null;
  providerActionSent: false;
  reason:
    | "discord_moderation_missing_context"
    | "discord_moderation_provider_rejected"
    | "discord_moderation_unavailable"
    | "discord_moderation_unconfigured"
    | "provider_moderation_unsupported_source"
    | "twitch_moderation_missing_context"
    | "twitch_moderation_provider_rejected"
    | "twitch_moderation_unavailable"
    | "twitch_moderation_unconfigured"
    | "youtube_provider_moderation_gated";
};

export type DiscordChatModerationInput = {
  action: ProviderChatModerationAction;
  channelId: string | null | undefined;
  durationSeconds?: number | null;
  guildId: string | null | undefined;
  messageId: string | null | undefined;
  reason: string;
  userId: string | null | undefined;
};

export type TwitchChatModerationInput = {
  action: ProviderChatModerationAction;
  broadcasterId?: string | null;
  durationSeconds?: number | null;
  messageId: string | null | undefined;
  moderatorId?: string | null;
  reason: string;
  userId: string | null | undefined;
};
