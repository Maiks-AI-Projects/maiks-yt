import { describe, expect, it } from "vitest";

import type { ContentPageAdminBrowserPage } from "@maiks-yt/domain/pages";

import {
  defaultPageForm,
  getFailureMessage,
  getLocalFormIssue,
  pageCreatorReservedPathMessage,
  pageCreatorUnavailableMessage,
  sortPages,
  toPageForm
} from "./page-creator-admin.rules";

const createAdminPage = (
  overrides: Partial<ContentPageAdminBrowserPage> = {}
): ContentPageAdminBrowserPage => ({
  id: "page-1",
  title: "Manual Page",
  normalizedPath: "/manual-page",
  status: "draft",
  visibility: "hidden",
  seoTitle: null,
  seoDescription: null,
  body: "# Manual Page\n\nDraft body.",
  publishedAt: null,
  updatedAt: "2026-06-28T10:00:00.000Z",
  ...overrides
});

describe("Page Creator admin browser contract", () => {
  it("uses the minimized admin page projection for editor state", () => {
    const page = createAdminPage({
      seoTitle: "Manual SEO",
      seoDescription: "A manual page.",
      status: "published",
      visibility: "public",
      publishedAt: "2026-06-28T09:00:00.000Z"
    });

    expect(Object.keys(page).sort()).toEqual([
      "body",
      "id",
      "normalizedPath",
      "publishedAt",
      "seoDescription",
      "seoTitle",
      "status",
      "title",
      "updatedAt",
      "visibility"
    ]);
    expect(toPageForm(page)).toEqual({
      title: "Manual Page",
      path: "/manual-page",
      seoTitle: "Manual SEO",
      seoDescription: "A manual page.",
      body: "# Manual Page\n\nDraft body."
    });
  });

  it("sorts minimized pages by revision timestamp and title", () => {
    expect(sortPages([
      createAdminPage({ id: "b", title: "Beta", updatedAt: "2026-06-28T10:00:00.000Z" }),
      createAdminPage({ id: "a", title: "Alpha", updatedAt: "2026-06-28T10:00:00.000Z" }),
      createAdminPage({ id: "c", title: "Current", updatedAt: "2026-06-28T11:00:00.000Z" })
    ]).map((page) => page.id)).toEqual(["c", "a", "b"]);
  });

  it("uses one finite message for local and API reserved-path failures", () => {
    expect(getLocalFormIssue({
      ...defaultPageForm,
      title: "Reserved page",
      path: "/admin"
    })).toBe("That public path is reserved by a Maiks.yt feature. Choose another path.");
    expect(getFailureMessage(new Response(null, { status: 400 }), "content_page_reserved_path"))
      .toBe(pageCreatorReservedPathMessage);
    expect(pageCreatorReservedPathMessage)
      .toBe("That public path is reserved by a Maiks.yt feature. Choose another path.");
  });

  it("uses finite unavailable copy for temporary and unknown failures", () => {
    expect(getFailureMessage(new Response(null, { status: 503 })))
      .toBe("Page Creator is temporarily unavailable. Try again shortly.");
    expect(getFailureMessage(new Response(null, { status: 500 }), "content_page_admin_unavailable"))
      .toBe(pageCreatorUnavailableMessage);
    expect(getFailureMessage(new Response(null, { status: 418 }), "unexpected_failure"))
      .toBe(pageCreatorUnavailableMessage);
    expect(pageCreatorUnavailableMessage)
      .toBe("Page Creator is temporarily unavailable. Try again shortly.");
  });

  it("preserves finite authentication, conflict, validation, not-found, and publication mappings", () => {
    const cases = [
      [401, undefined, "Sign in before managing pages."],
      [403, undefined, "Your account does not have page creator permission."],
      [409, "content_page_path_conflict", "That path is already owned by another page record."],
      [409, "content_page_public_delete_blocked", "Unpublish this page before deleting it."],
      [400, "content_page_invalid_input", "The page request has invalid or missing fields."],
      [404, "content_page_not_found", "That page could not be found."]
    ] as const;

    for (const [status, reason, message] of cases) {
      expect(getFailureMessage(new Response(null, { status }), reason)).toBe(message);
    }
  });
});
