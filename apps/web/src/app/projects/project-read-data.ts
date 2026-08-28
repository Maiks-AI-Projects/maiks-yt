import type {
  PublicProjectDetail,
  PublicProjectItem,
  PublicProjectItemLink,
  PublicProjectMilestone,
  PublicProjectStatus,
  PublicProjectUpdate,
  PublicProjectSummary
} from "@maiks-yt/domain/projects";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

type ProjectListApiResponse =
  | {
    ok: true;
    projects: readonly PublicProjectSummary[];
  }
  | {
    ok: false;
    reason: ProjectListFailureReason;
  };

type ProjectDetailApiResponse =
  | {
    ok: true;
    project: PublicProjectDetail;
  }
  | {
    ok: false;
    reason: ProjectDetailFailureReason;
  };

type ProjectListFailureReason = "projects_unavailable";
type ProjectDetailFailureReason = "invalid_project_slug" | "project_not_found" | "projects_unavailable";

export type ProjectListLoadResult =
  | {
    status: "loaded";
    projects: readonly PublicProjectSummary[];
  }
  | {
    status: "error";
  };

export type ProjectDetailLoadResult =
  | {
    status: "loaded";
    project: PublicProjectDetail;
  }
  | {
    status: "not-found";
  }
  | {
    status: "error";
  };

export const formatProjectLabel = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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
const projectStatuses = new Set<PublicProjectStatus>(["planning", "active", "completed"]);
const milestoneStatuses = new Set<PublicProjectMilestone["status"]>(["planned", "active", "completed"]);
const itemKinds = new Set<PublicProjectItem["kind"]>([
  "product",
  "service",
  "subscription",
  "task",
  "wishlist",
  "other"
]);
const itemStatuses = new Set<PublicProjectItem["status"]>(["planned", "active", "acquired", "completed"]);
const itemLinkRelationships = new Set<PublicProjectItemLink["relationship"]>([
  "store-product",
  "wishlist-entry",
  "reference",
  "receipt"
]);
const projectListFailureReasons = new Set<ProjectListFailureReason>(["projects_unavailable"]);
const projectDetailFailureReasons = new Set<ProjectDetailFailureReason>([
  "invalid_project_slug",
  "project_not_found",
  "projects_unavailable"
]);

const summaryKeys = [
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
const detailKeys = [...summaryKeys, "milestones", "items", "updates"] as const;
const milestoneKeys = ["title", "status", "description"] as const;
const itemKeys = [
  "title",
  "kind",
  "status",
  "quantity",
  "estimatedMinorAmount",
  "currencyCode",
  "description",
  "links",
  "children"
] as const;
const itemLinkKeys = [
  "provider",
  "url",
  "label",
  "relationship",
  "lastSeenMinorAmount",
  "currencyCode"
] as const;
const updateKeys = ["title", "body", "isPinned", "summary", "publishedAt"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const hasRequiredKeys = (value: Record<string, unknown>, requiredKeys: readonly string[]): boolean =>
  requiredKeys.every((key) => Object.hasOwn(value, key));

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isOptionalDateString = (value: unknown): value is string | undefined =>
  value === undefined || (typeof value === "string" && Number.isFinite(new Date(value).getTime()));

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isNormalizedSlug = (value: unknown): value is string =>
  typeof value === "string" && projectSlugPattern.test(value);

const isProjectType = (value: unknown): value is PublicProjectSummary["type"] =>
  typeof value === "string" && projectTypes.has(value as PublicProjectSummary["type"]);

const isProjectCategory = (value: unknown): value is PublicProjectSummary["category"] =>
  typeof value === "string" && projectCategories.has(value as PublicProjectSummary["category"]);

const isProjectStatus = (value: unknown): value is PublicProjectStatus =>
  typeof value === "string" && projectStatuses.has(value as PublicProjectStatus);

const isMilestoneStatus = (value: unknown): value is PublicProjectMilestone["status"] =>
  typeof value === "string" && milestoneStatuses.has(value as PublicProjectMilestone["status"]);

const isItemKind = (value: unknown): value is PublicProjectItem["kind"] =>
  typeof value === "string" && itemKinds.has(value as PublicProjectItem["kind"]);

const isItemStatus = (value: unknown): value is PublicProjectItem["status"] =>
  typeof value === "string" && itemStatuses.has(value as PublicProjectItem["status"]);

const isItemLinkRelationship = (value: unknown): value is PublicProjectItemLink["relationship"] =>
  typeof value === "string" && itemLinkRelationships.has(value as PublicProjectItemLink["relationship"]);

const isProjectListFailureReason = (value: unknown): value is ProjectListFailureReason =>
  typeof value === "string" && projectListFailureReasons.has(value as ProjectListFailureReason);

const isProjectDetailFailureReason = (value: unknown): value is ProjectDetailFailureReason =>
  typeof value === "string" && projectDetailFailureReasons.has(value as ProjectDetailFailureReason);

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const parsePublicProjectMilestone = (value: unknown): PublicProjectMilestone | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, milestoneKeys)
    || !hasRequiredKeys(value, ["title", "status"])
    || !isNonEmptyString(value.title)
    || !isMilestoneStatus(value.status)
    || !isOptionalString(value.description)) {
    return null;
  }

  return {
    title: value.title,
    status: value.status,
    ...(value.description !== undefined ? { description: value.description } : {})
  };
};

