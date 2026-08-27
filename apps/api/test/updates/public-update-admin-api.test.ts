import type {
  PublicUpdateAdminInput,
  PublicUpdateAdminUpdateInput,
  PublicUpdateSource
} from "@maiks-yt/domain/updates";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerPublicUpdateAdminRoutes } from "../../src/updates/public-update-admin.route.js";
import { createPublicUpdateAdminRevision } from "../../src/updates/public-update-admin-revision.service.js";
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
  public preserveUpdatedAtOnSave = false;
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
      updatedAt: this.preserveUpdatedAtOnSave
        ? existing.updatedAt
        : "2026-08-27T13:00:00.000Z"
    };
    this.updates[index] = update;
    return structuredClone(update);
  }

  public async publishUpdate(
    id: string,
    _actorUserId: string,
    expectedUpdate: PublicUpdateSource
  ): Promise<PublicUpdateSource | "not-found" | "revision-conflict" | "state-conflict"> {
    this.publishCalls += 1;
    return this.setPublicationState(id, true, expectedUpdate);
  }

  public async unpublishUpdate(id: string): Promise<PublicUpdateSource | "not-found"> {
    this.unpublishCalls += 1;
    return this.setPublicationState(id, false);
  }

  private setPublicationState(id: string, published: false): PublicUpdateSource | "not-found";
  private setPublicationState(
    id: string,
    published: true,
    expectedUpdate: PublicUpdateSource
  ): PublicUpdateSource | "not-found" | "revision-conflict" | "state-conflict";
  private setPublicationState(
    id: string,
    published: boolean,
    expectedUpdate?: PublicUpdateSource
  ): PublicUpdateSource | "not-found" | "revision-conflict" | "state-conflict" {
    const index = this.updates.findIndex((update) => update.id === id);

    if (index < 0) {
      return "not-found";
    }

    const existing = this.updates[index]!;

    if (published) {
      if (
        !expectedUpdate
        || createPublicUpdateAdminRevision(existing) !== createPublicUpdateAdminRevision(expectedUpdate)
      ) {
        return "revision-conflict";
      }

      if (existing.status !== "draft" || existing.visibility !== "hidden" || existing.publishedAt !== null) {
        return existing.status === "published" && existing.visibility === "public" && existing.publishedAt !== null
          ? structuredClone(existing)
          : "state-conflict";
      }
    }

    const update: PublicUpdateSource = {
      ...existing,
      status: published ? "published" : "draft",
      visibility: published ? "public" : "hidden",
      publishedAt: published ? existing.publishedAt ?? "2026-08-27T14:00:00.000Z" : null,
      updatedAt: published ? "2026-08-27T14:00:00.000Z" : "2026-08-27T15:00:00.000Z"
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

    const revisedPreviewResponse = await server.inject({
      method: "GET",
      url: `/admin/updates/${created.id}/preview`
    });
    const revisedPreview = revisedPreviewResponse.json() as {
      revision: string;
      update: PublicUpdateSource;
    };
    expect(revisedPreview.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(revisedPreview.revision).not.toContain(revisedPreview.update.title);
    const publishResponse = await server.inject({
      method: "POST",
      url: `/admin/updates/${created.id}/publish`,
      payload: { expectedRevision: revisedPreview.revision }
    });
    const publishedUpdate = publishResponse.json().update as PublicUpdateSource;
    const publicResponse = await server.inject({ method: "GET", url: "/updates/launch-note" });
    const repeatedPublishResponse = await server.inject({
      method: "POST",
      url: `/admin/updates/${created.id}/publish`,
      payload: { expectedRevision: revisedPreview.revision }
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.body).not.toContain("\"id\"");
    expect(publicResponse.body).not.toContain("isExample");
    expect(repeatedPublishResponse.statusCode).toBe(200);
    expect(repeatedPublishResponse.json()).toMatchObject({
      ok: true,
      update: { status: "published", visibility: "public" }
    });
    expect(repeatedPublishResponse.json().update).toEqual(publishedUpdate);
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

  it("rejects a same-second content change after preview and publishes the current revision", async () => {
    const repository = new FakePublicUpdateRepository();
    repository.preserveUpdatedAtOnSave = true;
    repository.updates.push(createSource("shared-draft", {
      updatedAt: "2026-08-27T12:00:00.000Z"
    }));
    const { server } = createServer({ repository });

    const stalePreviewResponse = await server.inject({
      method: "GET",
      url: "/admin/updates/shared-draft/preview"
    });
    const stalePreview = stalePreviewResponse.json() as {
      revision: string;
      update: PublicUpdateSource;
    };

    const editorSaveResponse = await server.inject({
      method: "PATCH",
      url: "/admin/updates/shared-draft",
      payload: { title: "Editor B draft" }
    });
    const latestDraft = editorSaveResponse.json().update as PublicUpdateSource;
    const stalePublishResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/shared-draft/publish",
      payload: { expectedRevision: stalePreview.revision }
    });

    expect(editorSaveResponse.statusCode).toBe(200);
    expect(latestDraft.updatedAt).toBe(stalePreview.update.updatedAt);
    expect(stalePublishResponse.statusCode).toBe(409);
    expect(stalePublishResponse.json()).toEqual({
      ok: false,
      reason: "public_update_preview_stale"
    });
    expect(repository.updates[0]).toMatchObject({
      title: "Editor B draft",
      status: "draft",
      visibility: "hidden"
    });
    expect(repository.publishCalls).toBe(0);

    const currentPreviewResponse = await server.inject({
      method: "GET",
      url: "/admin/updates/shared-draft/preview"
    });
    const currentPreview = currentPreviewResponse.json() as {
      revision: string;
      update: PublicUpdateSource;
    };
    expect(currentPreview.revision).not.toBe(stalePreview.revision);
    const currentPublishResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/shared-draft/publish",
      payload: { expectedRevision: currentPreview.revision }
    });

    expect(currentPublishResponse.statusCode).toBe(200);
    expect(currentPublishResponse.json()).toMatchObject({
      ok: true,
      update: { title: "Editor B draft", status: "published", visibility: "public" }
    });

    await server.close();
  });

  it("rejects missing or invalid publish revisions without leaking internals", async () => {
    const repository = new FakePublicUpdateRepository();
    repository.updates.push(createSource("needs-preview"));
    const { server } = createServer({ repository });

    const missingResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/needs-preview/publish"
    });
    const invalidResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/needs-preview/publish",
      payload: { expectedRevision: "not-a-revision" }
    });
    const uppercaseResponse = await server.inject({
      method: "POST",
      url: "/admin/updates/needs-preview/publish",
      payload: { expectedRevision: "A".repeat(64) }
    });

    expect(missingResponse.statusCode).toBe(400);
    expect(missingResponse.json()).toEqual({
      ok: false,
      reason: "public_update_invalid_input"
    });
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json()).toEqual({
      ok: false,
      reason: "public_update_invalid_input"
    });
    expect(uppercaseResponse.statusCode).toBe(400);
    expect(uppercaseResponse.json()).toEqual({
      ok: false,
      reason: "public_update_invalid_input"
    });
    expect(repository.publishCalls).toBe(0);

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
      url: "/admin/updates/example/publish",
      payload: { expectedRevision: "a".repeat(64) }
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

  it("atomically rejects a repository field mismatch even when updatedAt is unchanged", async () => {
    const expectedUpdate = createSource("concurrent-update", {
      title: "Previewed title",
      summary: "Summary",
      body: "Body"
    });
    const currentDraftRow = {
      id: "concurrent-update",
      slug: "concurrent-update",
      title: "Same-second changed title",
      summary: "Summary",
      body: "Body",
      kind: "post",
      status: "draft",
      visibility: "hidden",
      publishedAt: null,
      isPinned: 0,
      isExample: 0,
      updatedAt: "2026-08-27T12:00:00.000Z"
    };
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce([[currentDraftRow], []]);
    const repository = createPublicUpdateAdminRepository({ execute } as never);

    await expect(repository.publishUpdate(
      "concurrent-update",
      "domain-editor",
      expectedUpdate
    )).resolves.toBe("revision-conflict");
    expect(execute).toHaveBeenCalledTimes(2);
    const publishQuery = String(execute.mock.calls[0]?.[0]);
    expect(publishQuery).toContain("BINARY slug = BINARY ?");
    expect(publishQuery).toContain("BINARY title = BINARY ?");
    expect(publishQuery).toContain("BINARY summary = BINARY ?");
    expect(publishQuery).toContain("BINARY body = BINARY ?");
    expect(publishQuery).toContain("BINARY kind = BINARY ?");
    expect(publishQuery).toContain("is_pinned = ?");
    expect(publishQuery).toContain("is_example = ?");
    expect(publishQuery).toContain("BINARY status = BINARY ?");
    expect(publishQuery).toContain("BINARY visibility = BINARY ?");
    expect(publishQuery).toContain("published_at <=> ?");
    expect(publishQuery).toContain("updated_at = ?");
    expect(execute.mock.calls[0]?.[1]).toEqual([
      "domain-editor",
      "concurrent-update",
      "concurrent-update",
      "Previewed title",
      "Summary",
      "Body",
      "post",
      false,
      false,
      "draft",
      "hidden",
      null,
      new Date("2026-08-27T12:00:00.000Z")
    ]);
  });
});
