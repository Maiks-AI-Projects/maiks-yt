import type {
  MilestoneStatus,
  ProjectCategory,
  ProjectItemKind,
  ProjectItemStatus,
  ProjectReadModelSource,
  ProjectStatus,
  ProjectType
} from "@maiks-yt/domain/projects";

export type ProjectAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ProjectAdminProjectInput = {
  slug: string;
  title: string;
  summary?: string | null | undefined;
  type: ProjectType;
  category: ProjectCategory;
  status: ProjectStatus;
  isPublic: boolean;
};

export type ProjectAdminProjectUpdateInput = {
  slug?: string | undefined;
  title?: string | undefined;
  summary?: string | null | undefined;
  type?: ProjectType | undefined;
  category?: ProjectCategory | undefined;
  status?: ProjectStatus | undefined;
  isPublic?: boolean | undefined;
};

export type ProjectAdminMilestoneInput = {
  title: string;
  description?: string | null | undefined;
  status: MilestoneStatus;
  sortOrder: number;
};

export type ProjectAdminMilestoneUpdateInput = {
  title?: string | undefined;
  description?: string | null | undefined;
  status?: MilestoneStatus | undefined;
  sortOrder?: number | undefined;
};

export type ProjectAdminItemInput = {
  parentItemId?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
  kind: ProjectItemKind;
  status: ProjectItemStatus;
  quantity: number;
  sortOrder: number;
};

export type ProjectAdminItemUpdateInput = {
  parentItemId?: string | null | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  kind?: ProjectItemKind | undefined;
  status?: ProjectItemStatus | undefined;
  quantity?: number | undefined;
  sortOrder?: number | undefined;
};

export type ProjectAdminReorderInput = {
  orderedIds: readonly string[];
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
      | "project_item_parent_not_found"
      | "project_admin_invalid_input"
      | "project_slug_conflict";
  };

export interface ProjectAdminRepository {
  resolveActor(authUserId: string): Promise<ProjectAdminActor | null>;
  listProjects(): Promise<readonly ProjectReadModelSource[]>;
  createProject(input: ProjectAdminProjectInput & { actorUserId: string }): Promise<ProjectReadModelSource>;
  updateProject(id: string, input: ProjectAdminProjectUpdateInput): Promise<ProjectReadModelSource | "not-found" | "slug-conflict">;
  createMilestone(projectId: string, input: ProjectAdminMilestoneInput): Promise<ProjectReadModelSource | "project-not-found">;
  updateMilestone(projectId: string, milestoneId: string, input: ProjectAdminMilestoneUpdateInput): Promise<ProjectReadModelSource | "project-not-found" | "milestone-not-found">;
  reorderMilestones(projectId: string, input: ProjectAdminReorderInput): Promise<ProjectReadModelSource | "project-not-found" | "milestone-not-found">;
  createItem(projectId: string, input: ProjectAdminItemInput): Promise<ProjectReadModelSource | "project-not-found" | "parent-not-found">;
  updateItem(projectId: string, itemId: string, input: ProjectAdminItemUpdateInput): Promise<ProjectReadModelSource | "project-not-found" | "item-not-found" | "parent-not-found">;
  reorderItems(projectId: string, input: ProjectAdminReorderInput): Promise<ProjectReadModelSource | "project-not-found" | "item-not-found">;
}

export type ProjectAdminWriteResult = ProjectAdminMutationResult;
