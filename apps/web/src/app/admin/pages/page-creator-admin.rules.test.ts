import { describe, expect, it } from "vitest";

import type { ContentPageAdminBrowserPage } from "@maiks-yt/domain/pages";

import { sortPages, toPageForm } from "./page-creator-admin.rules";

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
});
