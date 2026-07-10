import type { StreamerChatMessage } from "@maiks-yt/events";

export type StreamerChatModerationRule = {
  activeUntil?: string | null;
  appliedAt: string;
  authorName: string;
  count?: number;
  id: string;
  kind: "message_allowed" | "author_allowed" | "message_hidden" | "author_banned" | "author_warned";
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

export type StreamerChatModerationAuditEntry = {
  action: "warn_author" | "allow_message" | "allow_author" | "hide_message" | "ban_author" | "unban_author" | "delete_message" | "temporary_mute_author";
  actorDisplayName: string | null;
  at: string;
  id: string;
  messageId: string | null;
  note: string | null;
  outcome: "applied" | "denied" | "invalid" | "not_found" | "no_op" | "provider_queued" | "provider_failed" | "reverted";
  providerAction: boolean;
  reason: string | null;
  source: StreamerChatMessage["source"];
  targetAuthorName: string | null;
  targetExternalId: string | null;
};

export type StreamerChatModerationAuditResponse = {
  ok: true;
  audit: StreamerChatModerationAuditEntry[];
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
    canProviderModerate: boolean;
    canAllow: boolean;
    canViewAudit: boolean;
    canRetractRules: boolean;
    canViewRules: boolean;
    canWarn: boolean;
  };
  panels: {
    appliedRules: boolean;
    auditHistory: boolean;
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

export type ModerationPanelKey = "chat" | "rules" | "audit" | "approvals" | "helper";

export type ModerationControlWindowProps = {
  apiBaseUrl: string;
};

export const moderationRuleKindLabels: Record<StreamerChatModerationRule["kind"], string> = {
  author_allowed: "Allow author",
  author_banned: "Ban",
  author_warned: "Warning",
  message_allowed: "Allow message",
  message_hidden: "Hide"
};

export const moderationAuditActionLabels: Record<StreamerChatModerationAuditEntry["action"], string> = {
  allow_author: "Allow author",
  allow_message: "Allow message",
  ban_author: "Ban",
  delete_message: "Delete message",
  hide_message: "Hide",
  temporary_mute_author: "Timeout",
  unban_author: "Retract ban",
  warn_author: "Warning"
};

export const moderationPanelLabels: Record<ModerationPanelKey, string> = {
  approvals: "Pending Approvals",
  audit: "Audit History",
  chat: "Chat",
  helper: "Live Helper Summary",
  rules: "Applied Rules"
};
