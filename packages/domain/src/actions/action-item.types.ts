export type ActionItemPriority = "low" | "normal" | "high" | "urgent";

export type ActionItemStatus = "open" | "approved" | "rejected" | "deferred" | "completed";

export type ActionItemCategory =
  | "ai"
  | "donation"
  | "moderation"
  | "overlay"
  | "project"
  | "schedule"
  | "stream"
  | "sponsor"
  | "system";

export type ActionItemDecisionKind =
  | "approve"
  | "approve-or-reject"
  | "review"
  | "defer"
  | "acknowledge";

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
