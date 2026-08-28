import {
  publicUpdateKinds,
  type PublicUpdateKind,
  type PublicUpdateSummary
} from "@maiks-yt/domain/updates";

import type { PublicUpdateListLoadResult } from "../updates/public-update-data";

export type HomeUpdateSlot =
  | {
    status: "available";
    slug: string;
    title: string;
    summary: string;
  }
  | {
    status: "empty" | "unavailable";
  };

const updateTitleMaxLength = 96;
const updateSummaryMaxLength = 180;
const updateSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;

const updateKindSet = new Set<PublicUpdateKind>(publicUpdateKinds);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNormalizedUpdateSlug = (value: unknown): value is string =>
  typeof value === "string" && updateSlugPattern.test(value);

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(new Date(value).getTime());

const isPublicUpdateKind = (value: unknown): value is PublicUpdateKind =>
  typeof value === "string" && updateKindSet.has(value as PublicUpdateKind);

const isPublicUpdateSummary = (update: unknown): update is PublicUpdateSummary =>
  isRecord(update)
  && isNormalizedUpdateSlug(update.slug)
  && isNonEmptyString(update.title)
  && isNonEmptyString(update.summary)
  && isPublicUpdateKind(update.kind)
  && typeof update.isPinned === "boolean"
  && isValidDateString(update.publishedAt)
  && isValidDateString(update.updatedAt);

const boundText = (value: string, maxLength: number): string =>
  value.trim().slice(0, maxLength).trimEnd();

export const getHomeUpdateSlot = (
  result: PublicUpdateListLoadResult
): HomeUpdateSlot => {
  if (result.status === "error") {
    return { status: "unavailable" };
  }

  if (!Array.isArray(result.updates)) {
    return { status: "unavailable" };
  }

  if (result.updates.length === 0) {
    return { status: "empty" };
  }

  for (const update of result.updates) {
    if (!isPublicUpdateSummary(update)) {
      return { status: "unavailable" };
    }
  }

  const [update] = result.updates;

  if (!update) {
    return { status: "empty" };
  }

  return {
    status: "available",
    slug: update.slug,
    title: boundText(update.title, updateTitleMaxLength),
    summary: boundText(update.summary, updateSummaryMaxLength)
  };
};
