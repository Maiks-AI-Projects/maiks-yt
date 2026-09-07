import {
  buildPublicUpdateAdminPreview,
  buildPublicUpdateDetail,
  buildPublicUpdateSummaryList,
  canManagePublicUpdates,
  normalizePublicUpdateAdminInput,
  type PublicUpdateSource
} from "../src/updates/index.js";
import { describe, expect, it } from "vitest";

const createUpdate = (
  id: string,
  overrides: Partial<PublicUpdateSource> = {}
): PublicUpdateSource => ({
  id,
  slug: id,
  title: `Update ${id}`,
  summary: `Summary ${id}`,
  body: `Body ${id}`,
  kind: "post",
  status: "published",
  visibility: "public",
  publishedAt: "2026-08-14T12:00:00.000Z",
  isPinned: false,
  isExample: false,
  updatedAt: "2026-08-14T12:00:00.000Z",
  ...overrides
});

describe("public update rules", () => {
  it("filters drafts, hidden records, missing dates, and invalid slugs", () => {
    const updates = buildPublicUpdateSummaryList([
      createUpdate("visible"),
      createUpdate("draft", { status: "draft", publishedAt: null }),
      createUpdate("hidden", { visibility: "hidden" }),
      createUpdate("missing-date", { publishedAt: null }),
      createUpdate("invalid_slug")
    ]);

    expect(updates.map(({ slug }) => slug)).toEqual(["visible"]);
  });

  it("orders pinned records first and then newest publication first", () => {
    const updates = buildPublicUpdateSummaryList([
      createUpdate("older", { publishedAt: "2026-08-10T12:00:00.000Z" }),
      createUpdate("newer", { publishedAt: "2026-08-14T12:00:00.000Z" }),
      createUpdate("pinned", { isPinned: true, publishedAt: "2026-08-01T12:00:00.000Z" })
    ]);

    expect(updates.map(({ slug }) => slug)).toEqual(["pinned", "newer", "older"]);
  });

  it("keeps raw identity and fixture markers out of public projections", () => {
    const source = createUpdate("detail", { isExample: true, kind: "announcement" });
    const detail = buildPublicUpdateDetail(source);
    const [summary] = buildPublicUpdateSummaryList([source]);

    expect(detail).toMatchObject({ body: "Body detail", kind: "announcement" });
    expect(detail).not.toHaveProperty("id");
    expect(detail).not.toHaveProperty("isExample");
    expect(summary).not.toHaveProperty("body");
    expect(summary).not.toHaveProperty("id");
    expect(summary).not.toHaveProperty("isExample");
  });

  it("keeps the admin preview tied to its private update source", () => {
    const source = createUpdate("detail", { isExample: true, kind: "announcement" });
    const preview = buildPublicUpdateAdminPreview(source);

    expect(preview).toMatchObject({
      id: "detail",
      isExample: true,
      body: "Body detail",
      kind: "announcement"
    });
  });

  it("normalizes valid owner input and rejects malformed content", () => {
    expect(normalizePublicUpdateAdminInput({
      slug: "  Launch-Note ",
      title: " Launch note ",
      summary: " What changed ",
      body: " The full update. ",
      kind: "announcement",
      isPinned: true
    })).toEqual({
      ok: true,
      update: {
        slug: "launch-note",
        title: "Launch note",
        summary: "What changed",
        body: "The full update.",
        kind: "announcement",
        isPinned: true
      }
    });

    expect(normalizePublicUpdateAdminInput({
      slug: "Bad slug",
      title: "",
      summary: "Summary",
      body: "Body",
      kind: "post",
      isPinned: false
    })).toEqual({ ok: false, reason: "public_update_invalid_input" });
  });

  it("builds a saved draft preview without making the source public", () => {
    const draft = createUpdate("draft-preview", {
      status: "draft",
      visibility: "hidden",
      publishedAt: null
    });

    expect(buildPublicUpdateAdminPreview(draft)).toMatchObject({
      slug: "draft-preview",
      body: "Body draft-preview",
      publishedAt: draft.updatedAt
    });
    expect(buildPublicUpdateDetail(draft)).toBeNull();
  });

  it("recognizes owner wildcard and delegated update management", () => {
    expect(canManagePublicUpdates(["*"])).toBe(true);
    expect(canManagePublicUpdates(["updates:manage"])).toBe(true);
    expect(canManagePublicUpdates(["page-creator:manage"])).toBe(false);
  });
});
