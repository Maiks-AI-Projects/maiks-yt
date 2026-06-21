import type { MilestoneStatus } from "./milestone.types.js";
import type { ProjectCategory } from "./project-category.types.js";
import type { ProjectItemKind, ProjectItemStatus } from "./project-item.types.js";
import type { PublicProjectDetail } from "./project-read-model.types.js";
import type { ProjectReadModelSource } from "./project-read-model.types.js";
import type { ProjectUpdateStatus } from "./project-update.types.js";
import type { ProjectStatus, ProjectType } from "./project.types.js";

export const projectAdminManageCapability = "project-admin:manage" as const;

export type ProjectAdminCapability =
  | "*"
  | typeof projectAdminManageCapability;

export type ProjectAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ProjectAdminProjectInput = {
  slug: string;
  title: string;
  summary?: string | null;
  type: ProjectType;
  category: ProjectCategory;
  status: ProjectStatus;
  isPublic: boolean;
};

export type ProjectAdminProjectUpdateInput = Partial<ProjectAdminProjectInput>;

export type ProjectAdminMilestoneInput = {
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  sortOrder: number;
};

export type ProjectAdminMilestoneUpdateInput = Partial<ProjectAdminMilestoneInput>;

export type ProjectAdminItemInput = {
  parentItemId?: string | null;
  title: string;
  description?: string | null;
  kind: ProjectItemKind;
  status: ProjectItemStatus;
  quantity: number;
  sortOrder: number;
};

export type ProjectAdminItemUpdateInput = Partial<ProjectAdminItemInput>;

export type ProjectAdminUpdateInput = {
  title: string;
  summary?: string | null;
  body: string;
  status: ProjectUpdateStatus;
  isVisible: boolean;
  publishedAt?: string | null;
  isPinned: boolean;
  sortOrder: number;
};

export type ProjectAdminUpdateUpdateInput = Partial<ProjectAdminUpdateInput>;

export type ProjectAdminReorderInput = {
  orderedIds: readonly string[];
};

export type ProjectAdminPublicPreviewResult =
  | {
    ok: true;
    project: PublicProjectDetail;
  }
  | {
    ok: false;
    reason: "project_admin_preview_unavailable_status";
  };

export type ProjectAdminListResult =
  | {
    ok: true;
    projects: readonly ProjectReadModelSource[];
  }
  | {
    ok: false;
    reason: "project_admin_user_unlinked" | "project_admin_forbidden";
  };

export type ProjectAdminMutationResult =
  | {
    ok: true;
    project: ProjectReadModelSource;
  }
  | {
    ok: false;
    reason:
      | "project_admin_user_unlinked"
      | "project_admin_forbidden"
      | "project_not_found"
      | "project_milestone_not_found"
      | "project_item_not_found"
      | "project_update_not_found"
      | "project_item_parent_not_found"
      | "project_admin_invalid_input"
      | "project_slug_conflict";
  };
