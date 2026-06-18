import {
  validateCreatorLinkAvailability,
  type CreatorLinkSource
} from "@maiks-yt/domain";

import type {
  CreatorLinkAdminInput,
  CreatorLinkAdminListResult,
  CreatorLinkAdminMutationResult,
  CreatorLinkAdminReorderInput,
  CreatorLinkAdminReorderResult,
  CreatorLinkAdminUpdateInput,
  CreatorLinkAdminRepository
} from "./creator-link-admin.types.js";

const creatorLinkKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

const canManageCreatorLinks = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability) => capability === "*" || capability === "creator-links:manage");

const isValidRequiredText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined
    || value === null
    || (typeof value === "string" && value.trim().length <= maxLength);

const isValidCreatorLinkAdminInput = (input: CreatorLinkAdminInput): boolean =>
  creatorLinkKeyPattern.test(input.key)
  && isValidRequiredText(input.title, 191)
  && isValidRequiredText(input.description, 2_000)
  && isValidOptionalText(input.href, 1_024)
  && isValidOptionalText(input.availabilityNote, 191)
  && Number.isInteger(input.sortOrder)
  && input.sortOrder >= 0
  && validateCreatorLinkAvailability({
    availability: input.availability,
    href: input.href ?? null,
    availabilityNote: input.availabilityNote ?? null
  }).length === 0
  && ((input.key !== "support" && input.purpose !== "support") || input.availability === "unavailable");

const isSupportRowStillProtected = (
  existing: CreatorLinkSource,
  next: CreatorLinkAdminInput
): boolean =>
  existing.key !== "support"
  || (
    next.key === "support"
    && next.purpose === "support"
    && next.icon === "support"
    && next.availability === "unavailable"
    && next.href === null
    && next.availabilityNote === "Support link not available"
  );

const isValidCreatorLinkAdminReorderInput = (input: CreatorLinkAdminReorderInput): boolean =>
  input.orderedKeys.length > 0
  && input.orderedKeys.every((key) => typeof key === "string" && creatorLinkKeyPattern.test(key))
  && new Set(input.orderedKeys).size === input.orderedKeys.length;

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

export const normalizeCreatorLinkAdminPermissions = (
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

const normalizeLinkInput = (input: CreatorLinkAdminInput): CreatorLinkAdminInput => ({
  ...input,
  key: input.key.trim(),
  title: input.title.trim(),
  description: input.description.trim(),
  href: input.availability === "available" ? input.href?.trim() ?? "" : null,
  availabilityNote: input.availability === "unavailable" ? input.availabilityNote?.trim() ?? "" : null
});

const toAdminInput = (link: CreatorLinkSource): CreatorLinkAdminInput => ({
  key: link.key,
  title: link.title,
  description: link.description,
  purpose: link.purpose,
  icon: link.icon,
  availability: link.availability,
  href: link.href ?? null,
  availabilityNote: link.availabilityNote ?? null,
  isPrimary: link.isPrimary,
  sortOrder: link.sortOrder,
  isPublished: link.isPublished
});

const mergeDefinedLinkUpdate = (
  existing: CreatorLinkAdminInput,
  update: CreatorLinkAdminUpdateInput
): CreatorLinkAdminInput => {
  const next = { ...existing };

  for (const [key, value] of Object.entries(update) as Array<[keyof CreatorLinkAdminUpdateInput, CreatorLinkAdminUpdateInput[keyof CreatorLinkAdminUpdateInput]]>) {
    if (value !== undefined) {
      Object.assign(next, { [key]: value });
    }
  }

  return next;
};

export class CreatorLinkAdminService {
  public constructor(private readonly repository: CreatorLinkAdminRepository) {}

  public async listLinks(input: { authUserId: string }): Promise<CreatorLinkAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      links: await this.repository.listLinks()
    };
  }

  public async createLink(input: {
    authUserId: string;
    link: CreatorLinkAdminInput;
  }): Promise<CreatorLinkAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const link = normalizeLinkInput(input.link);

    if (!isValidCreatorLinkAdminInput(link)) {
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    try {
      return {
        ok: true,
        link: await this.repository.createLink(link)
      };
    } catch (error) {
      if (error instanceof Error && error.message === "creator_link_key_conflict") {
        return {
          ok: false,
          reason: "creator_link_key_conflict"
        };
      }

      throw error;
    }
  }

  public async updateLink(input: {
    authUserId: string;
    key: string;
    link: CreatorLinkAdminUpdateInput;
  }): Promise<CreatorLinkAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (Object.keys(input.link).length === 0) {
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    const existing = (await this.repository.listLinks()).find((link) => link.key === input.key);

    if (!existing) {
      return {
        ok: false,
        reason: "creator_link_not_found"
      };
    }

    const next = normalizeLinkInput(mergeDefinedLinkUpdate(toAdminInput(existing), input.link));

    if (!isValidCreatorLinkAdminInput(next) || !isSupportRowStillProtected(existing, next)) {
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    const result = await this.repository.updateLink(input.key, next);

    if (result === "not-found") {
      return {
        ok: false,
        reason: "creator_link_not_found"
      };
    }

    if (result === "key-conflict") {
      return {
        ok: false,
        reason: "creator_link_key_conflict"
      };
    }

    return {
      ok: true,
      link: result
    };
  }

  public async reorderLinks(input: {
    authUserId: string;
    reorder: CreatorLinkAdminReorderInput;
  }): Promise<CreatorLinkAdminReorderResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!isValidCreatorLinkAdminReorderInput(input.reorder)) {
      return {
        ok: false,
        reason: "creator_link_admin_invalid_input"
      };
    }

    const result = await this.repository.reorderLinks(input.reorder);

    if (result === "not-found") {
      return {
        ok: false,
        reason: "creator_link_not_found"
      };
    }

    return {
      ok: true,
      links: result
    };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "creator_link_admin_user_unlinked" | "creator_link_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "creator_link_admin_user_unlinked"
      };
    }

    if (!canManageCreatorLinks(normalizeCreatorLinkAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "creator_link_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}
