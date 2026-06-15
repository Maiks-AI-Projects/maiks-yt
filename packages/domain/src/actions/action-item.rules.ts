import {
  actionItemCategories,
  actionItemDecisionNoteMaxLength,
  actionPanelDecideCapability,
  actionPanelViewCapability,
  type ActionItem,
  type ActionItemCategory,
  type ActionItemDecision,
  type ActionItemDecisionForKind,
  type ActionItemDecisionInput,
  type ActionItemDecisionKind,
  type ActionItemDecisionTransition,
  type ActionItemPriority,
  type ActionItemStatus,
  type ActionPanelCapability,
  type ActionPanelCategoryDecisionCapability,
  type ActionPanelContext
} from "./action-item.types.js";

const priorityWeight = {
  urgent: 400,
  high: 300,
  normal: 200,
  low: 100
} satisfies Record<ActionItemPriority, number>;

const liveCategoryWeight = {
  moderation: 70,
  overlay: 60,
  sponsor: 50,
  ai: 40,
  schedule: 30,
  stream: 30,
  project: 20,
  donation: 10,
  system: 0
} satisfies Partial<Record<ActionItemCategory, number>>;

const offStreamCategoryWeight = {
  donation: 70,
  project: 60,
  stream: 55,
  schedule: 50,
  sponsor: 40,
  moderation: 30,
  ai: 20,
  overlay: 10,
  system: 0
} satisfies Partial<Record<ActionItemCategory, number>>;

const openStatuses = new Set<ActionItem["status"]>(["open", "deferred"]);
const actionItemCategorySet = new Set<string>(actionItemCategories);
const actionItemDecisions = new Set<string>(["approve", "reject", "defer"] satisfies ActionItemDecision[]);
const terminalStatuses = new Set<ActionItemStatus>(["approved", "rejected", "completed"]);
const categoryDecisionCapabilityPrefix = "action-panel:decide:" as const;
const allowedActionItemDecisions: {
  [DecisionKind in ActionItemDecisionKind]: readonly ActionItemDecisionForKind<DecisionKind>[];
} = {
  approve: ["approve", "defer"],
  "approve-or-reject": ["approve", "reject", "defer"],
  review: ["approve", "reject", "defer"],
  defer: ["defer"],
  acknowledge: []
};

const isActionItemCategory = (value: string): value is ActionItemCategory => actionItemCategorySet.has(value);

const isActionItemDecision = (value: unknown): value is ActionItemDecision =>
  typeof value === "string" && actionItemDecisions.has(value);

export const getActionPanelCategoryDecisionCapability = (
  category: ActionItemCategory
): ActionPanelCategoryDecisionCapability => `${categoryDecisionCapabilityPrefix}${category}`;

export const isActionPanelCapability = (value: unknown): value is ActionPanelCapability => {
  if (value === "*" || value === actionPanelViewCapability || value === actionPanelDecideCapability) {
    return true;
  }

  if (typeof value !== "string" || !value.startsWith(categoryDecisionCapabilityPrefix)) {
    return false;
  }

  return isActionItemCategory(value.slice(categoryDecisionCapabilityPrefix.length));
};

export const canViewActionPanel = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability) => capability === "*" || capability === actionPanelViewCapability);

export const isActionItemTerminalStatus = (status: ActionItemStatus): boolean => terminalStatuses.has(status);

export const getAllowedActionItemDecisions = <DecisionKind extends ActionItemDecisionKind>(
  decisionKind: DecisionKind
): readonly ActionItemDecisionForKind<DecisionKind>[] => allowedActionItemDecisions[decisionKind];

export const isActionItemDecisionAllowed = <DecisionKind extends ActionItemDecisionKind>(
  decisionKind: DecisionKind,
  decision: ActionItemDecision
): decision is ActionItemDecisionForKind<DecisionKind> =>
  (allowedActionItemDecisions[decisionKind] as readonly ActionItemDecision[]).includes(decision);

export const canDecideActionItem = (
  item: Pick<ActionItem, "category" | "decisionKind" | "status">,
  capabilities: readonly unknown[]
): boolean => {
  if (isActionItemTerminalStatus(item.status)) {
    return false;
  }

  const hasAvailableDecision = getAllowedActionItemDecisions(item.decisionKind)
    .some((decision) => getActionItemDecisionTransition(item, decision) !== undefined);

  if (!hasAvailableDecision) {
    return false;
  }

  const categoryCapability = getActionPanelCategoryDecisionCapability(item.category);

  return capabilities.some((capability) =>
    capability === "*" || capability === actionPanelDecideCapability || capability === categoryCapability
  );
};

export const isValidActionItemDecisionNote = (note: unknown): note is string =>
  typeof note === "string" && note.length <= actionItemDecisionNoteMaxLength;

export const isValidActionItemDecisionInput = (value: unknown): value is ActionItemDecisionInput => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const input = value as { decision?: unknown; note?: unknown };
  const hasNote = Object.prototype.hasOwnProperty.call(input, "note");

  return isActionItemDecision(input.decision) && (!hasNote || isValidActionItemDecisionNote(input.note));
};

export const getActionItemDecisionTransition = <DecisionKind extends ActionItemDecisionKind>(
  item: Pick<ActionItem, "decisionKind" | "status"> & { decisionKind: DecisionKind },
  decision: ActionItemDecisionForKind<DecisionKind>
): ActionItemDecisionTransition | undefined => {
  if (!isActionItemDecisionAllowed(item.decisionKind, decision)) {
    return undefined;
  }

  const resolvedDecision: ActionItemDecision = decision;
  const previousStatus = item.status;

  if (resolvedDecision === "defer") {
    return previousStatus === "open"
      ? { decision: resolvedDecision, previousStatus, newStatus: "deferred" }
      : undefined;
  }

  if (previousStatus !== "open" && previousStatus !== "deferred") {
    return undefined;
  }

  return resolvedDecision === "approve"
    ? { decision: resolvedDecision, previousStatus, newStatus: "approved" }
    : { decision: resolvedDecision, previousStatus, newStatus: "rejected" };
};

const getTimeValue = (value: string | undefined): number => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const time = Date.parse(value);

  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

export const isActionItemVisibleInContext = (item: ActionItem, context: ActionPanelContext): boolean => {
  if (!openStatuses.has(item.status)) {
    return false;
  }

  if (!context.live) {
    return true;
  }

  return item.liveSafe && (item.streamRelevant || item.priority === "urgent");
};

export const getActionItemSortScore = (item: ActionItem, context: ActionPanelContext): number => {
  let score = priorityWeight[item.priority];
  const categoryWeight = context.live ? liveCategoryWeight : offStreamCategoryWeight;

  score += categoryWeight[item.category] ?? 0;

  if (context.live && item.streamRelevant) {
    score += 75;
  }

  if (context.live && !item.liveSafe) {
    score -= 500;
  }

  const dueAt = getTimeValue(item.dueAt);
  const now = Date.parse(context.now);

  if (!Number.isNaN(now) && dueAt <= now) {
    score += 90;
  }

  return score;
};

export const sortActionItemsForContext = (
  items: readonly ActionItem[],
  context: ActionPanelContext
): ActionItem[] =>
  [...items]
    .filter((item) => isActionItemVisibleInContext(item, context))
    .sort((first, second) => {
      const scoreDifference = getActionItemSortScore(second, context) - getActionItemSortScore(first, context);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const firstDue = getTimeValue(first.dueAt);
      const secondDue = getTimeValue(second.dueAt);

      if (firstDue !== secondDue) {
        return firstDue - secondDue;
      }

      return getTimeValue(first.createdAt) - getTimeValue(second.createdAt);
    });
