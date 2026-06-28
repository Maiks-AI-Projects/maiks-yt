import type { ContentPageSource } from "@maiks-yt/domain/pages";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerContentPageRoutes } from "../../src/pages/content-page.route.js";
import { ContentPageService } from "../../src/pages/content-page.service.js";
import type {
  ContentPageAdminActor,
  ContentPageCreateInput,
  ContentPageRepository,
  ContentPageUpdateInput
} from "../../src/pages/content-page.types.js";

const createPage = (
  id: string,
  overrides: Partial<ContentPageSource> = {}
): ContentPageSource => ({
  id,
  title: `Page ${id}`,
  routeScope: "primary",
  normalizedPath: `/${id}`,
  status: "draft",
  visibility: "hidden",
  seoTitle: null,
  seoDescription: null,
  body: `Body for ${id}`,
  createdByUserId: "domain-user",
  updatedByUserId: "domain-user",
  publishedAt: null,
  createdAt: "2026-06-28T09:00:00.000Z",
  updatedAt: "2026-06-28T09:00:00.000Z",
  ...overrides
});

class FakeContentPageRepository implements ContentPageRepository {
  public actor: ContentPageAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly pages = new Map<string, ContentPageSource>();

  public async resolveActor(): Promise<ContentPageAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listPages(): Promise<readonly ContentPageSource[]> {
    return [...this.pages.values()].map((page) => structuredClone(page));
  }

  public async getPage(id: string): Promise<ContentPageSource | null> {
    const page = this.pages.get(id);

    return page ? structuredClone(page) : null;
  }

  public async createPage(input: ContentPageCreateInput & {
    normalizedPath: string;
    actorUserId: string;
  }): Promise<ContentPageSource> {
    if ([...this.pages.values()].some((page) => page.normalizedPath === input.normalizedPath)) {
      throw new Error("content_page_path_conflict");
    }

    const page = createPage(`page-${this.pages.size + 1}`, {
      title: input.title,
      normalizedPath: input.normalizedPath,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      body: input.body,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId
    });
    this.pages.set(page.id, page);

    return structuredClone(page);
  }

  public async updatePage(id: string, input: ContentPageUpdateInput & {
    normalizedPath?: string;
    actorUserId: string;
  }): Promise<ContentPageSource | "not-found" | "path-conflict"> {
    const existing = this.pages.get(id);

    if (!existing) {
      return "not-found";
    }

    if (input.normalizedPath
      && [...this.pages.values()].some((page) => page.id !== id && page.normalizedPath === input.normalizedPath)) {
      return "path-conflict";
    }

    const next = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.normalizedPath !== undefined ? { normalizedPath: input.normalizedPath } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle?.trim() || null } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription?.trim() || null } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      updatedByUserId: input.actorUserId,
      updatedAt: "2026-06-28T10:00:00.000Z"
    };
    this.pages.set(id, next);

    return structuredClone(next);
  }

  public async publishPage(id: string, actorUserId: string): Promise<ContentPageSource | "not-found"> {
    const existing = this.pages.get(id);

    if (!existing) {
      return "not-found";
    }

    const next = {
      ...existing,
      status: "published",
      visibility: "public",
      publishedAt: existing.publishedAt ?? "2026-06-28T10:00:00.000Z",
      updatedByUserId: actorUserId,
      updatedAt: "2026-06-28T10:00:00.000Z"
    } satisfies ContentPageSource;
    this.pages.set(id, next);

    return structuredClone(next);
  }

  public async unpublishPage(id: string, actorUserId: string): Promise<ContentPageSource | "not-found"> {
    const existing = this.pages.get(id);

    if (!existing) {
      return "not-found";
    }

    const next = {
      ...existing,
      status: "draft",
      visibility: "hidden",
      publishedAt: null,
      updatedByUserId: actorUserId,
      updatedAt: "2026-06-28T11:00:00.000Z"
    } satisfies ContentPageSource;
    this.pages.set(id, next);

    return structuredClone(next);
  }

  public async findPublicPagesByPath(normalizedPath: string): Promise<readonly ContentPageSource[]> {
    return [...this.pages.values()]
      .filter((page) =>
        page.normalizedPath === normalizedPath
        && page.status === "published"
        && page.visibility === "public"
      )
      .map((page) => structuredClone(page));
  }
}

