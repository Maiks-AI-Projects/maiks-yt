import type { ProjectReadModelSource } from "@maiks-yt/domain/projects";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerProjectReadRoutes } from "../../src/projects/project-read.route.js";
import { ProjectReadService } from "../../src/projects/project-read.service.js";
import type { ProjectReadRepository } from "../../src/projects/project-read.types.js";

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
  isPublic: true,
  milestones: [],
  items: [],
  ...overrides
});

class FakeProjectReadRepository implements ProjectReadRepository {
  public constructor(private readonly projects: readonly ProjectReadModelSource[]) {}

  public async listProjects(): Promise<readonly ProjectReadModelSource[]> {
    return this.projects.map((project) => structuredClone(project));
  }

  public async findProjectBySlug(slug: string): Promise<ProjectReadModelSource | null> {
    const project = this.projects.find((candidate) => candidate.slug === slug);

    return project ? structuredClone(project) : null;
  }
}

describe("public project read API", () => {
  it("returns only public available projects in stable order", async () => {
    const repository = new FakeProjectReadRepository([
      createProject("private", { isPublic: false, status: "active" }),
      createProject("completed", { status: "completed", category: "hobby" }),
      createProject("cancelled", { status: "cancelled" }),
      createProject("planning", { status: "planning", category: "community" }),
      createProject("active", { status: "active" })
    ]);
    const server = Fastify();

    registerProjectReadRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ProjectReadService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/projects"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      projects: [
        { slug: "active", status: "active" },
        { slug: "planning", status: "planning" },
        { slug: "completed", status: "completed" }
      ]
    });
    await server.close();
  });

  it("returns project detail with public milestones and non-monetary items", async () => {
    const repository = new FakeProjectReadRepository([
      createProject("maiks-yt-v2", {
        status: "active",
        milestones: [
          {
            id: "foundation",
            title: "Foundation",
            status: "completed",
            sortOrder: 1
          },
          {
            id: "read-slice",
            title: "Read-only projects",
            status: "active",
            sortOrder: 2
          }
        ],
        items: [
          {
            id: "api",
            title: "Public API",
            description: "Read-only endpoints.",
            kind: "task",
            status: "active",
            quantity: 1,
            sortOrder: 1
          }
        ]
      })
    ]);
    const server = Fastify();

    registerProjectReadRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ProjectReadService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/projects/maiks-yt-v2"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      project: {
        slug: "maiks-yt-v2",
        nextMilestone: {
          id: "read-slice"
        },
        milestones: [
          { id: "foundation" },
          { id: "read-slice" }
        ],
        items: [
          {
            id: "api",
            kind: "task",
            status: "active"
          }
        ]
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("minorAmount");
    await server.close();
  });

  it("returns 404 for private, cancelled, and missing project details", async () => {
    const repository = new FakeProjectReadRepository([
      createProject("private", { isPublic: false, status: "active" }),
      createProject("cancelled", { status: "cancelled" })
    ]);
    const server = Fastify();

    registerProjectReadRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ProjectReadService(repository)
    });

    for (const slug of ["private", "cancelled", "missing"]) {
      const response = await server.inject({
        method: "GET",
        url: `/projects/${slug}`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        ok: false,
        reason: "project_not_found"
      });
    }

    await server.close();
  });

  it("returns stable errors for malformed slugs and unavailable data", async () => {
    const badSlugServer = Fastify();
    registerProjectReadRoutes(badSlugServer, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ProjectReadService(new FakeProjectReadRepository([]))
    });
    const badSlugResponse = await badSlugServer.inject({
      method: "GET",
      url: "/projects/Bad_Slug"
    });

    expect(badSlugResponse.statusCode).toBe(400);
    expect(badSlugResponse.json()).toEqual({
      ok: false,
      reason: "invalid_project_slug"
    });
    await badSlugServer.close();

    const unavailableServer = Fastify();
    registerProjectReadRoutes(unavailableServer, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => ({
        listProjects: async () => {
          throw new Error("database unavailable");
        },
        getProject: async () => {
          throw new Error("database unavailable");
        }
      })
    });
    const unavailableResponse = await unavailableServer.inject({
      method: "GET",
      url: "/projects"
    });

    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json()).toEqual({
      ok: false,
      reason: "projects_unavailable"
    });
    await unavailableServer.close();
  });
});
