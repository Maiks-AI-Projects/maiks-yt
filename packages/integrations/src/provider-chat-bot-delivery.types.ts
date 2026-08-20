import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";

export type ProviderChatBotDeliveryProvider = "twitch" | "youtube" | "discord";

export type ProviderChatBotDeliveryInput =
  | {
    channelName: string | null | undefined;
    message: string;
    provider: "twitch";
  }
  | {
    channelId: string | null | undefined;
    message: string;
    provider: "discord";
  }
  | {
    liveChatId: string | null | undefined;
    message: string;
    provider: "youtube";
  };

export type ProviderChatBotDeliveryResult =
  | {
    ok: true;
    authorKind: "bot";
    providerAction: true;
    providerMessage: string;
    providerMessageId: string;
    providerMessageSent: true;
    visibleOnOverlayByDefault: false;
  }
  | {
    ok: false;
    authorKind: "bot";
    providerAction: boolean;
    providerMessage: string | null;
    providerMessageId: string | null;
    providerMessageSent: false;
    reason:
      | "provider_chat_bot_context_missing"
      | "provider_chat_bot_provider_rejected"
      | "provider_chat_bot_scope_missing"
      | "provider_chat_bot_unavailable"
      | "provider_chat_bot_unconfigured";
    visibleOnOverlayByDefault: false;
  };

export type ProviderChatBotYouTubeContextResolver = () => Promise<YouTubeLiveChatContext | null>;

export type ProviderChatBotYouTubeInsert = (input: {
  context: YouTubeLiveChatContext;
  liveChatId: string;
  text: string;
}) => Promise<{
  id: string | null;
}>;
