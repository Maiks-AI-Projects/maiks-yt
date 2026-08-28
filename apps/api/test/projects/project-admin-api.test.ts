import type { DatabasePool } from "@maiks-yt/database";
import type {
  ProjectReadModelSource
} from "@maiks-yt/domain/projects";
import { isPublicProjectStatus } from "@maiks-yt/domain/projects";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerProjectAdminRoutes } from "../../src/projects/project-admin.route.js";
import { ProjectAdminService } from "../../src/projects/project-admin.service.js";
import { createProjectAdminRepository } from "../../src/projects/project-admin-store.service.js";
import type {
  ProjectAdminActor,
  ProjectAdminItemInput,
  ProjectAdminItemLinkInput,
  ProjectAdminItemLinkUpdateInput,
  ProjectAdminMilestoneInput,
  ProjectAdminProjectInput,
  ProjectAdminProjectUpdateInput,
  ProjectAdminUpdateInput,
  ProjectAdminUpdateUpdateInput,
  ProjectAdminRepository
} from "../../src/projects/project-admin.types.js";

const publicProjectStatuses = ["planning", "active", "completed"] as const;

const createProject = (
  id: string,
  overrides: Partial<ProjectReadModelSource> = {}
): ProjectReadModelSource => ({
  id,
  slug: id,
  title: `Project ${id}`,
  summary: `Summary for ${id}`,
  type: "milestone-only",
  category: "software-project",
  status: "planning",
  isPublic: false,
  milestones: [],
  items: [],
  updates: [],
  ...overrides
});

class FakeProjectAdminRepository implements ProjectAdminRepository {
  public actor: ProjectAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly projects = new Map<string, ProjectReadModelSource>();
  public lastCreatedProject: (ProjectAdminProjectInput & { actorUserId: string }) | null = null;
  public lastProjectUpdate: ProjectAdminProjectUpdateInput | null = null;
  public lastCreatedMilestone: ProjectAdminMilestoneInput | null = null;
  public lastCreatedItem: ProjectAdminItemInput | null = null;
  public lastCreatedItemLink: ProjectAdminItemLinkInput | null = null;
  public lastUpdatedItemLink: ProjectAdminItemLinkUpdateInput | null = null;
  public lastDeletedItemLink: { itemId: string; linkId: string } | null = null;
  public lastCreatedUpdate: ProjectAdminUpdateInput | null = null;
  public lastUpdateUpdate: ProjectAdminUpdateUpdateInput | null = null;
  public lastMilestoneReorder: readonly string[] | null = null;
  public lastItemReorder: readonly string[] | null = null;

  public constructor() {
    this.projects.set("project", createProject("project"));
  }

  public async resolveActor(): Promise<ProjectAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listProjects(): Promise<readonly ProjectReadModelSource[]> {
    return [...this.projects.values()].map((project) => structuredClone(project));
  }

  public async createProject(input: ProjectAdminProjectInput & { actorUserId: string }): Promise<ProjectReadModelSource> {
    if ([...this.projects.values()].some((project) => project.slug === input.slug)) {
      throw new Error("project_slug_conflict");
    }

    this.lastCreatedProject = structuredClone(input);
    const project = createProject("created", input);
    this.projects.set(project.id, project);
    return structuredClone(project);
  }

  public async updateProject(id: string, input: ProjectAdminProjectUpdateInput) {
    const project = this.projects.get(id);

    if (!project) {
      return "not-found" as const;
    }

    if (input.slug && [...this.projects.values()].some((candidate) => candidate.id !== id && candidate.slug === input.slug)) {
      return "slug-conflict" as const;
    }

    const nextStatus = input.status ?? project.status;

    if (input.isPublic === true && !isPublicProjectStatus(nextStatus)) {
      return "unpublishable-status" as const;
    }

    this.lastProjectUpdate = structuredClone(input);
    const updated = {
      ...project,
      ...input,
      isPublic: isPublicProjectStatus(nextStatus)
        ? input.isPublic ?? project.isPublic
        : false
    };
    this.projects.set(id, updated);
    return structuredClone(updated);
  }

  public async createMilestone(projectId: string, input: ProjectAdminMilestoneInput) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    this.lastCreatedMilestone = structuredClone(input);
    const updated = {
      ...project,
      milestones: [
        ...project.milestones,
        {
          id: "milestone-created",
          ...input
        }
      ]
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }

  public async updateMilestone(projectId: string, milestoneId: string) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    if (!project.milestones.some((milestone) => milestone.id === milestoneId)) {
      return "milestone-not-found" as const;
    }

    return structuredClone(project);
  }

  public async reorderMilestones(projectId: string, input: { orderedIds: readonly string[] }) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    this.lastMilestoneReorder = [...input.orderedIds];
    return structuredClone(project);
  }

  public async createItem(projectId: string, input: ProjectAdminItemInput) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    if (input.parentItemId && !project.items.some((item) => item.id === input.parentItemId)) {
      return "parent-not-found" as const;
    }

    this.lastCreatedItem = structuredClone(input);
    const updated = {
      ...project,
      items: [
        ...project.items,
        {
          id: "item-created",
          ...input,
          links: []
        }
      ]
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }

  public async updateItem(projectId: string, itemId: string) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    if (!project.items.some((item) => item.id === itemId)) {
      return "item-not-found" as const;
    }

    return structuredClone(project);
  }

  public async createItemLink(projectId: string, itemId: string, input: ProjectAdminItemLinkInput) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    if (!project.items.some((item) => item.id === itemId)) {
      return "item-not-found" as const;
    }

    this.lastCreatedItemLink = structuredClone(input);
    const updated = {
      ...project,
      items: project.items.map((item) => item.id === itemId
        ? {
          ...item,
          links: [
            ...item.links,
            {
              id: "item-link-created",
              ...input
            }
          ]
        }
        : item)
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }

  public async updateItemLink(projectId: string, itemId: string, linkId: string, input: ProjectAdminItemLinkUpdateInput) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    const item = project.items.find((candidate) => candidate.id === itemId);

    if (!item) {
      return "item-not-found" as const;
    }

    if (!item.links.some((link) => link.id === linkId)) {
      return "item-link-not-found" as const;
    }

    this.lastUpdatedItemLink = structuredClone(input);
    const updated = {
      ...project,
      items: project.items.map((candidate) => candidate.id === itemId
        ? {
          ...candidate,
          links: candidate.links.map((link) => link.id === linkId ? { ...link, ...input } : link)
        }
        : candidate)
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }

  public async deleteItemLink(projectId: string, itemId: string, linkId: string) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    const item = project.items.find((candidate) => candidate.id === itemId);

    if (!item) {
      return "item-not-found" as const;
    }

    if (!item.links.some((link) => link.id === linkId)) {
      return "item-link-not-found" as const;
    }

    this.lastDeletedItemLink = { itemId, linkId };
    const updated = {
      ...project,
      items: project.items.map((candidate) => candidate.id === itemId
        ? {
          ...candidate,
          links: candidate.links.filter((link) => link.id !== linkId)
        }
        : candidate)
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }

  public async reorderItems(projectId: string, input: { orderedIds: readonly string[] }) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    this.lastItemReorder = [...input.orderedIds];
    return structuredClone(project);
  }

  public async createUpdate(projectId: string, input: ProjectAdminUpdateInput) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    this.lastCreatedUpdate = structuredClone(input);
    const updated = {
      ...project,
      updates: [
        ...project.updates,
        {
          id: "update-created",
          ...input
        }
      ]
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }

  public async updateUpdate(projectId: string, updateId: string, input: ProjectAdminUpdateUpdateInput) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    if (!project.updates.some((update) => update.id === updateId)) {
      return "update-not-found" as const;
    }

    this.lastUpdateUpdate = structuredClone(input);
    const updated = {
      ...project,
      updates: project.updates.map((update) => update.id === updateId ? { ...update, ...input } : update)
    };
    this.projects.set(projectId, updated);
    return structuredClone(updated);
  }
}