const parsePublicProjectItemLink = (value: unknown): PublicProjectItemLink | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, itemLinkKeys)
    || !hasRequiredKeys(value, ["provider", "url", "label", "relationship"])
    || !isNonEmptyString(value.provider)
    || !isHttpUrl(value.url)
    || !isNonEmptyString(value.label)
    || !isItemLinkRelationship(value.relationship)) {
    return null;
  }

  const hasAmount = value.lastSeenMinorAmount !== undefined;
  const hasCurrency = value.currencyCode !== undefined;

  if (hasAmount !== hasCurrency
    || (hasAmount && (!isNonnegativeInteger(value.lastSeenMinorAmount) || !isNonEmptyString(value.currencyCode)))) {
    return null;
  }

  return {
    provider: value.provider,
    url: value.url,
    label: value.label,
    relationship: value.relationship,
    ...(hasAmount
      ? {
        lastSeenMinorAmount: value.lastSeenMinorAmount as number,
        currencyCode: value.currencyCode as string
      }
      : {})
  };
};

const parsePublicProjectItem = (value: unknown): PublicProjectItem | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, itemKeys)
    || !hasRequiredKeys(value, ["title", "kind", "status", "quantity", "links", "children"])
    || !isNonEmptyString(value.title)
    || !isItemKind(value.kind)
    || !isItemStatus(value.status)
    || !isNonnegativeInteger(value.quantity)
    || !isOptionalString(value.description)
    || !Array.isArray(value.links)
    || !Array.isArray(value.children)) {
    return null;
  }

  const hasAmount = value.estimatedMinorAmount !== undefined;
  const hasCurrency = value.currencyCode !== undefined;

  if (hasAmount !== hasCurrency
    || (hasAmount && (!isNonnegativeInteger(value.estimatedMinorAmount) || !isNonEmptyString(value.currencyCode)))) {
    return null;
  }

  const links = value.links.map(parsePublicProjectItemLink);
  const children = value.children.map(parsePublicProjectItem);

  if (links.some((link) => link === null) || children.some((child) => child === null)) {
    return null;
  }

  return {
    title: value.title,
    kind: value.kind,
    status: value.status,
    quantity: value.quantity,
    ...(hasAmount
      ? {
        estimatedMinorAmount: value.estimatedMinorAmount as number,
        currencyCode: value.currencyCode as string
      }
      : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    links: links as PublicProjectItemLink[],
    children: children as PublicProjectItem[]
  };
};

const parsePublicProjectUpdate = (value: unknown): PublicProjectUpdate | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, updateKeys)
    || !hasRequiredKeys(value, ["title", "body", "isPinned"])
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.body)
    || typeof value.isPinned !== "boolean"
    || !isOptionalString(value.summary)
    || !isOptionalDateString(value.publishedAt)) {
    return null;
  }

  return {
    title: value.title,
    body: value.body,
    isPinned: value.isPinned,
    ...(value.summary !== undefined ? { summary: value.summary } : {}),
    ...(value.publishedAt !== undefined ? { publishedAt: value.publishedAt } : {})
  };
};

