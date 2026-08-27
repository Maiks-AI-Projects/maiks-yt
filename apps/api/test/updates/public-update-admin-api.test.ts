import type {
  PublicUpdateAdminInput,
  PublicUpdateAdminUpdateInput,
  PublicUpdateSource
} from "@maiks-yt/domain/updates";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerPublicUpdateAdminRoutes } from "../../src/updates/public-update-admin.route.js";
import { PublicUpdateAdminService } from "../../src/updates/public-update-admin.service.js";
import { createPublicUpdateAdminRepository } from "../../src/updates/public-update-admin-store.service.js";
import type {
  PublicUpdateAdminActor,
  PublicUpdateAdminRepository
} from "../../src/updates/public-update-admin.types.js";
import { registerPublicUpdateReadRoutes } from "../../src/updates/public-update-read.route.js";
import { PublicUpdateReadService } from "../../src/updates/public-update-read.service.js";
import type { PublicUpdateReadRepository } from "../../src/updates/public-update-read.types.js";

const createSource = (
  id: string,
  overrides: Partial<PublicUpdateSource> = {}
): PublicUpdateSource => ({
  id,
  slug: id,
  title: `Update ${id}`,
  summary: `Summary ${id}`,
  body: `Body ${id}`,
  kind: "post",
  status: "draft",
  visibility: "hidden",
  publishedAt: null,
  isPinned: false,
  isExample: false,
  updatedAt: "2026-08-27T12:00:00.000Z",
  ...overrides
});

class FakePublicUpdateRepository implements PublicUpdateAdminRepository, PublicUpdateReadRepository {
  public actor: PublicUpdateAdminActor | null = {
    domainUserId: "domain-owner",
    rolePermissionValues: [["*"]]
  };
  public updates: PublicUpdateSource[] = [];
  public publishCalls = 0;
  public unpublishCalls = 0;

  public async resolveActor(): Promise<PublicUpdateAdminActor | null> {
    return structuredClone(this.actor);
  }

  public async listUpdates(): Promise<readonly PublicUpdateSource[]> {
    return structuredClone(this.updates);
  }

  public async getUpdate(id: string): Promise<PublicUpdateSource | null> {
    return structuredClone(this.updates.find((update) => update.id === id) ?? null);
  }

  public async findUpdateBySlug(slug: string): Promise<PublicUpdateSource | null> {
    return structuredClone(this.updates.find((update) => update.slug === slug) ?? null);
  }

  public async createUpdate(input: PublicUpdateAdminInput & {
    actorUserId: string;
  }): Promise<PublicUpdateSource | "slug-conflict"> {
    if (this.updates.some((update) => update.slug === input.slug)) {
      return "slug-conflict";
    }

    const { actorUserId: _actorUserId, ...updateInput } = input;
    const update = createSource(`update-${this.updates.length + 1}`, updateInput);
    this.updates.push(update);
    return structuredClone(update);
  }

  public async updateUpdate(id: string, input: PublicUpdateAdminUpdateInput & {
    actorUserId: string;
  }): Promise<PublicUpdateSource | "not-found" | "slug-conflict"> {
    const index = this.updates.findIndex((update) => update.id === id);

    if (index < 0) {
      return "not-found";
    }

    if (input.slug && this.updates.some((update, candidateIndex) => candidateIndex !== index && update.slug === input.slug)) {
      return "slug-conflict";
    }

    const existing = this.updates[index]!;
    const { actorUserId: _actorUserId, ...updateInput } = input;
    const update = {
      ...existing,
      ...updateInput,
      id: existing.id,
      updatedAt: "2026-08-27T13:00:00.000Z"
    };
    this.updates[index] = update;
    return structuredClone(update);
  }

  public async publishUpdate(id: string): Promise<PublicUpdateSource | "not-found"> {
    this.publishCalls += 1;
    return this.setPublicationState(id, true);
  }

  public async unpublishUpdate(id: string): Promise<PublicUpdateSource | "not-found"> {
    this.unpublishCalls += 1;
    return this.setPublicationState(id, false);
  }

