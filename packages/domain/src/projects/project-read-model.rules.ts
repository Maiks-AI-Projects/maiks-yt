import type {
  ProjectReadItemSource,
  ProjectReadMilestoneSource,
  ProjectReadModelSource,
  PublicProjectDetail,
  PublicProjectItem,
  PublicProjectMilestone,
  PublicProjectStatus,
  PublicProjectSummary
} from "./project-read-model.types.js";
import type { ProjectStatus } from "./project.types.js";

const publicProjectStatuses = new Set<ProjectStatus>(["planning", "active", "completed"]);
const projectStatusRank: Record<PublicProjectStatus, number> = {
  active: 0,
  planning: 1,
  completed: 2
};

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, "en", { sensitivity: "base" });

const compareProjectSources = (
  left: ProjectReadModelSource,
  right: ProjectReadModelSource
): number => {
  const leftStatus = left.status as PublicProjectStatus;
  const rightStatus = right.status as PublicProjectStatus;

  return projectStatusRank[leftStatus] - projectStatusRank[rightStatus]
    || compareText(left.category, right.category)
    || compareText(left.title, right.title)
    || compareText(left.slug, right.slug);
};

const compareMilestones = (
  left: ProjectReadMilestoneSource,
  right: ProjectReadMilestoneSource
): number => left.sortOrder - right.sortOrder || compareText(left.title, right.title);

const compareItems = (
  left: ProjectReadItemSource,
  right: ProjectReadItemSource
): number => left.sortOrder - right.sortOrder || compareText(left.title, right.title);

export const isPublicProjectSource = (project: ProjectReadModelSource): boolean =>
  project.isPublic && publicProjectStatuses.has(project.status);

const toPublicProjectMilestone = (
  milestone: ProjectReadMilestoneSource
): PublicProjectMilestone | null => {
  if (milestone.status === "cancelled") {
    return null;
  }

  return {
    id: milestone.id,
    title: milestone.title,
    status: milestone.status,
    ...(milestone.description ? { description: milestone.description } : {})
  };
};

const createPublicProjectItem = (
  item: ProjectReadItemSource,
  children: readonly PublicProjectItem[]
): PublicProjectItem | null => {
  if (item.status === "removed") {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    status: item.status,
    quantity: item.quantity,
    ...(item.description ? { description: item.description } : {}),
    children
  };
};

const buildProjectItemTree = (
  items: readonly ProjectReadItemSource[],
  parentItemId: string | null
): readonly PublicProjectItem[] =>
  items
    .filter((item) => (item.parentItemId ?? null) === parentItemId)
    .sort(compareItems)
    .map((item) => createPublicProjectItem(item, buildProjectItemTree(items, item.id)))
    .filter((item): item is PublicProjectItem => item !== null);

const flattenItemCount = (items: readonly PublicProjectItem[]): number =>
  items.reduce((count, item) => count + 1 + flattenItemCount(item.children), 0);

export const buildPublicProjectDetail = (
  project: ProjectReadModelSource
): PublicProjectDetail | null => {
  if (!isPublicProjectSource(project)) {
    return null;
  }

  const milestones = project.milestones
    .slice()
    .sort(compareMilestones)
    .map(toPublicProjectMilestone)
    .filter((milestone): milestone is PublicProjectMilestone => milestone !== null);
  const items = buildProjectItemTree(project.items, null);
  const nextMilestone = milestones.find((milestone) => milestone.status === "active")
    ?? milestones.find((milestone) => milestone.status === "planned");

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary?.trim() || "No project summary is available yet.",
    type: project.type,
    category: project.category,
    status: project.status as PublicProjectStatus,
    milestoneCount: milestones.length,
    itemCount: flattenItemCount(items),
    ...(nextMilestone ? { nextMilestone } : {}),
    ...(project.updatedAt ? { updatedAt: project.updatedAt } : {}),
    milestones,
    items
  };
};

export const buildPublicProjectSummary = (
  project: ProjectReadModelSource
): PublicProjectSummary | null => {
  const detail = buildPublicProjectDetail(project);

  if (!detail) {
    return null;
  }

  const { milestones: _milestones, items: _items, ...summary } = detail;

  return summary;
};

export const buildPublicProjectSummaryList = (
  projects: readonly ProjectReadModelSource[]
): readonly PublicProjectSummary[] =>
  projects
    .filter(isPublicProjectSource)
    .slice()
    .sort(compareProjectSources)
    .map(buildPublicProjectSummary)
    .filter((project): project is PublicProjectSummary => project !== null);
