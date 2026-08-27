import type { StreamerChatMessage } from "@maiks-yt/events";

export type StreamerChatMessagesResponse = {
  ok: true;
  source: "mixed";
  messages: StreamerChatMessage[];
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type StreamerChatModerationResponse = {
  ok: true;
  action: "hide" | "ban" | "warn" | "allow";
  affectedCount: number;
  activeUntil?: string | null;
  allowScope?: "message" | "always" | "stream" | "timed";
  autoBanned?: boolean;
  providerAction: boolean;
  providerMessage?: string | null;
  providerMessageSent?: boolean;
  providerWarningReason?: string | null;
  warningCount?: number;
  warningThreshold?: number;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

export type StreamerChatProviderModerationResponse = {
  ok: true;
  action: "delete_message" | "timeout_author" | "ban_author";
  affectedCount: number;
  providerAction: boolean;
  providerActionReason: string | null;
  providerActionSent: boolean;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

export type StreamerChatActionAccess = {
  canAllow?: boolean;
  canBan: boolean;
  canHide: boolean;
  canProviderModerate?: boolean;
  canWarn: boolean;
};

export type StreamerChatViewerProps = {
  actionAccess?: StreamerChatActionAccess;
  apiBaseUrl: string;
  maxMessages?: number;
  newestOnTop: boolean;
  onSelectedMessageChange?: (message: StreamerChatMessage | null) => void;
  showUnavailableActions?: boolean;
  variant?: "embedded" | "standalone";
};
