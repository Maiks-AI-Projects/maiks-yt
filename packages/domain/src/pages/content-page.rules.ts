import type {
  ContentPageAdminInput,
  ContentPagePathValidationResult,
  ContentPageSource,
  PageCreatorCapability,
  PublicContentPage
} from "./content-page.types.js";

export const contentPageTitleMaxLength = 191;
export const contentPagePathMaxLength = 191;
export const contentPageSeoTitleMaxLength = 191;
export const contentPageSeoDescriptionMaxLength = 320;
export const contentPageBodyMaxLength = 50_000;

const contentPageSegmentPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;

const reservedExactPaths = new Set([
  "/",
  "/feed.xml",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/notification-service-worker.js",
  "/robots.txt",
  "/sitemap.xml"
]);

const reservedPathPrefixes = [
  "/_next",
  "/account",
  "/accountability",
  "/admin",
  "/affiliates",
  "/api",
  "/auth",
  "/context",
  "/dev",
  "/gemini-lab",
  "/icons",
  "/links",
  "/oauth",
  "/overlay",
  "/privacy",
  "/projects",
  "/schedule",
  "/static",
  "/tools",
  "/updates"
] as const;

export const canManageContentPages = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is PageCreatorCapability =>
    capability === "*" || capability === "page-creator:manage"
  );

export const normalizeContentPagePath = (rawPath: string): ContentPagePathValidationResult => {
  const trimmedPath = rawPath.trim();

  if (trimmedPath.length === 0) {
    return {
      ok: false,
      reason: "empty_path"
    };
  }

  if (/[?#\\\s]/.test(trimmedPath)) {
    return {
      ok: false,
      reason: "malformed_path"
    };
  }

  const withLeadingSlash = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  const withoutTrailingSlash = withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
  const normalizedPath = withoutTrailingSlash.toLowerCase();

  if (normalizedPath.length > contentPagePathMaxLength) {
    return {
      ok: false,
      reason: "path_too_long"
    };
  }

  if (
    normalizedPath.includes("//")
    || normalizedPath.includes("/./")
    || normalizedPath.includes("/../")
    || normalizedPath === "/."
    || normalizedPath === "/.."
  ) {
    return {
      ok: false,
      reason: "malformed_path"
    };
  }

  const segments = normalizedPath.slice(1).split("/");

  if (segments.length === 0 || segments.some((segment) => !contentPageSegmentPattern.test(segment))) {
    return {
      ok: false,
      reason: "malformed_path"
    };
  }

  if (isReservedContentPagePath(normalizedPath)) {
    return {
      ok: false,
      reason: "reserved_path"
    };
  }

  return {
    ok: true,
    path: normalizedPath
  };
};

export const isReservedContentPagePath = (normalizedPath: string): boolean => {
  if (reservedExactPaths.has(normalizedPath)) {
    return true;
  }

  return reservedPathPrefixes.some((prefix) =>
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
};

const isValidRequiredText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined
  || value === null
  || (typeof value === "string" && value.trim().length <= maxLength);

export const isValidContentPageAdminInput = (input: ContentPageAdminInput): boolean =>
  isValidRequiredText(input.title, contentPageTitleMaxLength)
  && normalizeContentPagePath(input.path).ok
  && isValidOptionalText(input.seoTitle, contentPageSeoTitleMaxLength)
  && isValidOptionalText(input.seoDescription, contentPageSeoDescriptionMaxLength)
  && isValidRequiredText(input.body, contentPageBodyMaxLength);

export const canPublishContentPage = (page: ContentPageSource): boolean =>
  page.status === "published"
  && page.visibility === "public"
  && page.publishedAt !== null
  && !isReservedContentPagePath(page.normalizedPath)
  && isValidRequiredText(page.title, contentPageTitleMaxLength)
  && isValidRequiredText(page.body, contentPageBodyMaxLength);

export const buildPublicContentPage = (page: ContentPageSource): PublicContentPage | null => {
  if (!canPublishContentPage(page)) {
    return null;
  }

  const publishedAt = page.publishedAt;

  if (!publishedAt) {
    return null;
  }

  return {
    id: page.id,
    title: page.title,
    path: page.normalizedPath,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    body: page.body,
    publishedAt,
    updatedAt: page.updatedAt
  };
};
