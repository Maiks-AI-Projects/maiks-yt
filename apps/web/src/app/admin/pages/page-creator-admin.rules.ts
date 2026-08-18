import {
  contentPageBodyMaxLength,
  contentPagePathMaxLength,
  contentPageSeoDescriptionMaxLength,
  contentPageSeoTitleMaxLength,
  contentPageTitleMaxLength,
  normalizeContentPagePath
} from "@maiks-yt/domain/pages";
import type { ContentPageSource } from "@maiks-yt/domain/pages";

export type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";
export type WorkspaceTab = "content" | "seo" | "preview";

export type PageFormState = {
  title: string;
  path: string;
  seoTitle: string;
  seoDescription: string;
  body: string;
};

export const defaultPageForm: PageFormState = {
  title: "",
  path: "/",
  seoTitle: "",
  seoDescription: "",
  body: "# New Page\n\nDraft the page body here."
};

export const toPageForm = (page: ContentPageSource): PageFormState => ({
  title: page.title,
  path: page.normalizedPath,
  seoTitle: page.seoTitle ?? "",
  seoDescription: page.seoDescription ?? "",
  body: page.body
});

export const toPayload = (form: PageFormState): Record<string, unknown> => ({
  title: form.title.trim(),
  path: form.path.trim(),
  seoTitle: form.seoTitle.trim() || null,
  seoDescription: form.seoDescription.trim() || null,
  body: form.body.trim()
});

export const getLocalFormIssue = (form: PageFormState): string | null => {
  const title = form.title.trim();
  const body = form.body.trim();
  const seoTitle = form.seoTitle.trim();
  const seoDescription = form.seoDescription.trim();
  const path = normalizeContentPagePath(form.path);

  if (title.length === 0) {
    return "Add a page title before saving.";
  }

  if (title.length > contentPageTitleMaxLength) {
    return `Page title must be ${contentPageTitleMaxLength} characters or fewer.`;
  }

  if (!path.ok) {
    if (path.reason === "reserved_path") {
      return "That path is reserved for code-owned, admin, tool, API, overlay, dev, auth, account, or static asset routes.";
    }

    if (path.reason === "path_too_long") {
      return `Page path must be ${contentPagePathMaxLength} characters or fewer.`;
    }

    return "Use a simple path such as /channel-rules with lowercase letters, numbers, and hyphens.";
  }

  if (seoTitle.length > contentPageSeoTitleMaxLength) {
    return `SEO title must be ${contentPageSeoTitleMaxLength} characters or fewer.`;
  }

  if (seoDescription.length > contentPageSeoDescriptionMaxLength) {
    return `SEO description must be ${contentPageSeoDescriptionMaxLength} characters or fewer.`;
  }

  if (body.length === 0) {
    return "Add Markdown body content before saving.";
  }

  if (body.length > contentPageBodyMaxLength) {
    return `Markdown body must be ${contentPageBodyMaxLength} characters or fewer.`;
  }

  return null;
};

export const sortPages = (pages: readonly ContentPageSource[]): readonly ContentPageSource[] =>
  pages
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));

export const getRelativeUpdatedAt = (value: string): string => {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));

  if (elapsedMinutes < 1) {
    return "Now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }

  if (elapsedMinutes < 24 * 60) {
    return `${Math.round(elapsedMinutes / 60)} h`;
  }

  if (elapsedMinutes < 48 * 60) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
};

export const getSavedLabel = (value: string): string => {
  const relative = getRelativeUpdatedAt(value);
  return relative === "Now" ? "Saved just now" : relative === "Yesterday" ? "Saved yesterday" : `Saved ${relative.toLocaleLowerCase()} ago`;
};

export const countWords = (value: string): number => {
  const text = value.trim();
  return text.length === 0 ? 0 : text.split(/\s+/).length;
};

export const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing pages.";
  }

  if (response.status === 403 || reason === "content_page_admin_forbidden") {
    return "Your account does not have page creator permission.";
  }

  if (reason === "content_page_reserved_path") {
    return "That path is reserved for code-owned, admin, tool, API, overlay, dev, auth, account, or static asset routes.";
  }

  if (reason === "content_page_path_conflict") {
    return "That path is already owned by another page record.";
  }

  if (reason === "content_page_public_delete_blocked") {
    return "Unpublish this page before deleting it.";
  }

  if (reason === "content_page_invalid_input") {
    return "The page request has invalid or missing fields.";
  }

  if (reason === "content_page_not_found") {
    return "That page could not be found.";
  }

  return `Page creator request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "content_page_admin_forbidden" || reason === "content_page_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};
