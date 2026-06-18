import type {
  CreatorLinkAvailability,
  CreatorLinkSource,
  PublicCreatorLink
} from "./creator-link.types.js";

export type CreatorLinkInvariantIssue =
  | "available_link_requires_href"
  | "unavailable_link_requires_availability_note";

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, "en", { sensitivity: "base" });

const compareCreatorLinks = (
  left: CreatorLinkSource,
  right: CreatorLinkSource
): number =>
  left.sortOrder - right.sortOrder
  || compareText(left.title, right.title)
  || compareText(left.key, right.key);

export const validateCreatorLinkAvailability = ({
  availability,
  availabilityNote,
  href
}: {
  availability: CreatorLinkAvailability;
  href?: string | null;
  availabilityNote?: string | null;
}): readonly CreatorLinkInvariantIssue[] => {
  const issues: CreatorLinkInvariantIssue[] = [];

  if (availability === "available" && !href?.trim()) {
    issues.push("available_link_requires_href");
  }

  if (availability === "unavailable" && !availabilityNote?.trim()) {
    issues.push("unavailable_link_requires_availability_note");
  }

  return issues;
};

export const isPublishableCreatorLinkSource = (link: CreatorLinkSource): boolean =>
  link.isPublished && validateCreatorLinkAvailability(link).length === 0;

export const buildPublicCreatorLink = (
  link: CreatorLinkSource
): PublicCreatorLink | null => {
  if (!isPublishableCreatorLinkSource(link)) {
    return null;
  }

  const base = {
    key: link.key,
    title: link.title,
    description: link.description,
    purpose: link.purpose,
    icon: link.icon,
    isPrimary: link.isPrimary,
    sortOrder: link.sortOrder
  };

  if (link.availability === "available") {
    return {
      ...base,
      availability: "available",
      href: link.href!.trim()
    };
  }

  return {
    ...base,
    availability: "unavailable",
    availabilityNote: link.availabilityNote!.trim()
  };
};

export const buildPublicCreatorLinkList = (
  links: readonly CreatorLinkSource[]
): readonly PublicCreatorLink[] =>
  links
    .filter(isPublishableCreatorLinkSource)
    .slice()
    .sort(compareCreatorLinks)
    .map(buildPublicCreatorLink)
    .filter((link): link is PublicCreatorLink => link !== null);
