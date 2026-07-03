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

export type FakeLocalModerationResponse = {
  ok: true;
  source: "fake-local";
  providerAction: false;
  auditEntry: {
    outcome: string;
    mutedUntil: string | null;
  };
} | {
  ok: false;
  reason: string;
  source: "fake-local";
  providerAction: false;
};

export type StreamerChatModerationResponse = {
  ok: true;
  action: "hide" | "ban" | "warn";
  affectedCount: number;
  autoBanned?: boolean;
  providerAction: false;
  providerMessageSent?: boolean;
  warningCount?: number;
  warningThreshold?: number;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

export type StreamerChatActionAccess = {
  canBan: boolean;
  canHide: boolean;
  canWarn: boolean;
};

export type StreamerChatViewerProps = {
  actionAccess?: StreamerChatActionAccess;
  apiBaseUrl: string;
  maxMessages?: number;
  newestOnTop: boolean;
  variant?: "embedded" | "standalone";
};
