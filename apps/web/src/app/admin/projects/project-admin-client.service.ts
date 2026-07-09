import type { ProjectCategory, ProjectItemKind, ProjectItemLinkRelationship, ProjectItemStatus, ProjectReadModelSource, ProjectReadUpdateSource, ProjectStatus, ProjectUpdateStatus, ProjectType, MilestoneStatus } from "@maiks-yt/domain/projects";
import { buildProjectAdminPublicPreview } from "@maiks-yt/domain/projects";

export type AdminProjectsResponse =
  | {
    ok: true;
    projects: readonly ProjectReadModelSource[];
  }
  | {
    ok: false;
    reason: string;
  };

export type AdminMutationResponse =
  | {
    ok: true;
    project: ProjectReadModelSource;
  }
  | {
    ok: false;
    reason: string;
  };

export type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

export type ProjectFormState = {
  slug: string;
  title: string;
  summary: string;
  type: ProjectType;
  category: ProjectCategory;
  status: ProjectStatus;
  isPublic: boolean;
};

export type MilestoneFormState = {
  title: string;
  description: string;
  status: MilestoneStatus;
  sortOrder: number;
};

export type ItemFormState = {
  parentItemId: string;
  title: string;
  description: string;
  kind: ProjectItemKind;
  status: ProjectItemStatus;
  quantity: number;
  estimatedAmountMajor: string;
  currencyCode: string;
  sortOrder: number;
};

export type ItemLinkFormState = {
  itemId: string;
  provider: string;
  url: string;
  label: string;
  relationship: ProjectItemLinkRelationship;
};

export type UpdateFormState = {
  title: string;
  summary: string;
  body: string;
  status: ProjectUpdateStatus;
  isVisible: boolean;
  publishedAt: string;
  isPinned: boolean;
  sortOrder: number;
};

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

export const projectTypes = [
  "one-time-purchase",
  "multi-item-build",
  "ongoing-cost",
  "subscription",
  "stream-work-project",
  "milestone-only"
] satisfies ProjectType[];

export const projectCategories = [
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
] satisfies ProjectCategory[];

export const projectStatuses = ["planning", "active", "completed", "mothballed", "cancelled"] satisfies ProjectStatus[];
export const milestoneStatuses = ["planned", "active", "completed", "cancelled"] satisfies MilestoneStatus[];
export const itemKinds = ["product", "service", "subscription", "task", "wishlist", "other"] satisfies ProjectItemKind[];
export const itemStatuses = ["planned", "active", "acquired", "completed", "removed"] satisfies ProjectItemStatus[];
export const itemLinkRelationships = ["wishlist-entry", "store-product", "reference", "receipt"] satisfies ProjectItemLinkRelationship[];
export const updateStatuses = ["draft", "published"] satisfies ProjectUpdateStatus[];

export const defaultProjectForm: ProjectFormState = {
  slug: "",
  title: "",
  summary: "",
  type: "milestone-only",
  category: "software-project",
  status: "planning",
  isPublic: false
};

export const defaultMilestoneForm: MilestoneFormState = {
  title: "",
  description: "",
  status: "planned",
  sortOrder: 1
};

export const defaultItemForm: ItemFormState = {
  parentItemId: "",
  title: "",
  description: "",
  kind: "task",
  status: "planned",
  quantity: 1,
  estimatedAmountMajor: "",
  currencyCode: "EUR",
  sortOrder: 1
};

export const defaultItemLinkForm: ItemLinkFormState = {
  itemId: "",
  provider: "manual",
  url: "",
  label: "",
  relationship: "wishlist-entry"
};

export const defaultUpdateForm: UpdateFormState = {
  title: "",
  summary: "",
  body: "",
  status: "draft",
  isVisible: true,
  publishedAt: "",
  isPinned: false,
  sortOrder: 1
};

export const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing projects.";
  }

  if (response.status === 403 || reason === "project_admin_forbidden") {
    return "Your account does not have project admin permission.";
  }

  if (reason === "project_slug_conflict") {
    return "That project slug is already in use.";
  }

  if (reason === "project_admin_invalid_input") {
    return "The project admin request has invalid or missing fields.";
  }

  if (reason?.includes("not_found")) {
    return "That project record could not be found.";
  }

  return `Project admin request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "project_admin_forbidden" || reason === "project_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

export const toProjectForm = (project: ProjectReadModelSource): ProjectFormState => ({
  slug: project.slug,
  title: project.title,
  summary: project.summary ?? "",
  type: project.type,
  category: project.category,
  status: project.status,
  isPublic: project.isPublic
});

export const toUpdateForm = (update: ProjectReadUpdateSource): UpdateFormState => ({
  title: update.title,
  summary: update.summary ?? "",
  body: update.body,
  status: update.status,
  isVisible: update.isVisible,
  publishedAt: update.publishedAt ?? "",
  isPinned: update.isPinned,
  sortOrder: update.sortOrder
});

export const toAdminUpdatePayload = (updateForm: UpdateFormState): Record<string, unknown> => ({
  title: updateForm.title,
  summary: updateForm.summary.trim() || null,
  body: updateForm.body,
  status: updateForm.status,
  isVisible: updateForm.isVisible,
  ...(updateForm.publishedAt.trim() ? { publishedAt: updateForm.publishedAt.trim() } : {}),
  isPinned: updateForm.isPinned,
  sortOrder: updateForm.sortOrder
});

export const parseProjectEstimateMinor = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");

  if (normalized.length === 0) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN;
  }

  return Math.round(Number.parseFloat(normalized) * 100);
};

export const formatProjectEstimate = (
  estimatedMinorAmount: number | null | undefined,
  currencyCode: string | null | undefined
): string | null => {
  if (estimatedMinorAmount === undefined || estimatedMinorAmount === null || !currencyCode) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode
  }).format(estimatedMinorAmount / 100);
};

export const getProjectPublicHref = (project: ProjectReadModelSource): string =>
  `/projects/${encodeURIComponent(project.slug)}`;

export const isPublicRouteVisible = (project: ProjectReadModelSource): boolean =>
  buildProjectAdminPublicPreview(project).ok && project.isPublic;

export const flattenItemOptions = (
  project: ProjectReadModelSource
): Array<{ id: string; label: string }> =>
  project.items
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
    .map((item) => ({
      id: item.id,
      label: item.parentItemId ? `${item.title} (${item.parentItemId})` : item.title
    }));
