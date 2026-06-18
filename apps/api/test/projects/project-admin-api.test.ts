import type {
  ProjectReadModelSource
} from "@maiks-yt/domain/projects";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerProjectAdminRoutes } from "../../src/projects/project-admin.route.js";
import { ProjectAdminService } from "../../src/projects/project-admin.service.js";
import type {
  ProjectAdminActor,
  ProjectAdminItemInput,
  ProjectAdminMilestoneInput,
  ProjectAdminProjectInput,
  ProjectAdminProjectUpdateInput,
  ProjectAdminRepository
} from "../../src/projects/project-admin.types.js";

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

    this.lastProjectUpdate = structuredClone(input);
    const updated = {
      ...project,
      ...input
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
          ...input
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

  public async reorderItems(projectId: string, input: { orderedIds: readonly string[] }) {
    const project = this.projects.get(projectId);

    if (!project) {
      return "project-not-found" as const;
    }

    this.lastItemReorder = [...input.orderedIds];
    return structuredClone(project);
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
        description: "No provider, estimate, donation, or funding fields.",
        kind: "task",
        status: "planned",
        quantity: 1,
        sortOrder: 1
      }
    })).resolves.toMatchObject({ ok: true });
    expect(repository.lastCreatedItem).toEqual({
      title: "Manual task",
      description: "No provider, estimate, donation, or funding fields.",
      kind: "task",
      status: "planned",
      quantity: 1,
      sortOrder: 1
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
          reorderItems: async () => testCase.result
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
});
