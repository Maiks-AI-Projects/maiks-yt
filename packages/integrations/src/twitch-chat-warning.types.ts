export type TwitchChatWarningInput = {
  authorName: string;
  channelName: string | null | undefined;
  userName: string | null | undefined;
  warningCount: number;
  warningThreshold: number;
};

export type TwitchChatWarningMessage = {
  content: string;
  targetChannelName: string | null;
};

export type TwitchChatWarningDeliveryResult =
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
      | "twitch_warning_unconfigured"
      | "twitch_warning_missing_context"
      | "twitch_warning_provider_rejected"
      | "twitch_warning_unavailable";
  };