const parsePublicProjectSummary = (
  value: unknown,
  allowedKeys: readonly string[] = summaryKeys
): PublicProjectSummary | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, allowedKeys)
    || !hasRequiredKeys(value, [
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
    || !isNormalizedSlug(value.slug)
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.summary)
    || !isProjectType(value.type)
    || !isProjectCategory(value.category)
    || !isProjectStatus(value.status)
    || !isNonnegativeInteger(value.milestoneCount)
    || !isNonnegativeInteger(value.itemCount)
    || !isNonnegativeInteger(value.updateCount)
    || !isOptionalDateString(value.updatedAt)) {
    return null;
  }

  const nextMilestone = value.nextMilestone === undefined
    ? undefined
    : parsePublicProjectMilestone(value.nextMilestone);

  if (value.nextMilestone !== undefined && !nextMilestone) {
    return null;
  }

  return {
    slug: value.slug,
    title: value.title,
    summary: value.summary,
    type: value.type,
    category: value.category,
    status: value.status,
    milestoneCount: value.milestoneCount,
    itemCount: value.itemCount,
    updateCount: value.updateCount,
    ...(nextMilestone ? { nextMilestone } : {}),
    ...(value.updatedAt !== undefined ? { updatedAt: value.updatedAt } : {})
  };
};

const parsePublicProjectDetail = (value: unknown): PublicProjectDetail | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, detailKeys)
    || !Array.isArray(value.milestones)
    || !Array.isArray(value.items)
    || !Array.isArray(value.updates)) {
    return null;
  }

  const summary = parsePublicProjectSummary(value, detailKeys);
  const milestones = value.milestones.map(parsePublicProjectMilestone);
  const items = value.items.map(parsePublicProjectItem);
  const updates = value.updates.map(parsePublicProjectUpdate);

  if (!summary
    || milestones.some((milestone) => milestone === null)
    || items.some((item) => item === null)
    || updates.some((update) => update === null)) {
    return null;
  }

  return {
    ...summary,
    milestones: milestones as PublicProjectMilestone[],
    items: items as PublicProjectItem[],
    updates: updates as PublicProjectUpdate[]
  };
};

export const parseProjectListApiResponse = (value: unknown): ProjectListApiResponse | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["ok", "projects", "reason"])) {
    return null;
  }

  if (value.ok === false) {
    return hasOnlyKeys(value, ["ok", "reason"]) && isProjectListFailureReason(value.reason)
      ? { ok: false, reason: value.reason }
      : null;
  }

  if (value.ok !== true
    || !hasOnlyKeys(value, ["ok", "projects"])
    || !Array.isArray(value.projects)) {
    return null;
  }

  const projects = value.projects.map((project) => parsePublicProjectSummary(project));

  return projects.some((project) => project === null)
    ? null
    : {
      ok: true,
      projects: projects as PublicProjectSummary[]
    };
};

export const parseProjectDetailApiResponse = (value: unknown): ProjectDetailApiResponse | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["ok", "project", "reason"])) {
    return null;
  }

  if (value.ok === false) {
    return hasOnlyKeys(value, ["ok", "reason"]) && isProjectDetailFailureReason(value.reason)
      ? { ok: false, reason: value.reason }
      : null;
  }

  if (value.ok !== true || !hasOnlyKeys(value, ["ok", "project"])) {
    return null;
  }

  const project = parsePublicProjectDetail(value.project);

  return project
    ? {
      ok: true,
      project
    }
    : null;
};

export const getPublicProjects = async (): Promise<ProjectListLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/projects`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        status: "error"
      };
    }

    const payload = parseProjectListApiResponse(await response.json());

    if (!payload?.ok) {
      return {
        status: "error"
      };
    }

    return {
      status: "loaded",
      projects: payload.projects
    };
  } catch {
    return {
      status: "error"
    };
  }
};

export const getPublicProject = async (slug: string): Promise<ProjectDetailLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/projects/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });

    if (response.status === 404) {
      return {
        status: "not-found"
      };
    }

    if (!response.ok) {
      return {
        status: "error"
      };
    }

    const payload = parseProjectDetailApiResponse(await response.json());

    if (!payload) {
      return { status: "error" };
    }

    if (!payload.ok) {
      return payload.reason === "project_not_found"
        ? { status: "not-found" }
        : { status: "error" };
    }

    return {
      status: "loaded",
      project: payload.project
    };
  } catch {
    return {
      status: "error"
    };
  }
};
