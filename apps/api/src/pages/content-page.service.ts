import {
  buildPublicContentPage,
  canManageContentPages,
  isValidContentPageAdminInput,
  normalizeContentPagePath
} from "@maiks-yt/domain/pages";
import type { ContentPageAdminInput } from "@maiks-yt/domain/pages";

import type {
  ContentPageAdminActor,
  ContentPageAdminListResult,
  ContentPageAdminMutationResult,
  ContentPagePreviewResult,
  ContentPageRepository,
  ContentPageUpdateInput,
  PublicContentPageResult
} from "./content-page.types.js";

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

export const normalizeContentPagePermissions = (
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

const normalizeOptionalText = (value: string | null | undefined): string | null | undefined =>
  value === undefined ? undefined : value?.trim() || null;

const normalizeCreateInput = (
  input: ContentPageAdminInput
): ContentPageAdminInput & { normalizedPath: string } | "invalid" | "reserved" => {
  const normalizedPath = normalizeContentPagePath(input.path);

  if (!normalizedPath.ok) {
    return normalizedPath.reason === "reserved_path" ? "reserved" : "invalid";
  }

  const page = {
    title: input.title.trim(),
    path: normalizedPath.path,
    normalizedPath: normalizedPath.path,
    seoTitle: normalizeOptionalText(input.seoTitle),
    seoDescription: normalizeOptionalText(input.seoDescription),
    body: input.body.trim()
  };

  return isValidContentPageAdminInput(page) ? page : "invalid";
};

const mergeDefinedUpdate = (
  existing: ContentPageAdminInput,
  update: ContentPageUpdateInput
): ContentPageAdminInput => {
  const next = { ...existing };

  for (const [key, value] of Object.entries(update) as Array<[keyof ContentPageUpdateInput, ContentPageUpdateInput[keyof ContentPageUpdateInput]]>) {
    if (value !== undefined) {
      Object.assign(next, { [key]: value });
    }
  }

  return next;
};

export class ContentPageService {
  public constructor(private readonly repository: ContentPageRepository) {}

  public async listPages(input: { authUserId: string }): Promise<ContentPageAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      pages: await this.repository.listPages()
    };
  }

  public async createPage(input: {
    authUserId: string;
    page: ContentPageAdminInput;
  }): Promise<ContentPageAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const page = normalizeCreateInput(input.page);

    if (page === "reserved") {
      return {
        ok: false,
        reason: "content_page_reserved_path"
      };
    }

    if (page === "invalid") {
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    try {
      return {
        ok: true,
        page: await this.repository.createPage({
          ...page,
          actorUserId: actor.domainUserId
        })
      };
    } catch (error) {
      if (error instanceof Error && error.message === "content_page_path_conflict") {
        return {
          ok: false,
          reason: "content_page_path_conflict"
        };
      }

      throw error;
    }
  }

  public async updatePage(input: {
    authUserId: string;
    pageId: string;
    page: ContentPageUpdateInput;
  }): Promise<ContentPageAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (Object.keys(input.page).length === 0) {
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    const existing = await this.repository.getPage(input.pageId);

    if (!existing) {
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    const merged = mergeDefinedUpdate({
      title: existing.title,
      path: existing.normalizedPath,
      seoTitle: existing.seoTitle,
      seoDescription: existing.seoDescription,
      body: existing.body
    }, input.page);
    const page = normalizeCreateInput(merged);

    if (page === "reserved") {
      return {
        ok: false,
        reason: "content_page_reserved_path"
      };
    }

    if (page === "invalid") {
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    const result = await this.repository.updatePage(input.pageId, {
      ...input.page,
      ...(input.page.path !== undefined ? { normalizedPath: page.normalizedPath } : {}),
      actorUserId: actor.domainUserId
    });

    if (result === "not-found") {
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    if (result === "path-conflict") {
      return {
        ok: false,
        reason: "content_page_path_conflict"
      };
    }

    return {
      ok: true,
      page: result
    };
  }

  public async publishPage(input: {
    authUserId: string;
    pageId: string;
  }): Promise<ContentPageAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const existing = await this.repository.getPage(input.pageId);

    if (!existing) {
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    const page = normalizeCreateInput({
      title: existing.title,
      path: existing.normalizedPath,
      seoTitle: existing.seoTitle,
      seoDescription: existing.seoDescription,
      body: existing.body
    });

    if (page === "reserved") {
      return {
        ok: false,
        reason: "content_page_reserved_path"
      };
    }

    if (page === "invalid") {
      return {
        ok: false,
        reason: "content_page_invalid_input"
      };
    }

    const result = await this.repository.publishPage(input.pageId, actor.domainUserId);

    if (result === "not-found") {
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    return {
      ok: true,
      page: result
    };
  }

  public async unpublishPage(input: {
    authUserId: string;
    pageId: string;
  }): Promise<ContentPageAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const result = await this.repository.unpublishPage(input.pageId, actor.domainUserId);

    if (result === "not-found") {
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    return {
      ok: true,
      page: result
    };
  }

  public async previewPage(input: {
    authUserId: string;
    pageId: string;
  }): Promise<ContentPagePreviewResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const page = await this.repository.getPage(input.pageId);

    return page
      ? {
        ok: true,
        page
      }
      : {
        ok: false,
        reason: "content_page_not_found"
      };
  }

  public async getPublicPageByPath(input: { path: string }): Promise<PublicContentPageResult> {
    const normalizedPath = normalizeContentPagePath(input.path);

    if (!normalizedPath.ok) {
      return {
        ok: false,
        reason: "content_page_not_found"
      };
    }

    const matches = await this.repository.findPublicPagesByPath(normalizedPath.path);

    if (matches.length !== 1) {
      return {
        ok: false,
        reason: matches.length > 1 ? "content_page_ambiguous" : "content_page_not_found"
      };
    }

    const publicPage = buildPublicContentPage(matches[0]!);

    return publicPage
      ? {
        ok: true,
        page: publicPage
      }
      : {
        ok: false,
        reason: "content_page_not_found"
      };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "content_page_admin_user_unlinked" | "content_page_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "content_page_admin_user_unlinked"
      };
    }

    if (!this.canManage(actor)) {
      return {
        ok: false,
        reason: "content_page_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }

  private canManage(actor: ContentPageAdminActor): boolean {
    return canManageContentPages(normalizeContentPagePermissions(actor.rolePermissionValues));
  }
}
