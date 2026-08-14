import {
  buildPublicUpdateDetail,
  buildPublicUpdateSummaryList,
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

  it("keeps the body only in the detail projection", () => {
    const source = createUpdate("detail", { isExample: true, kind: "announcement" });
    const detail = buildPublicUpdateDetail(source);
    const [summary] = buildPublicUpdateSummaryList([source]);

    expect(detail).toMatchObject({ body: "Body detail", isExample: true, kind: "announcement" });
    expect(summary).not.toHaveProperty("body");
  });
});
