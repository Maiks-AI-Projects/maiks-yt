import {
  buildPublicUpdateAdminPreview,
  canManagePublicUpdates,
  normalizePublicUpdateAdminInput
} from "@maiks-yt/domain/updates";
import type {
  PublicUpdateAdminInput,
  PublicUpdateAdminUpdateInput
} from "@maiks-yt/domain/updates";

import {
  createPublicUpdateAdminRevision,
  type PublicUpdateAdminRevision
} from "./public-update-admin-revision.service.js";

import type {
  PublicUpdateAdminListResult,
  PublicUpdateAdminMutationResult,
  PublicUpdateAdminPreviewResult,
  PublicUpdateAdminRepository
} from "./public-update-admin.types.js";

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

const normalizePermissions = (values: readonly unknown[]): string[] => {
  const permissions = new Set<string>();

  for (const value of values) {
    for (const permission of parsePermissionArray(value)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const mergeDefinedUpdate = (
  existing: PublicUpdateAdminInput,
  update: PublicUpdateAdminUpdateInput
): PublicUpdateAdminInput => {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(update) as Array<[
    keyof PublicUpdateAdminUpdateInput,
    PublicUpdateAdminUpdateInput[keyof PublicUpdateAdminUpdateInput]
  ]>) {
    if (value !== undefined) {
      Object.assign(merged, { [key]: value });
    }
  }

  return merged;
};

export class PublicUpdateAdminService {
  public constructor(private readonly repository: PublicUpdateAdminRepository) {}

  public async listUpdates(input: { authUserId: string }): Promise<PublicUpdateAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    return actor.ok
      ? { ok: true, updates: await this.repository.listUpdates() }
      : actor;
  }

  public async createUpdate(input: {
    authUserId: string;
    update: PublicUpdateAdminInput;
  }): Promise<PublicUpdateAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const normalized = normalizePublicUpdateAdminInput(input.update);

    if (!normalized.ok) {
      return normalized;
    }

    const result = await this.repository.createUpdate({
      ...normalized.update,
      actorUserId: actor.domainUserId
    });

    return result === "slug-conflict"
      ? { ok: false, reason: "public_update_slug_conflict" }
      : { ok: true, update: result };
  }

  public async updateUpdate(input: {
    authUserId: string;
    updateId: string;
    update: PublicUpdateAdminUpdateInput;
  }): Promise<PublicUpdateAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (Object.keys(input.update).length === 0) {
      return { ok: false, reason: "public_update_invalid_input" };
    }

    const existing = await this.repository.getUpdate(input.updateId);

    if (!existing) {
      return { ok: false, reason: "public_update_not_found" };
    }

    if (existing.isExample) {
      return { ok: false, reason: "public_update_example_immutable" };
    }

    if (existing.status !== "draft" || existing.visibility !== "hidden") {
      return { ok: false, reason: "public_update_must_be_draft" };
    }

    const normalized = normalizePublicUpdateAdminInput(mergeDefinedUpdate({
      slug: existing.slug,
      title: existing.title,
      summary: existing.summary,
      body: existing.body,
      kind: existing.kind,
      isPinned: existing.isPinned
    }, input.update));

    if (!normalized.ok) {
      return normalized;
    }

    const result = await this.repository.updateUpdate(input.updateId, {
      ...input.update,
      ...(input.update.slug === undefined ? {} : { slug: normalized.update.slug }),
      ...(input.update.title === undefined ? {} : { title: normalized.update.title }),
      ...(input.update.summary === undefined ? {} : { summary: normalized.update.summary }),
      ...(input.update.body === undefined ? {} : { body: normalized.update.body }),
      actorUserId: actor.domainUserId
    });

    if (result === "not-found") {
      return { ok: false, reason: "public_update_not_found" };
    }

    if (result === "slug-conflict") {
      return { ok: false, reason: "public_update_slug_conflict" };
    }

    return { ok: true, update: result };
  }

  public async publishUpdate(input: {
    authUserId: string;
    updateId: string;
    expectedRevision: PublicUpdateAdminRevision;
  }): Promise<PublicUpdateAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const existing = await this.repository.getUpdate(input.updateId);

    if (!existing) {
      return { ok: false, reason: "public_update_not_found" };
    }

    if (
      !existing.isExample
      && existing.status === "published"
      && existing.visibility === "public"
      && existing.publishedAt !== null
    ) {
      return { ok: true, update: existing };
    }

    if (existing.isExample) {
      return { ok: false, reason: "public_update_example_immutable" };
    }

    if (createPublicUpdateAdminRevision(existing) !== input.expectedRevision) {
      return { ok: false, reason: "public_update_preview_stale" };
    }

    if (
      existing.status !== "draft"
      || existing.visibility !== "hidden"
      || existing.publishedAt !== null
    ) {
      return { ok: false, reason: "public_update_must_be_draft" };
    }

    const normalized = normalizePublicUpdateAdminInput({
      slug: existing.slug,
      title: existing.title,
      summary: existing.summary,
      body: existing.body,
      kind: existing.kind,
      isPinned: existing.isPinned
    });

    if (!normalized.ok) {
      return normalized;
    }

    const result = await this.repository.publishUpdate(
      input.updateId,
      actor.domainUserId,
      existing
    );

    if (result === "not-found") {
      return { ok: false, reason: "public_update_not_found" };
    }

    if (result === "revision-conflict") {
      return { ok: false, reason: "public_update_preview_stale" };
    }

    if (result === "state-conflict") {
      return { ok: false, reason: "public_update_must_be_draft" };
    }

    return { ok: true, update: result };
  }

  public async unpublishUpdate(input: {
    authUserId: string;
    updateId: string;
  }): Promise<PublicUpdateAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const existing = await this.repository.getUpdate(input.updateId);

    if (!existing) {
      return { ok: false, reason: "public_update_not_found" };
    }

    if (
      existing.status === "draft"
      && existing.visibility === "hidden"
      && existing.publishedAt === null
    ) {
      return { ok: true, update: existing };
    }

    const result = await this.repository.unpublishUpdate(input.updateId, actor.domainUserId);
    return result === "not-found"
      ? { ok: false, reason: "public_update_not_found" }
      : { ok: true, update: result };
  }

  public async previewUpdate(input: {
    authUserId: string;
    updateId: string;
  }): Promise<PublicUpdateAdminPreviewResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const update = await this.repository.getUpdate(input.updateId);

    if (!update) {
      return { ok: false, reason: "public_update_not_found" };
    }

    const preview = buildPublicUpdateAdminPreview(update);
    return preview
      ? {
        ok: true,
        revision: createPublicUpdateAdminRevision(update),
        update: preview
      }
      : { ok: false, reason: "public_update_invalid_input" };
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true; domainUserId: string }
    | { ok: false; reason: "public_update_admin_user_unlinked" | "public_update_admin_forbidden" }
  > {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return { ok: false, reason: "public_update_admin_user_unlinked" };
    }

    if (!canManagePublicUpdates(normalizePermissions(actor.rolePermissionValues))) {
      return { ok: false, reason: "public_update_admin_forbidden" };
    }

    return { ok: true, domainUserId: actor.domainUserId };
  }
}