  private setPublicationState(id: string, published: boolean): PublicUpdateSource | "not-found" {
    const index = this.updates.findIndex((update) => update.id === id);

    if (index < 0) {
      return "not-found";
    }

    const existing = this.updates[index]!;
    const update: PublicUpdateSource = {
      ...existing,
      status: published ? "published" : "draft",
      visibility: published ? "public" : "hidden",
      publishedAt: published ? existing.publishedAt ?? "2026-08-27T13:00:00.000Z" : null,
      updatedAt: "2026-08-27T13:00:00.000Z"
    };
    this.updates[index] = update;
    return structuredClone(update);
  }
}

const createServer = ({
  authenticated = true,
  repository = new FakePublicUpdateRepository()
}: {
  authenticated?: boolean;
  repository?: FakePublicUpdateRepository;
} = {}) => {
  const server = Fastify();
  const adminService = new PublicUpdateAdminService(repository);

  registerPublicUpdateAdminRoutes(server, {
    getAuthSession: async () => authenticated ? { user: { id: "auth-owner" } } : null,
    getDatabasePool: () => {
      throw new Error("pool should not be used");
    },
    createService: () => adminService
  });
  registerPublicUpdateReadRoutes(server, {
    getDatabasePool: () => {
      throw new Error("pool should not be used");
    },
    createService: () => new PublicUpdateReadService(repository),
    getNodeEnv: () => "production"
  });

  return { repository, server };
};

