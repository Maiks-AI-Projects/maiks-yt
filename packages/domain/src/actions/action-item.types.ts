export type ActionItemPriority = "low" | "normal" | "high" | "urgent";

export type ActionItemStatus = "open" | "approved" | "rejected" | "deferred" | "completed";

export const actionItemCategories = [
  "ai",
  "donation",
  "moderation",
  "overlay",
  "project",
  "schedule",
  "stream",
  "sponsor",
  "system"
] as const;

export type ActionItemCategory = (typeof actionItemCategories)[number];

export type ActionItemDecisionKind =
  | "approve"
  | "approve-or-reject"
  | "review"
  | "defer"
  | "acknowledge";

export const actionPanelViewCapability = "action-panel:view" as const;
export const actionPanelDecideCapability = "action-panel:decide" as const;

export type ActionPanelCategoryDecisionCapability = `action-panel:decide:${ActionItemCategory}`;

export type ActionPanelCapability =
  | "*"
  | typeof actionPanelViewCapability
  | typeof actionPanelDecideCapability
  | ActionPanelCategoryDecisionCapability;

export type ActionItemDecision = "approve" | "reject" | "defer";

export type ActionItemDecisionForKind<DecisionKind extends ActionItemDecisionKind> =
  DecisionKind extends "approve"
    ? "approve" | "defer"
    : DecisionKind extends "approve-or-reject" | "review"
      ? ActionItemDecision
      : DecisionKind extends "defer"
        ? "defer"
        : never;

export const actionItemDecisionNoteMaxLength = 1_000;

export type ActionItemDecisionInput = {
  decision: ActionItemDecision;
  note?: string;
};

export type ActionItemDecisionTransition =
  | {
    decision: "approve";
    previousStatus: "open" | "deferred";
    newStatus: "approved";
  }
  | {
    decision: "reject";
    previousStatus: "open" | "deferred";
    newStatus: "rejected";
  }
  | {
    decision: "defer";
    previousStatus: "open";
    newStatus: "deferred";
  };

export type ActionItemSource = {
  type: ActionItemCategory;
  id: string;
  label: string;
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  category: ActionItemCategory;
  decisionKind: ActionItemDecisionKind;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  streamRelevant: boolean;
  liveSafe: boolean;
  createdAt: string;
  dueAt?: string;
  source?: ActionItemSource;
};

export type ActionPanelContext = {
  live: boolean;
  now: string;
};
