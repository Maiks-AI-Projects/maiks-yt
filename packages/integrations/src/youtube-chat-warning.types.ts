import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";

export type YouTubeChatWarningInput = {
  authorName: string;
  authorChannelId: string | null | undefined;
  liveChatId: string | null | undefined;
  warningCount: number;
  warningThreshold: number;
};

export type YouTubeChatWarningMessage = {
  content: string;
};

export type YouTubeChatWarningContextResolver = () => Promise<YouTubeLiveChatContext | null>;

export type YouTubeChatWarningInsertResult = {
  id: string | null;
};

export type YouTubeChatWarningInsert = (input: {
  context: YouTubeLiveChatContext;
  liveChatId: string;
  text: string;
}) => Promise<YouTubeChatWarningInsertResult>;

export type YouTubeChatWarningDeliveryResult =
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
      | "youtube_warning_context_missing"
      | "youtube_warning_live_chat_missing"
      | "youtube_warning_scope_missing"
      | "youtube_warning_provider_rejected"
      | "youtube_warning_unavailable";
  };