describe("ProjectAdminService", () => {
  it("allows owner wildcard and typed project-admin permissions", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    await expect(service.listProjects({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["project-admin:manage"])]
    };

    await expect(service.listProjects({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true
    });
  });

  it("denies unlinked and normal linked users", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    repository.actor = null;
    await expect(service.listProjects({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "project_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["action-panel:view"]]
    };
    await expect(service.createProject({
      authUserId: "auth-user",
      project: {
        slug: "new-project",
        title: "New project",
        type: "milestone-only",
        category: "software-project",
        status: "planning",
        isPublic: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "project_admin_forbidden"
    });
  });

  it("creates private projects and can later mark them public", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    const createResult = await service.createProject({
      authUserId: "auth-user",
      project: {
        slug: "manual-admin",
        title: "Manual Admin",
        summary: "Draft project",
        type: "stream-work-project",
        category: "software-project",
        status: "planning",
        isPublic: false
      }
    });

    expect(createResult.ok).toBe(true);
    expect(repository.lastCreatedProject).toMatchObject({
      actorUserId: "domain-user",
      isPublic: false
    });

    const updateResult = await service.updateProject({
      authUserId: "auth-user",
      projectId: "created",
      project: {
        isPublic: true
      }
    });

    expect(updateResult.ok).toBe(true);
    expect(repository.lastProjectUpdate).toEqual({
      isPublic: true
    });
  });

  it("rejects publishing projects whose status is hidden from public reads", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    await expect(service.createProject({
      authUserId: "auth-user",
      project: {
        slug: "cancelled-public",
        title: "Cancelled Public",
        type: "milestone-only",
        category: "software-project",
        status: "cancelled",
        isPublic: true
      }
    })).resolves.toEqual({
      ok: false,
      reason: "project_admin_unpublishable_status"
    });

    repository.projects.set("mothballed", createProject("mothballed", {
      status: "mothballed",
      isPublic: false
    }));

    await expect(service.updateProject({
      authUserId: "auth-user",
      projectId: "mothballed",
      project: {
        isPublic: true
      }
    })).resolves.toEqual({
      ok: false,
      reason: "project_admin_unpublishable_status"
    });
    expect(repository.lastProjectUpdate).toBeNull();
  });

  it("unpublishes a public project when changing it to a hidden status", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    repository.projects.set("published", createProject("published", {
      status: "active",
      isPublic: true
    }));

    const result = await service.updateProject({
      authUserId: "auth-user",
      projectId: "published",
      project: {
        status: "mothballed"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      project: {
        status: "mothballed",
        isPublic: false
      }
    });
    expect(repository.lastProjectUpdate).toEqual({
      status: "mothballed"
    });
  });

  it("creates milestones, non-money items, and reorder updates", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    await expect(service.createMilestone({
      authUserId: "auth-user",
      projectId: "project",
      milestone: {
        title: "First milestone",
        status: "planned",
        sortOrder: 1
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastCreatedMilestone).toMatchObject({
      title: "First milestone"
    });

    await expect(service.createItem({
      authUserId: "auth-user",
      projectId: "project",
      item: {
        title: "Manual task",
        description: "Manual product estimate without provider sync or funding fields.",
        kind: "task",
        status: "planned",
        quantity: 1,
        estimatedMinorAmount: 1299,
        currencyCode: "EUR",
        sortOrder: 1
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastCreatedItem).toEqual({
      title: "Manual task",
      description: "Manual product estimate without provider sync or funding fields.",
      kind: "task",
      status: "planned",
      quantity: 1,
      estimatedMinorAmount: 1299,
      currencyCode: "EUR",
      sortOrder: 1
    });

    await expect(service.createItemLink({
      authUserId: "auth-user",
      projectId: "project",
      itemId: "item-created",
      link: {
        provider: "manual",
        url: "https://example.com/wishlist/item",
        label: "Wishlist entry",
        relationship: "wishlist-entry"
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastCreatedItemLink).toEqual({
      provider: "manual",
      url: "https://example.com/wishlist/item",
      label: "Wishlist entry",
      relationship: "wishlist-entry"
    });

    await expect(service.updateItemLink({
      authUserId: "auth-user",
      projectId: "project",
      itemId: "item-created",
      linkId: "item-link-created",
      link: {
        label: "Updated wishlist entry",
        relationship: "store-product"
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastUpdatedItemLink).toEqual({
      label: "Updated wishlist entry",
      relationship: "store-product"
    });

    await expect(service.deleteItemLink({
      authUserId: "auth-user",
      projectId: "project",
      itemId: "item-created",
      linkId: "item-link-created"
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastDeletedItemLink).toEqual({
      itemId: "item-created",
      linkId: "item-link-created"
    });

    await expect(service.reorderMilestones({
      authUserId: "auth-user",
      projectId: "project",
      reorder: {
        orderedIds: ["milestone-created"]
      }
    })).resolves.toMatchObject({ ok: true });
    await expect(service.reorderItems({
      authUserId: "auth-user",
      projectId: "project",
      reorder: {
        orderedIds: ["item-created"]
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastMilestoneReorder).toEqual(["milestone-created"]);
    expect(repository.lastItemReorder).toEqual(["item-created"]);
  });

  it("creates and edits manual project updates without publishing drafts publicly", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    await expect(service.createUpdate({
      authUserId: "auth-user",
      projectId: "project",
      update: {
        title: "Manual update",
        summary: "Admin-written update.",
        body: "This starts as a draft.",
        status: "draft",
        isVisible: true,
        isPinned: false,
        sortOrder: 1
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastCreatedUpdate).toMatchObject({
      status: "draft",
      isVisible: true
    });

    await expect(service.updateUpdate({
      authUserId: "auth-user",
      projectId: "project",
      updateId: "update-created",
      update: {
        status: "published",
        isVisible: true
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastUpdateUpdate).toEqual({
      status: "published",
      isVisible: true
    });
  });

  it("rejects invalid input and missing parent item links", async () => {
    const repository = new FakeProjectAdminRepository();
    const service = new ProjectAdminService(repository);

    await expect(service.createProject({
      authUserId: "auth-user",
      project: {
        slug: "Bad Slug",
        title: "Bad",
        type: "milestone-only",
        category: "software-project",
        status: "planning",
        isPublic: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "project_admin_invalid_input"
    });

    await expect(service.createItem({
      authUserId: "auth-user",
      projectId: "project",
      item: {
        parentItemId: "missing-parent",
        title: "Child task",
        kind: "task",
        status: "planned",
        quantity: 1,
        sortOrder: 1
      }
    })).resolves.toEqual({
      ok: false,
      reason: "project_item_parent_not_found"
    });
  });
});

describe("Project admin route boundary", () => {
  it("returns 401 without a session and 403 for normal linked users", async () => {
    const unauthenticatedServer = Fastify();
    registerProjectAdminRoutes(unauthenticatedServer, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const unauthenticatedResponse = await unauthenticatedServer.inject({
      method: "GET",
      url: "/admin/projects"
    });
    expect(unauthenticatedResponse.statusCode).toBe(401);
    expect(unauthenticatedResponse.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    await unauthenticatedServer.close();

    const repository = new FakeProjectAdminRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [[]]
    };
    const forbiddenServer = Fastify();
    registerProjectAdminRoutes(forbiddenServer, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ProjectAdminService(repository)
    });

    const forbiddenResponse = await forbiddenServer.inject({
      method: "GET",
      url: "/admin/projects"
    });
    expect(forbiddenResponse.statusCode).toBe(403);
    expect(forbiddenResponse.json()).toEqual({
      ok: false,
      reason: "project_admin_forbidden"
    });
    await forbiddenServer.close();
  });

  it("validates payloads and maps not found/conflict results", async () => {
    const cases = [
      {
        result: { ok: false, reason: "project_admin_invalid_input" } as const,
        statusCode: 400
      },
      {
        result: { ok: false, reason: "project_admin_unpublishable_status" } as const,
        statusCode: 400
      },
      {
        result: { ok: false, reason: "project_not_found" } as const,
        statusCode: 404
      },
      {
        result: { ok: false, reason: "project_slug_conflict" } as const,
        statusCode: 409
      }
    ];

    for (const testCase of cases) {
      const server = Fastify();
      registerProjectAdminRoutes(server, {
        getAuthSession: async () => ({ user: { id: "auth-user" } }),
        getDatabasePool: () => {
          throw new Error("pool should not be used");
        },
        createService: () => ({
          listProjects: async () => ({
            ok: true,
            projects: []
          }),
          createProject: async () => testCase.result,
          updateProject: async () => testCase.result,
          createMilestone: async () => testCase.result,
          updateMilestone: async () => testCase.result,
          reorderMilestones: async () => testCase.result,
          createItem: async () => testCase.result,
          updateItem: async () => testCase.result,
          createItemLink: async () => testCase.result,
          updateItemLink: async () => testCase.result,
          deleteItemLink: async () => testCase.result,
          reorderItems: async () => testCase.result,
          createUpdate: async () => testCase.result,
          updateUpdate: async () => testCase.result
        })
      });

      const response = await server.inject({
        method: "PATCH",
        url: "/admin/projects/project",
        payload: {
          title: "Updated"
        }
      });

      expect(response.statusCode).toBe(testCase.statusCode);
      expect(response.json()).toEqual(testCase.result);
      await server.close();
    }
  });

  it("fails closed when the admin route tries to publish a hidden-status project", async () => {
    const repository = new FakeProjectAdminRepository();
    const server = Fastify();

    registerProjectAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ProjectAdminService(repository)
    });

    const response = await server.inject({
      method: "PATCH",
      url: "/admin/projects/project",
      payload: {
        status: "cancelled",
        isPublic: true
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "project_admin_unpublishable_status"
    });
    expect(repository.lastProjectUpdate).toBeNull();

    await server.close();
  });
});

describe("Project admin mysql authorization boundary", () => {
  it("excludes revoked and expired role grants while preserving active delegated access", async () => {
    let actorSql = "";
    const repository = createProjectAdminRepository({
      execute: async (sql: string) => {
        actorSql = sql;
        return [[{
          domainUserId: "domain-project-admin",
          rolePermissions: JSON.stringify(["project-admin:manage"])
        }]];
      }
    } as unknown as DatabasePool);

    const actor = await repository.resolveActor("auth-project-admin");

    expect(actor).toEqual({
      domainUserId: "domain-project-admin",
      rolePermissionValues: [JSON.stringify(["project-admin:manage"])]
    });
    expect(actorSql).toContain("user_roles.revoked_at IS NULL");
    expect(actorSql).toContain("user_roles.expires_at IS NULL OR user_roles.expires_at > NOW()");
  });

  it("denies linked users when no active project-admin grant remains", async () => {
    const repository = createProjectAdminRepository({
      execute: async () => [[{
        domainUserId: "domain-project-admin",
        rolePermissions: null
      }]]
    } as unknown as DatabasePool);
    const service = new ProjectAdminService({
      ...repository,
      listProjects: async () => {
        throw new Error("inactive grant must not list projects");
      }
    });

    await expect(service.listProjects({ authUserId: "auth-project-admin" })).resolves.toEqual({
      ok: false,
      reason: "project_admin_forbidden"
    });
  });
});

describe("Project admin mysql publication boundary", () => {
  it("predicates publish-only updates on the stored public status and fails closed on a miss", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createProjectAdminRepository({
      execute: async (sql: string, values: readonly unknown[] = []) => {
        calls.push({ sql, values });

        return calls.length === 1
          ? [{ affectedRows: 0 }]
          : [[{ id: "mothballed-project" }]];
      }
    } as unknown as DatabasePool);

    await expect(repository.updateProject("mothballed-project", {
      isPublic: true
    })).resolves.toBe("unpublishable-status");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.sql).toContain("WHERE id = ? AND status IN (?, ?, ?)");
    expect(calls[0]?.values).toEqual([
      true,
      "mothballed-project",
      ...publicProjectStatuses
    ]);
    expect(calls[1]?.sql).toContain("SELECT id FROM projects WHERE id = ? LIMIT 1");
  });

  it("clears publication in the same SQL statement that stores an ineligible status", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createProjectAdminRepository({
      execute: async (sql: string, values: readonly unknown[] = []) => {
        calls.push({ sql, values });
        return [{ affectedRows: 0 }];
      }
    } as unknown as DatabasePool);

    await expect(repository.updateProject("published-project", {
      status: "cancelled"
    })).resolves.toBe("not-found");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("status = ?, is_public = CASE WHEN ? IN (?, ?, ?) THEN is_public ELSE FALSE END");
    expect(calls[0]?.sql).not.toContain("AND status IN");
    expect(calls[0]?.values).toEqual([
      "cancelled",
      "cancelled",
      ...publicProjectStatuses,
      "published-project"
    ]);
  });

  it("normalizes stale hidden-status publication during other project updates", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createProjectAdminRepository({
      execute: async (sql: string, values: readonly unknown[] = []) => {
        calls.push({ sql, values });
        return [{ affectedRows: 0 }];
      }
    } as unknown as DatabasePool);

    await expect(repository.updateProject("stale-project", {
      title: "Updated title"
    })).resolves.toBe("not-found");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("title = ?, is_public = CASE WHEN status IN (?, ?, ?) THEN is_public ELSE FALSE END");
    expect(calls[0]?.values).toEqual([
      "Updated title",
      ...publicProjectStatuses,
      "stale-project"
    ]);
  });
});
