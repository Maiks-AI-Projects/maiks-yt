import {
  buildPublicUpdateDetail,
  isValidPublicUpdateSlug
} from "./public-update.rules.js";
import { publicUpdateKinds } from "./public-update.types.js";
import type {
  PublicUpdateAdminCapability,
  PublicUpdateAdminInput,
  PublicUpdateAdminValidationResult
} from "./public-update-admin.types.js";
import type {
  PublicUpdateDetail,
  PublicUpdateSource
} from "./public-update.types.js";

export const publicUpdateTitleMaxLength = 191;
export const publicUpdateSummaryMaxLength = 500;
export const publicUpdateBodyMaxLength = 50_000;

export const canManagePublicUpdates = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is PublicUpdateAdminCapability =>
    capability === "*" || capability === "updates:manage"
  );

export const normalizePublicUpdateAdminInput = (
  input: PublicUpdateAdminInput
): PublicUpdateAdminValidationResult => {
  const update: PublicUpdateAdminInput = {
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    body: input.body.trim(),
    kind: input.kind,
    isPinned: input.isPinned
  };

  if (
    !isValidPublicUpdateSlug(update.slug)
    || update.title.length === 0
    || update.title.length > publicUpdateTitleMaxLength
    || update.summary.length === 0
    || update.summary.length > publicUpdateSummaryMaxLength
    || update.body.length === 0
    || update.body.length > publicUpdateBodyMaxLength
    || !publicUpdateKinds.includes(update.kind)
  ) {
    return { ok: false, reason: "public_update_invalid_input" };
  }

  return { ok: true, update };
};

export const buildPublicUpdateAdminPreview = (
  update: PublicUpdateSource
): PublicUpdateDetail | null =>
  buildPublicUpdateDetail({
    ...update,
    status: "published",
    visibility: "public",
    publishedAt: update.publishedAt ?? update.updatedAt
  });
