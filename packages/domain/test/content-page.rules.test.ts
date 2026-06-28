import { describe, expect, it } from "vitest";

import {
  buildPublicContentPage,
  canManageContentPages,
  isValidContentPageAdminInput,
  normalizeContentPagePath,
  pageCreatorManageCapability,
  type ContentPageSource
} from "../src/pages/index.js";

const createPage = (overrides: Partial<ContentPageSource> = {}): ContentPageSource => ({
  id: "page-1",
  title: "About Maiks",
  routeScope: "primary",
  normalizedPath: "/about-maiks",
  status: "published",
  visibility: "public",
  seoTitle: "About Maiks",
  seoDescription: "A normal content page.",
  body: "## Hello\n\nThis is a page.",
  createdByUserId: "owner",
  updatedByUserId: "owner",
  publishedAt: "2026-06-28T10:00:00.000Z",
  createdAt: "2026-06-28T09:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z",
  ...overrides
});

describe("content page permissions", () => {
  it("allows owner wildcard and typed page creator permission", () => {
    expect(canManageContentPages(["*"])).toBe(true);
    expect(canManageContentPages([pageCreatorManageCapability])).toBe(true);
    expect(canManageContentPages(["project-admin:manage"])).toBe(false);
  });
});

describe("content page path rules", () => {
  it("normalizes path-only content routes", () => {
    expect(normalizeContentPagePath("Channel/Rules")).toEqual({
      ok: true,
      path: "/channel/rules"
    });
    expect(normalizeContentPagePath("/campaign/")).toEqual({
      ok: true,
      path: "/campaign"
    });
  });

  it("rejects malformed, root, static, admin, app, and code-owned routes", () => {
    expect(normalizeContentPagePath("")).toMatchObject({ ok: false, reason: "empty_path" });
    expect(normalizeContentPagePath("/")).toMatchObject({ ok: false, reason: "malformed_path" });
    expect(normalizeContentPagePath("/admin/pages")).toMatchObject({ ok: false, reason: "reserved_path" });
    expect(normalizeContentPagePath("/api/pages")).toMatchObject({ ok: false, reason: "reserved_path" });
    expect(normalizeContentPagePath("/tools/actions")).toMatchObject({ ok: false, reason: "reserved_path" });
    expect(normalizeContentPagePath("/projects/maiks-yt-v2")).toMatchObject({ ok: false, reason: "reserved_path" });
    expect(normalizeContentPagePath("/manifest.webmanifest")).toMatchObject({ ok: false, reason: "malformed_path" });
    expect(normalizeContentPagePath("/bad path")).toMatchObject({ ok: false, reason: "malformed_path" });
    expect(normalizeContentPagePath("/bad?draft=true")).toMatchObject({ ok: false, reason: "malformed_path" });
  });
});

describe("content page validation and public projection", () => {
  it("accepts a manual draft payload inside v1 limits", () => {
    expect(isValidContentPageAdminInput({
      title: "Channel Rules",
      path: "/channel-rules",
      seoTitle: "Rules",
      seoDescription: "Simple channel rules.",
      body: "# Rules\n\nBe kind."
    })).toBe(true);
  });

  it("rejects invalid title, reserved path, SEO, and body values", () => {
    expect(isValidContentPageAdminInput({
      title: "",
      path: "/channel-rules",
      body: "Content"
    })).toBe(false);
    expect(isValidContentPageAdminInput({
      title: "Admin",
      path: "/admin/custom",
      body: "Content"
    })).toBe(false);
    expect(isValidContentPageAdminInput({
      title: "SEO",
      path: "/seo-page",
      seoDescription: "x".repeat(321),
      body: "Content"
    })).toBe(false);
    expect(isValidContentPageAdminInput({
      title: "Empty",
      path: "/empty",
      body: ""
    })).toBe(false);
  });

  it("builds public pages only for published visible records", () => {
    expect(buildPublicContentPage(createPage())).toMatchObject({
      title: "About Maiks",
      path: "/about-maiks"
    });
    expect(buildPublicContentPage(createPage({ status: "draft", visibility: "hidden", publishedAt: null }))).toBeNull();
    expect(buildPublicContentPage(createPage({ visibility: "hidden" }))).toBeNull();
    expect(buildPublicContentPage(createPage({ normalizedPath: "/tools/custom" }))).toBeNull();
  });
});
