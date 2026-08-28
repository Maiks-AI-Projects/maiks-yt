import type {
  PublicProjectItem,
  PublicProjectItemLink,
  PublicProjectMilestone,
  PublicProjectSummary,
  PublicProjectUpdate
} from "@maiks-yt/domain/projects";

const normalizeKeyPart = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const joinKeyParts = (parts: readonly string[]): string =>
  parts.map(normalizeKeyPart).join(" | ");

export const getPublicProjectSummaryKey = (project: Pick<PublicProjectSummary, "slug">): string =>
  joinKeyParts(["project", project.slug]);

export const getPublicProjectMilestoneKey = (
  projectSlug: string,
  milestone: PublicProjectMilestone,
  index: number
): string =>
  joinKeyParts([
    "project",
    projectSlug,
    "milestone",
    String(index),
    milestone.status,
    milestone.title
  ]);

export const getPublicProjectItemKey = (
  item: PublicProjectItem,
  path: readonly number[]
): string =>
  joinKeyParts([
    "project-item",
    path.join("."),
    item.kind,
    item.status,
    item.title,
    String(item.quantity)
  ]);

export const getPublicProjectItemLinkKey = (
  link: PublicProjectItemLink,
  itemKey: string,
  index: number
): string =>
  joinKeyParts([
    itemKey,
    "link",
    String(index),
    link.relationship,
    link.label,
    link.url
  ]);

export const getPublicProjectUpdateKey = (
  projectSlug: string,
  update: PublicProjectUpdate,
  index: number
): string =>
  joinKeyParts([
    "project",
    projectSlug,
    "update",
    String(index),
    update.isPinned ? "pinned" : "regular",
    update.publishedAt ?? "undated",
    update.title
  ]);
