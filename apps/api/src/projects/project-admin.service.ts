import type {
  ProjectAdminItemInput,
  ProjectAdminItemUpdateInput,
  ProjectAdminListResult,
  ProjectAdminMilestoneInput,
  ProjectAdminMilestoneUpdateInput,
  ProjectAdminMutationResult,
  ProjectAdminProjectInput,
  ProjectAdminProjectUpdateInput,
  ProjectAdminReorderInput,
  ProjectAdminUpdateInput,
  ProjectAdminUpdateUpdateInput,
  ProjectAdminRepository
} from "./project-admin.types.js";
import type {
  ProjectAdminItemInput as DomainProjectAdminItemInput,
  ProjectAdminMilestoneInput as DomainProjectAdminMilestoneInput,
  ProjectAdminProjectInput as DomainProjectAdminProjectInput,
  ProjectAdminUpdateInput as DomainProjectAdminUpdateInput
} from "@maiks-yt/domain/projects";
import {
  canManageProjects,
  isValidProjectAdminItemInput,
  isValidProjectAdminMilestoneInput,
  isValidProjectAdminProjectInput,
  isValidProjectAdminUpdateInput
} from "@maiks-yt/domain/projects";

const validProjectUpdateFallback = {
  slug: "valid-slug",
  title: "Valid title",
  type: "milestone-only",
  category: "software-project",
  status: "planning",
  isPublic: false
} satisfies ProjectAdminProjectInput;

const validMilestoneUpdateFallback = {
  title: "Valid title",
  status: "planned",
  sortOrder: 0
} satisfies ProjectAdminMilestoneInput;

const validItemUpdateFallback = {
  title: "Valid title",
  kind: "task",
  status: "planned",
  quantity: 1,
  sortOrder: 0
} satisfies ProjectAdminItemInput;

const validUpdateFallback = {
  title: "Valid title",
  body: "Valid body",
  status: "draft",
  isVisible: true,
  isPinned: false,
  sortOrder: 0
} satisfies ProjectAdminUpdateInput;

const toDomainProjectInput = (
  input: ProjectAdminProjectInput | ProjectAdminProjectUpdateInput,
  fallback: ProjectAdminProjectInput = validProjectUpdateFallback
): DomainProjectAdminProjectInput => ({
  slug: input.slug ?? fallback.slug,
  title: input.title ?? fallback.title,
  ...(input.summary !== undefined ? { summary: input.summary } : {}),
  type: input.type ?? fallback.type,
  category: input.category ?? fallback.category,
  status: input.status ?? fallback.status,
  isPublic: input.isPublic ?? fallback.isPublic
});

const toDomainMilestoneInput = (
  input: ProjectAdminMilestoneInput | ProjectAdminMilestoneUpdateInput,
  fallback: ProjectAdminMilestoneInput = validMilestoneUpdateFallback
): DomainProjectAdminMilestoneInput => ({
  title: input.title ?? fallback.title,
  ...(input.description !== undefined ? { description: input.description } : {}),
  status: input.status ?? fallback.status,
  sortOrder: input.sortOrder ?? fallback.sortOrder
});

const toDomainItemInput = (
  input: ProjectAdminItemInput | ProjectAdminItemUpdateInput,
  fallback: ProjectAdminItemInput = validItemUpdateFallback
): DomainProjectAdminItemInput => ({
  ...(input.parentItemId !== undefined ? { parentItemId: input.parentItemId } : {}),
  title: input.title ?? fallback.title,
  ...(input.description !== undefined ? { description: input.description } : {}),
  kind: input.kind ?? fallback.kind,
  status: input.status ?? fallback.status,
  quantity: input.quantity ?? fallback.quantity,
  sortOrder: input.sortOrder ?? fallback.sortOrder
});

const toDomainUpdateInput = (
  input: ProjectAdminUpdateInput | ProjectAdminUpdateUpdateInput,
  fallback: ProjectAdminUpdateInput = validUpdateFallback
): DomainProjectAdminUpdateInput => ({
  title: input.title ?? fallback.title,
  ...(input.summary !== undefined ? { summary: input.summary } : {}),
  body: input.body ?? fallback.body,
  status: input.status ?? fallback.status,
  isVisible: input.isVisible ?? fallback.isVisible,
  ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
  isPinned: input.isPinned ?? fallback.isPinned,
  sortOrder: input.sortOrder ?? fallback.sortOrder
});

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeProjectAdminPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

export class ProjectAdminService {
  public constructor(private readonly repository: ProjectAdminRepository) {}

