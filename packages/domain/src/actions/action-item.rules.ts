import type { ActionItem, ActionItemCategory, ActionItemPriority, ActionPanelContext } from "./action-item.types.js";

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
