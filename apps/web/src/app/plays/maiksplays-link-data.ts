import type { AvailableCreatorLink, PublicCreatorLink } from "@maiks-yt/domain";

import type { CreatorLinksLoadResult } from "../links/creator-links-data";

export type MaiksPlaysLink = {
  title: string;
  description: string;
  href: string;
};

export type MaiksPlaysLinkSlot =
  | { status: "available"; links: readonly MaiksPlaysLink[] }
  | { status: "unavailable" };

const verifiedMaiksPlaysHrefs = new Set([
  "https://www.twitch.tv/maiksplays",
  "https://www.youtube.com/@maiksplays"
]);

const maxTitleLength = 96;
const maxDescriptionLength = 220;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeVerifiedHref = (href: string): string | null => {
  try {
    const url = new URL(href.trim());

    if (url.protocol !== "https:") {
      return null;
    }

    if (url.hash || url.search || url.username || url.password) {
      return null;
    }

    const normalized = url.toString().replace(/\/$/, "").toLowerCase();

    return verifiedMaiksPlaysHrefs.has(normalized) ? normalized : null;
  } catch {
    return null;
  }
};

const toBoundedString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
};

const isAvailableCreatorLink = (link: Record<string, unknown>): link is AvailableCreatorLink =>
  link.availability === "available" && typeof link.href === "string";

const projectMaiksPlaysLink = (link: PublicCreatorLink): MaiksPlaysLink | null => {
  if (!isRecord(link) || !isAvailableCreatorLink(link)) {
    return null;
  }

  const normalizedHref = normalizeVerifiedHref(link.href);

  if (!normalizedHref) {
    return null;
  }

  const title = toBoundedString(link.title, maxTitleLength);
  const description = toBoundedString(link.description, maxDescriptionLength);

  if (!title || !description) {
    return null;
  }

  return {
    title,
    description,
    href: link.href.trim()
  };
};

export const getMaiksPlaysLinkSlot = (
  result: CreatorLinksLoadResult
): MaiksPlaysLinkSlot => {
  if (result.status !== "loaded" || !Array.isArray(result.links)) {
    return { status: "unavailable" };
  }

  const links: MaiksPlaysLink[] = [];
  const seenHrefs = new Set<string>();

  for (const link of result.links) {
    if (!isRecord(link)) {
      continue;
    }

    const href = typeof link.href === "string" ? normalizeVerifiedHref(link.href) : null;

    if (!href || link.availability !== "available") {
      continue;
    }

    const projected = projectMaiksPlaysLink(link as PublicCreatorLink);

    if (!projected) {
      return { status: "unavailable" };
    }

    if (!seenHrefs.has(href)) {
      seenHrefs.add(href);
      links.push(projected);
    }
  }

  return links.length > 0
    ? { status: "available", links }
    : { status: "unavailable" };
};