describe("ContentPageService", () => {
  it("allows owner wildcard and typed page creator permission", async () => {
    const repository = new FakeContentPageRepository();
    const service = new ContentPageService(repository);

    await expect(service.listPages({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["page-creator:manage"])]
    };

    await expect(service.createPage({
      authUserId: "auth-user",
      page: {
        title: "Channel Rules",
        path: "Channel/Rules",
        body: "Be kind."
      }
    })).resolves.toMatchObject({
      ok: true,
      page: {
        normalizedPath: "/channel/rules",
        status: "draft",
        visibility: "hidden"
      }
    });
  });

  it("denies unlinked and normal linked users", async () => {
    const repository = new FakeContentPageRepository();
    const service = new ContentPageService(repository);

    repository.actor = null;
    await expect(service.listPages({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "content_page_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["project-admin:manage"]]
    };

    await expect(service.createPage({
      authUserId: "auth-user",
      page: {
        title: "Nope",
        path: "/nope",
        body: "Hidden"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "content_page_admin_forbidden"
    });
  });

  it("rejects reserved paths and path conflicts before publish", async () => {
    const repository = new FakeContentPageRepository();
    repository.pages.set("existing", createPage("existing", {
      normalizedPath: "/channel/rules"
    }));
    const service = new ContentPageService(repository);

    await expect(service.createPage({
      authUserId: "auth-user",
      page: {
        title: "Admin Page",
        path: "/admin/custom",
        body: "No."
      }
    })).resolves.toEqual({
      ok: false,
      reason: "content_page_reserved_path"
    });

    await expect(service.createPage({
      authUserId: "auth-user",
      page: {
        title: "Duplicate Page",
        path: "/channel/rules",
        body: "No."
      }
    })).resolves.toEqual({
      ok: false,
      reason: "content_page_path_conflict"
    });
  });

  it("publishes and unpublishes with public exact-path reads", async () => {
    const repository = new FakeContentPageRepository();
    repository.pages.set("draft", createPage("draft", {
      normalizedPath: "/campaign"
    }));
    const service = new ContentPageService(repository);

    await expect(service.getPublicPageByPath({ path: "/campaign" })).resolves.toEqual({
      ok: false,
      reason: "content_page_not_found"
    });

    await expect(service.publishPage({
      authUserId: "auth-user",
      pageId: "draft"
    })).resolves.toMatchObject({
      ok: true,
      page: {
        status: "published",
        visibility: "public"
      }
    });

    await expect(service.getPublicPageByPath({ path: "/campaign" })).resolves.toMatchObject({
      ok: true,
      page: {
        path: "/campaign",
        title: "Page draft"
      }
    });

    await expect(service.unpublishPage({
      authUserId: "auth-user",
      pageId: "draft"
    })).resolves.toMatchObject({
      ok: true,
      page: {
        status: "draft",
        visibility: "hidden",
        publishedAt: null
      }
    });
  });

  it("fails closed for reserved public routes and ambiguous matches", async () => {
    const repository = new FakeContentPageRepository();
    const visible = createPage("visible", {
      normalizedPath: "/visible",
      status: "published",
      visibility: "public",
      publishedAt: "2026-06-28T10:00:00.000Z"
    });
    repository.pages.set("visible-a", visible);
    repository.pages.set("visible-b", {
      ...visible,
      id: "visible-b"
    });
    const service = new ContentPageService(repository);

    await expect(service.getPublicPageByPath({ path: "/projects/anything" })).resolves.toEqual({
      ok: false,
      reason: "content_page_not_found"
    });
    await expect(service.getPublicPageByPath({ path: "/visible" })).resolves.toEqual({
      ok: false,
      reason: "content_page_ambiguous"
    });
  });
});

describe("content page route boundary", () => {
  it("returns 401 without a session and 403 for normal linked users", async () => {
    const unauthenticatedServer = Fastify();
    registerContentPageRoutes(unauthenticatedServer, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const unauthenticatedResponse = await unauthenticatedServer.inject({
      method: "GET",
      url: "/admin/pages"
    });
    expect(unauthenticatedResponse.statusCode).toBe(401);
    expect(unauthenticatedResponse.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    await unauthenticatedServer.close();

    const repository = new FakeContentPageRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [[]]
    };
    const forbiddenServer = Fastify();
    registerContentPageRoutes(forbiddenServer, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ContentPageService(repository)
    });

    const forbiddenResponse = await forbiddenServer.inject({
      method: "GET",
      url: "/admin/pages"
    });
    expect(forbiddenResponse.statusCode).toBe(403);
    expect(forbiddenResponse.json()).toEqual({
      ok: false,
      reason: "content_page_admin_forbidden"
    });
    await forbiddenServer.close();
  });

  it("maps create, preview, publish, unpublish, and public read responses", async () => {
    const repository = new FakeContentPageRepository();
    const server = Fastify();
    registerContentPageRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ContentPageService(repository)
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/admin/pages",
      payload: {
        title: "Campaign",
        path: "/campaign",
        seoTitle: "Campaign page",
        seoDescription: "A temporary campaign page.",
        body: "# Campaign\n\nDraft body."
      }
    });
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({
      ok: true,
      page: {
        normalizedPath: "/campaign",
        status: "draft"
      }
    });

    const pageId = createResponse.json<{ ok: true; page: ContentPageSource }>().page.id;
    const previewResponse = await server.inject({
      method: "GET",
      url: `/admin/pages/${pageId}/preview`
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json()).toMatchObject({
      ok: true,
      page: {
        id: pageId,
        body: "# Campaign\n\nDraft body."
      }
    });

    const hiddenPublicResponse = await server.inject({
      method: "GET",
      url: "/pages/public?path=%2Fcampaign"
    });
    expect(hiddenPublicResponse.statusCode).toBe(404);

    const publishResponse = await server.inject({
      method: "POST",
      url: `/admin/pages/${pageId}/publish`
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json()).toMatchObject({
      ok: true,
      page: {
        status: "published",
        visibility: "public"
      }
    });

    const publicResponse = await server.inject({
      method: "GET",
      url: "/pages/public?path=%2Fcampaign"
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json()).toMatchObject({
      ok: true,
      page: {
        path: "/campaign",
        title: "Campaign"
      }
    });

    const unpublishResponse = await server.inject({
      method: "POST",
      url: `/admin/pages/${pageId}/unpublish`
    });
    expect(unpublishResponse.statusCode).toBe(200);
    expect(unpublishResponse.json()).toMatchObject({
      ok: true,
      page: {
        status: "draft",
        visibility: "hidden"
      }
    });

    await server.close();
  });

  it("returns 400 for invalid admin payloads and 409 for path conflicts", async () => {
    const repository = new FakeContentPageRepository();
    repository.pages.set("existing", createPage("existing", {
      normalizedPath: "/existing"
    }));
    const server = Fastify();
    registerContentPageRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new ContentPageService(repository)
    });

    const invalidResponse = await server.inject({
      method: "POST",
      url: "/admin/pages",
      payload: {
        title: "Admin",
        path: "/admin/custom",
        body: "No."
      }
    });
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json()).toEqual({
      ok: false,
      reason: "content_page_reserved_path"
    });

    const conflictResponse = await server.inject({
      method: "POST",
      url: "/admin/pages",
      payload: {
        title: "Existing",
        path: "/existing",
        body: "No."
      }
    });
    expect(conflictResponse.statusCode).toBe(409);
    expect(conflictResponse.json()).toEqual({
      ok: false,
      reason: "content_page_path_conflict"
    });

    await server.close();
  });
});
