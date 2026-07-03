import type { StreamerChatMessage } from "@maiks-yt/events";

export type StreamerChatModerationRule = {
  appliedAt: string;
  authorName: string;
  count?: number;
  id: string;
  kind: "message_hidden" | "author_banned" | "author_warned";
  messageId: string | null;
  source: StreamerChatMessage["source"];
};

export type StreamerChatModerationRulesResponse = {
  ok: true;
  rules: StreamerChatModerationRule[];
  providerAction: false;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

export type StreamerChatModerationRuleRetractResponse = {
  ok: true;
  retractedRule: StreamerChatModerationRule | null;
  providerAction: false;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

export type StreamerChatModerationAccess = {
  actions: {
    canBan: boolean;
    canEmergencyClear: boolean;
    canHide: boolean;
    canRetractRules: boolean;
    canViewRules: boolean;
    canWarn: boolean;
  };
  panels: {
    appliedRules: boolean;
    chat: boolean;
    liveHelper: boolean;
    pendingApprovals: boolean;
  };
};

export type StreamerChatModerationAccessResponse = {
  ok: true;
  actions: StreamerChatModerationAccess["actions"];
  panels: StreamerChatModerationAccess["panels"];
  providerAction: false;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

export type ModerationPanelKey = "chat" | "rules" | "approvals" | "helper";

export type ModerationControlWindowProps = {
  apiBaseUrl: string;
};

export const moderationRuleKindLabels: Record<StreamerChatModerationRule["kind"], string> = {
  author_banned: "Ban",
  author_warned: "Warning",
  message_hidden: "Hide"
};

export const moderationPanelLabels: Record<ModerationPanelKey, string> = {
  approvals: "Pending Approvals",
  chat: "Chat",
  helper: "Live Helper Summary",
  rules: "Applied Rules"
};

