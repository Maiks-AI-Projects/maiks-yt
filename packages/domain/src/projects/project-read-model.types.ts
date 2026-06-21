import type { MilestoneStatus } from "./milestone.types.js";
import type { ProjectCategory } from "./project-category.types.js";
import type { ProjectItemKind, ProjectItemStatus } from "./project-item.types.js";
import type { ProjectUpdateStatus } from "./project-update.types.js";
import type { ProjectStatus, ProjectType } from "./project.types.js";

export type PublicProjectStatus = Extract<ProjectStatus, "planning" | "active" | "completed">;

export type ProjectReadMilestoneSource = {
  id: string;
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  sortOrder: number;
};

export type ProjectReadItemSource = {
  id: string;
  parentItemId?: string | null;
  title: string;
  description?: string | null;
  kind: ProjectItemKind;
  status: ProjectItemStatus;
  quantity: number;
  sortOrder: number;
};

export type ProjectReadUpdateSource = {
  id: string;
  title: string;
  summary?: string | null;
  body: string;
  status: ProjectUpdateStatus;
  isVisible: boolean;
  publishedAt?: string | null;
  isPinned: boolean;
  sortOrder: number;
};

export type ProjectReadModelSource = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  type: ProjectType;
  category: ProjectCategory;
  status: ProjectStatus;
  isPublic: boolean;
  updatedAt?: string;
  milestones: readonly ProjectReadMilestoneSource[];
  items: readonly ProjectReadItemSource[];
  updates: readonly ProjectReadUpdateSource[];
};

export type PublicProjectMilestone = {
  id: string;
  title: string;
  status: Exclude<MilestoneStatus, "cancelled">;
  description?: string;
};

export type PublicProjectItem = {
  id: string;
  title: string;
  kind: ProjectItemKind;
  status: Exclude<ProjectItemStatus, "removed">;
  quantity: number;
  description?: string;
  children: readonly PublicProjectItem[];
};

export type PublicProjectUpdate = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  summary?: string;
  publishedAt?: string;
};

export type PublicProjectSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: ProjectType;
  category: ProjectCategory;
  status: PublicProjectStatus;
  milestoneCount: number;
  itemCount: number;
  updateCount: number;
  nextMilestone?: PublicProjectMilestone;
  updatedAt?: string;
};

export type PublicProjectDetail = PublicProjectSummary & {
  milestones: readonly PublicProjectMilestone[];
  items: readonly PublicProjectItem[];
  updates: readonly PublicProjectUpdate[];
};
