import type { PublicProjectSummary } from "@maiks-yt/domain/projects";

import type { ProjectListLoadResult } from "../projects/project-read-data";

export type HomeProjectSlot =
  | {
    status: "available";
    title: string;
    summary: string;
    slug: string;
    nextMilestoneTitle?: string;
  }
  | {
    status: "empty" | "unavailable";
  };

type HomeProjectBase = Pick<PublicProjectSummary, "slug" | "title" | "summary"> & {
  nextMilestone?: {
    title: string;
  };
};

type HomeProjectCandidate = HomeProjectBase & {
  status: "active" | "planning";
};

type HomeProjectListItem = HomeProjectCandidate | (HomeProjectBase & {
  status: "completed";
});

const projectSummaryMaxLength = 280;
const projectSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;
const projectTypes = new Set<PublicProjectSummary["type"]>([
  "one-time-purchase",
  "multi-item-build",
  "ongoing-cost",
  "subscription",
  "stream-work-project",
  "milestone-only"
]);
const projectCategories = new Set<PublicProjectSummary["category"]>([
  "personal",
  "family",
  "content-improvement",
  "stream-infrastructure",
  "software-project",
  "hobby",
  "community",
  "health-accessibility",
  "experiment",
  "ongoing-cost"
]);
const publicProjectStatuses = new Set<PublicProjectSummary["status"]>([
  "active",
  "planning",
  "completed"
]);
const publicMilestoneStatuses = new Set<NonNullable<PublicProjectSummary["nextMilestone"]>["status"]>([
  "planned",
  "active",
  "completed"
]);
const projectSummaryKeys = [
  "slug",
  "title",
  "summary",
  "type",
  "category",
  "status",
  "milestoneCount",
  "itemCount",
  "updateCount",
  "nextMilestone",
  "updatedAt"
] as const;
const milestoneKeys = ["title", "status", "description"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const hasRequiredKeys = (value: Record<string, unknown>, requiredKeys: readonly string[]): boolean =>
  requiredKeys.every((key) => Object.hasOwn(value, key));

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNormalizedProjectSlug = (value: unknown): value is string =>
  typeof value === "string" && projectSlugPattern.test(value);

const isValidOptionalDateString = (value: unknown): boolean =>
  value === undefined || (typeof value === "string" && !Number.isNaN(Date.parse(value)));

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isProjectType = (value: unknown): value is PublicProjectSummary["type"] =>
  typeof value === "string" && projectTypes.has(value as PublicProjectSummary["type"]);

const isProjectCategory = (value: unknown): value is PublicProjectSummary["category"] =>
  typeof value === "string" && projectCategories.has(value as PublicProjectSummary["category"]);

const isPublicProjectStatus = (value: unknown): value is PublicProjectSummary["status"] =>
  typeof value === "string" && publicProjectStatuses.has(value as PublicProjectSummary["status"]);

const isPublicMilestoneStatus = (
  value: unknown
): value is NonNullable<PublicProjectSummary["nextMilestone"]>["status"] =>
  typeof value === "string"
  && publicMilestoneStatuses.has(value as NonNullable<PublicProjectSummary["nextMilestone"]>["status"]);

const hasValidOptionalMilestone = (value: unknown): boolean => {
  if (value === undefined) {
    return true;
  }

  return isRecord(value)
    && hasOnlyKeys(value, milestoneKeys)
    && hasRequiredKeys(value, ["title", "status"])
    && isNonEmptyString(value.title)
    && isPublicMilestoneStatus(value.status)
    && (value.description === undefined || typeof value.description === "string");
};

const isHomeProjectListItem = (project: unknown): project is HomeProjectListItem =>
  isRecord(project)
  && hasOnlyKeys(project, projectSummaryKeys)
  && hasRequiredKeys(project, [
    "slug",
    "title",
    "summary",
    "type",
    "category",
    "status",
    "milestoneCount",
    "itemCount",
    "updateCount"
  ])
  && isProjectType(project.type)
  && isProjectCategory(project.category)
  && isPublicProjectStatus(project.status)
  && isNonEmptyString(project.title)
  && isNonEmptyString(project.summary)
  && isNormalizedProjectSlug(project.slug)
  && isNonnegativeInteger(project.milestoneCount)
  && isNonnegativeInteger(project.itemCount)
  && isNonnegativeInteger(project.updateCount)
  && isValidOptionalDateString(project.updatedAt)
  && hasValidOptionalMilestone(project.nextMilestone);

const boundSummary = (summary: string): string =>
  summary.trim().slice(0, projectSummaryMaxLength).trimEnd();

export const getHomeProjectSlot = (
  result: ProjectListLoadResult
): HomeProjectSlot => {
  if (result.status === "error") {
    return { status: "unavailable" };
  }

  if (!Array.isArray(result.projects)) {
    return { status: "unavailable" };
  }

  let activeProject: HomeProjectCandidate | null = null;
  let planningProject: HomeProjectCandidate | null = null;

  for (const project of result.projects) {
    if (!isHomeProjectListItem(project)) {
      return { status: "unavailable" };
    }

    if (project.status === "active" && !activeProject) {
      activeProject = project;
    }

    if (project.status === "planning" && !planningProject) {
      planningProject = project;
    }
  }

  const project = activeProject ?? planningProject ?? null;

  if (!project) {
    return { status: "empty" };
  }

  const nextMilestoneTitle = project.nextMilestone?.title.trim();

  return {
    status: "available",
    title: project.title.trim(),
    summary: boundSummary(project.summary),
    slug: project.slug,
    ...(nextMilestoneTitle ? { nextMilestoneTitle } : {})
  };
};