  public async listProjects(input: { authUserId: string }): Promise<ProjectAdminListResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "project_admin_user_unlinked"
      };
    }

    if (!canManageProjects(normalizeProjectAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "project_admin_forbidden"
      };
    }

    return {
      ok: true,
      projects: await this.repository.listProjects()
    };
  }

  public async createProject(input: {
    authUserId: string;
    project: ProjectAdminProjectInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!isValidProjectAdminProjectInput(toDomainProjectInput(input.project))) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    try {
      return {
        ok: true,
        project: await this.repository.createProject({
          ...input.project,
          actorUserId: actor.domainUserId
        })
      };
    } catch (error) {
      if (error instanceof Error && error.message === "project_slug_conflict") {
        return {
          ok: false,
          reason: "project_slug_conflict"
        };
      }

      throw error;
    }
  }

  public async updateProject(input: {
    authUserId: string;
    projectId: string;
    project: ProjectAdminProjectUpdateInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.isValidProjectUpdate(input.project)) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    const result = await this.repository.updateProject(input.projectId, input.project);

    return this.mapProjectMutationResult(result);
  }

  public async createMilestone(input: {
    authUserId: string;
    projectId: string;
    milestone: ProjectAdminMilestoneInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!isValidProjectAdminMilestoneInput(toDomainMilestoneInput(input.milestone))) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(await this.repository.createMilestone(input.projectId, input.milestone));
  }

  public async updateMilestone(input: {
    authUserId: string;
    projectId: string;
    milestoneId: string;
    milestone: ProjectAdminMilestoneUpdateInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.isValidMilestoneUpdate(input.milestone)) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(
      await this.repository.updateMilestone(input.projectId, input.milestoneId, input.milestone)
    );
  }

  public async reorderMilestones(input: {
    authUserId: string;
    projectId: string;
    reorder: ProjectAdminReorderInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.isValidReorderInput(input.reorder)) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(await this.repository.reorderMilestones(input.projectId, input.reorder));
  }

  public async createItem(input: {
    authUserId: string;
    projectId: string;
    item: ProjectAdminItemInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!isValidProjectAdminItemInput(toDomainItemInput(input.item))) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(await this.repository.createItem(input.projectId, input.item));
  }

  public async updateItem(input: {
    authUserId: string;
    projectId: string;
    itemId: string;
    item: ProjectAdminItemUpdateInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.isValidItemUpdate(input.item)) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(await this.repository.updateItem(input.projectId, input.itemId, input.item));
  }

  public async reorderItems(input: {
    authUserId: string;
    projectId: string;
    reorder: ProjectAdminReorderInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.isValidReorderInput(input.reorder)) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(await this.repository.reorderItems(input.projectId, input.reorder));
  }

  public async createUpdate(input: {
    authUserId: string;
    projectId: string;
    update: ProjectAdminUpdateInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!isValidProjectAdminUpdateInput(toDomainUpdateInput(input.update))) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(await this.repository.createUpdate(input.projectId, input.update));
  }

  public async updateUpdate(input: {
    authUserId: string;
    projectId: string;
    updateId: string;
    update: ProjectAdminUpdateUpdateInput;
  }): Promise<ProjectAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.isValidUpdateUpdate(input.update)) {
      return {
        ok: false,
        reason: "project_admin_invalid_input"
      };
    }

    return this.mapProjectMutationResult(
      await this.repository.updateUpdate(input.projectId, input.updateId, input.update)
    );
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "project_admin_user_unlinked" | "project_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "project_admin_user_unlinked"
      };
    }

    if (!canManageProjects(normalizeProjectAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "project_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }

  private isValidProjectUpdate(input: ProjectAdminProjectUpdateInput): boolean {
    return Object.keys(input).length > 0
      && isValidProjectAdminProjectInput(toDomainProjectInput(input));
  }

  private isValidMilestoneUpdate(input: ProjectAdminMilestoneUpdateInput): boolean {
    return Object.keys(input).length > 0
      && isValidProjectAdminMilestoneInput(toDomainMilestoneInput(input));
  }

  private isValidItemUpdate(input: ProjectAdminItemUpdateInput): boolean {
    return Object.keys(input).length > 0
      && isValidProjectAdminItemInput(toDomainItemInput(input));
  }

  private isValidUpdateUpdate(input: ProjectAdminUpdateUpdateInput): boolean {
    return Object.keys(input).length > 0
      && isValidProjectAdminUpdateInput(toDomainUpdateInput(input));
  }

  private isValidReorderInput(input: ProjectAdminReorderInput): boolean {
    return input.orderedIds.length > 0
      && input.orderedIds.every((id) => typeof id === "string" && id.trim().length > 0)
      && new Set(input.orderedIds).size === input.orderedIds.length;
  }

  private mapProjectMutationResult(
    result:
      | Awaited<ReturnType<ProjectAdminRepository["updateProject"]>>
      | Awaited<ReturnType<ProjectAdminRepository["createMilestone"]>>
      | Awaited<ReturnType<ProjectAdminRepository["updateMilestone"]>>
      | Awaited<ReturnType<ProjectAdminRepository["reorderMilestones"]>>
      | Awaited<ReturnType<ProjectAdminRepository["createItem"]>>
      | Awaited<ReturnType<ProjectAdminRepository["updateItem"]>>
      | Awaited<ReturnType<ProjectAdminRepository["reorderItems"]>>
      | Awaited<ReturnType<ProjectAdminRepository["createUpdate"]>>
      | Awaited<ReturnType<ProjectAdminRepository["updateUpdate"]>>
  ): ProjectAdminMutationResult {
    if (typeof result !== "string") {
      return {
        ok: true,
        project: result
      };
    }

    switch (result) {
      case "item-not-found":
        return {
          ok: false,
          reason: "project_item_not_found"
        };
      case "milestone-not-found":
        return {
          ok: false,
          reason: "project_milestone_not_found"
        };
      case "update-not-found":
        return {
          ok: false,
          reason: "project_update_not_found"
        };
      case "parent-not-found":
        return {
          ok: false,
          reason: "project_item_parent_not_found"
        };
      case "project-not-found":
      case "not-found":
        return {
          ok: false,
          reason: "project_not_found"
        };
      case "slug-conflict":
        return {
          ok: false,
          reason: "project_slug_conflict"
        };
    }
  }
}