describe("public update admin API", () => {
  it("requires a session and update-management permission", async () => {
    const unauthenticated = createServer({ authenticated: false });
    const unauthenticatedResponse = await unauthenticated.server.inject({
      method: "GET",
      url: "/admin/updates"
    });
    expect(unauthenticatedResponse.statusCode).toBe(401);
    await unauthenticated.server.close();

    const forbiddenRepository = new FakePublicUpdateRepository();
    forbiddenRepository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["page-creator:manage"]]
    };
    const forbidden = createServer({ repository: forbiddenRepository });
    const forbiddenResponse = await forbidden.server.inject({
      method: "GET",
      url: "/admin/updates"
    });
    expect(forbiddenResponse.statusCode).toBe(403);
    expect(forbiddenResponse.json()).toEqual({
      ok: false,
      reason: "public_update_admin_forbidden"
    });
    await forbidden.server.close();
  });

  it("supports the saved draft, preview, publish, and unpublish lifecycle", async () => {
    const { repository, server } = createServer();
    const createResponse = await server.inject({
      method: "POST",
      url: "/admin/updates",
      payload: {
        slug: " launch-note ",
        title: " Launch note ",
        summary: " What changed ",
        body: " Full details ",
        kind: "announcement",
        isPinned: true
      }
    });
    const created = createResponse.json().update as PublicUpdateSource;

    expect(createResponse.statusCode).toBe(200);
    expect(created).toMatchObject({
      slug: "launch-note",
      title: "Launch note",
      status: "draft",
      visibility: "hidden",
      isExample: false
    });
    expect(createResponse.body).not.toContain("domain-owner");

    const hiddenResponse = await server.inject({ method: "GET", url: "/updates/launch-note" });
    const previewResponse = await server.inject({
      method: "GET",
      url: `/admin/updates/${created.id}/preview`
    });
    expect(hiddenResponse.statusCode).toBe(404);
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json()).toMatchObject({
      ok: true,
      update: { slug: "launch-note", body: "Full details" }
    });

    const editResponse = await server.inject({
      method: "PATCH",
      url: `/admin/updates/${created.id}`,
      payload: { title: "Launch note revised" }
    });
    expect(editResponse.statusCode).toBe(200);
    expect(editResponse.json()).toMatchObject({
      ok: true,
      update: { title: "Launch note revised", isPinned: true }
    });

    const publishResponse = await server.inject({
      method: "POST",
      url: `/admin/updates/${created.id}/publish`
    });
    const publicResponse = await server.inject({ method: "GET", url: "/updates/launch-note" });
    const repeatedPublishResponse = await server.inject({
      method: "POST",
      url: `/admin/updates/${created.id}/publish`
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publicResponse.statusCode).toBe(200);
    expect(repeatedPublishResponse.statusCode).toBe(200);
    expect(repository.publishCalls).toBe(1);

    const unpublishResponse = await server.inject({
      method: "POST",
      url: `/admin/updates/${created.id}/unpublish`
    });
    const hiddenAgainResponse = await server.inject({ method: "GET", url: "/updates/launch-note" });
    const repeatedUnpublishResponse = await server.inject({
      method: "POST",
      url: `/admin/updates/${created.id}/unpublish`
    });
    expect(unpublishResponse.statusCode).toBe(200);
    expect(hiddenAgainResponse.statusCode).toBe(404);
    expect(repeatedUnpublishResponse.statusCode).toBe(200);
    expect(repository.unpublishCalls).toBe(1);

    await server.close();
  });

  it("supports delegated management and protects example provenance", async () => {
    const repository = new FakePublicUpdateRepository();
    repository.actor = {
      domainUserId: "domain-editor",
      rolePermissionValues: [JSON.stringify(["updates:manage"])]
    };
    repository.updates.push(createSource("example", {
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-27T12:00:00.000Z",
      isExample: true
    }));
    const { server } = createServer({ repository });

    const listResponse = await server.inject({ method: "GET", url: "/admin/updates" });
    const editResponse = await server.inject({
      method: "PATCH",
      url: "/admin/updates/example",
      payload: { title: "Pretend this is real" }
    });
    const publishResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/example/publish"
    });
    const unpublishResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/example/unpublish"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(editResponse.statusCode).toBe(409);
    expect(editResponse.json()).toEqual({ ok: false, reason: "public_update_example_immutable" });
    expect(publishResponse.statusCode).toBe(409);
    expect(unpublishResponse.statusCode).toBe(200);
    expect(unpublishResponse.json()).toMatchObject({
      ok: true,
      update: { isExample: true, status: "draft", visibility: "hidden" }
    });

    await server.close();
  });

  it("requires unpublish before editing a published update", async () => {
    const repository = new FakePublicUpdateRepository();
    repository.updates.push(createSource("live-update", {
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-27T12:00:00.000Z"
    }));
    const { server } = createServer({ repository });

    const response = await server.inject({
      method: "PATCH",
      url: "/admin/updates/live-update",
      payload: { title: "Changed live" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ ok: false, reason: "public_update_must_be_draft" });
    expect(repository.updates[0]?.title).toBe("Update live-update");
    await server.close();
  });

  it("loads only active delegated grants from the production repository", async () => {
    const execute = vi.fn().mockResolvedValue([[
      { domainUserId: "domain-editor", rolePermissions: JSON.stringify(["updates:manage"]) }
    ], []]);
    const repository = createPublicUpdateAdminRepository({ execute } as never);

    await expect(repository.resolveActor("auth-editor")).resolves.toMatchObject({
      domainUserId: "domain-editor"
    });
    const actorQuery = String(execute.mock.calls[0]?.[0]);
    expect(actorQuery).toContain("user_roles.revoked_at IS NULL");
    expect(actorQuery).toContain("user_roles.expires_at IS NULL OR user_roles.expires_at > NOW()");
  });

  it("treats a concurrent repository publish as an idempotent success", async () => {
    const publishedRow = {
      id: "concurrent-update",
      slug: "concurrent-update",
      title: "Concurrent update",
      summary: "Summary",
      body: "Body",
      kind: "post",
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-27T13:00:00.000Z",
      isPinned: 0,
      isExample: 0,
      updatedAt: "2026-08-27T13:00:00.000Z"
    };
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce([[publishedRow], []]);
    const repository = createPublicUpdateAdminRepository({ execute } as never);

    await expect(repository.publishUpdate("concurrent-update", "domain-editor"))
      .resolves.toMatchObject({
        id: "concurrent-update",
        status: "published",
        visibility: "public"
      });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
