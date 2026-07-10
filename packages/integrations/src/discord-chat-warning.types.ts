export type DiscordChatWarningInput = {
  authorName: string;
  channelId: string | null | undefined;
  userId: string | null | undefined;
  warningCount: number;
  warningThreshold: number;
};

export type DiscordChatWarningMessage = {
  allowedUserId: string | null;
  content: string;
};

export type DiscordChatWarningDeliveryResult =
  | {
    ok: true;
    providerAction: true;
    providerMessageId: string;
    providerMessageSent: true;
    providerMessage: string;
  }
  | {
    ok: false;
    providerAction: boolean;
    providerMessageId: string | null;
    providerMessageSent: false;
    providerMessage: string | null;
    reason:
      | "discord_warning_unconfigured"
      | "discord_warning_missing_context"
      | "discord_warning_provider_rejected"
      | "discord_warning_unavailable";
  };
