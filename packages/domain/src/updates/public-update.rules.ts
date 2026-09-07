import type {
  PublicUpdateDetail,
  PublicUpdateSource,
  PublicUpdateSummary
} from "./public-update.types.js";

const publicUpdateSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;

export const isValidPublicUpdateSlug = (slug: string): boolean =>
  publicUpdateSlugPattern.test(slug);

export const buildPublicUpdateDetail = (
  update: PublicUpdateSource
): PublicUpdateDetail | null => {
  if (
    update.status !== "published"
    || update.visibility !== "public"
    || !update.publishedAt
    || !isValidPublicUpdateSlug(update.slug)
  ) {
    return null;
  }

  return {
    slug: update.slug,
    title: update.title,
    summary: update.summary,
    body: update.body,
    kind: update.kind,
    publishedAt: update.publishedAt,
    isPinned: update.isPinned,
    updatedAt: update.updatedAt
  };
};

export const buildPublicUpdateSummary = (
  update: PublicUpdateSource
): PublicUpdateSummary | null => {
  const detail = buildPublicUpdateDetail(update);

  if (!detail) {
    return null;
  }

  const { body: _body, ...summary } = detail;
  return summary;
};

export const buildPublicUpdateSummaryList = (
  updates: readonly PublicUpdateSource[]
): readonly PublicUpdateSummary[] =>
  updates
    .map(buildPublicUpdateSummary)
    .filter((update): update is PublicUpdateSummary => update !== null)
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      return right.publishedAt.localeCompare(left.publishedAt)
        || left.title.localeCompare(right.title);
    });
