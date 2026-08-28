import type { PublicUpdateSummary } from "@maiks-yt/domain/updates";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PublicUpdateListLoadResult } from "../updates/public-update-data";
import { HomePathsSection } from "./home-paths-section";
import { getHomeUpdateSlot, type HomeUpdateSlot } from "./home-update-data";

const createUpdate = (
  slug: string,
  overrides: Partial<PublicUpdateSummary> = {}
): PublicUpdateSummary => ({
  slug,
  title: `Update ${slug}`,
  summary: `Summary for ${slug}`,
  kind: "post",
  isPinned: false,
  publishedAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
  ...overrides
});

const loaded = (updates: readonly PublicUpdateSummary[]): PublicUpdateListLoadResult => ({
  status: "loaded",
  updates
});

const renderPaths = (updateSlot: HomeUpdateSlot): string =>
  renderToStaticMarkup(<HomePathsSection updateSlot={updateSlot} />);

describe("home update slot", () => {
  it("selects the first public update in authoritative API order", () => {
    expect(getHomeUpdateSlot(loaded([
      createUpdate("pinned-older", {
        title: "Pinned older update",
        isPinned: true,
        publishedAt: "2026-08-01T12:00:00.000Z"
      }),
      createUpdate("newer", {
        title: "Newer unpinned update",
        publishedAt: "2026-08-28T12:00:00.000Z"
      })
    ]))).toEqual({
      status: "available",
      slug: "pinned-older",
      title: "Pinned older update",
      summary: "Summary for pinned-older"
    });
  });

  it("returns only the allowlisted available projection keys", () => {
    const slot = getHomeUpdateSlot(loaded([
      createUpdate("featured-update")
    ]));

    expect(Object.keys(slot)).toEqual(["status", "slug", "title", "summary"]);
    expect(slot).toEqual({
      status: "available",
      slug: "featured-update",
      title: "Update featured-update",
      summary: "Summary for featured-update"
    });
  });

  it.each([
    ["missing slug", { slug: undefined }],
    ["bad slug", { slug: "bad slug" }],
    ["blank title", { title: " " }],
    ["missing summary", { summary: undefined }],
    ["bad kind", { kind: "video" }],
    ["missing isPinned", { isPinned: undefined }],
    ["string isPinned", { isPinned: "true" }],
    ["missing publishedAt", { publishedAt: undefined }],
    ["bad publishedAt", { publishedAt: "not-a-date" }],
    ["null publishedAt", { publishedAt: null }],
    ["missing updatedAt", { updatedAt: undefined }],
    ["bad updatedAt", { updatedAt: "not-a-date" }],
    ["null updatedAt", { updatedAt: null }]
  ])("fails closed for malformed public update list data: %s", (_label, overrides) => {
    const badUpdate = {
      ...createUpdate("malformed-update"),
      ...overrides
    };

    expect(getHomeUpdateSlot({
      status: "loaded",
      updates: [badUpdate]
    } as unknown as PublicUpdateListLoadResult)).toEqual({ status: "unavailable" });
  });

  it("fails closed when an unselected public update summary is malformed", () => {
    expect(getHomeUpdateSlot({
      status: "loaded",
      updates: [
        createUpdate("selected-update"),
        {
          ...createUpdate("malformed-second"),
          kind: "video"
        }
      ]
    } as unknown as PublicUpdateListLoadResult)).toEqual({ status: "unavailable" });
  });

  it("keeps empty and unavailable update states distinct", () => {
    expect(getHomeUpdateSlot(loaded([]))).toEqual({ status: "empty" });
    expect(getHomeUpdateSlot({ status: "error" })).toEqual({ status: "unavailable" });
    expect(getHomeUpdateSlot({
      status: "loaded",
      updates: null
    } as unknown as PublicUpdateListLoadResult)).toEqual({ status: "unavailable" });
  });

  it("bounds and trims title and summary for the existing path tile", () => {
    const slot = getHomeUpdateSlot(loaded([
      createUpdate("bounded-copy", {
        title: `  ${"T".repeat(96)}tail  `,
        summary: `  ${"S".repeat(180)}tail  `
      })
    ]));

    expect(slot.status).toBe("available");
    expect(slot.status === "available" ? slot.title : "").toHaveLength(96);
    expect(slot.status === "available" ? slot.summary : "").toHaveLength(180);
    expect(slot.status === "available" ? slot.title : "").not.toContain("tail");
    expect(slot.status === "available" ? slot.summary : "").not.toContain("tail");
  });

  it("renders the featured update link and no raw update fields", () => {
    const slot = getHomeUpdateSlot(loaded([
      {
        ...createUpdate("featured-update", {
          title: "  Public featured update  ",
          summary: "  Public update summary.  ",
          kind: "announcement",
          isPinned: true,
          publishedAt: "2099-01-01T00:00:00.000Z",
          updatedAt: "2099-01-02T00:00:00.000Z"
        }),
        id: "raw-update-id-123",
        body: "Raw update body",
        authorId: "raw-author-id-123"
      } as unknown as PublicUpdateSummary
    ]));
    const markup = renderPaths(slot);

    expect(markup).toContain("Featured update: Public featured update. Public update summary.");
    expect(markup).toContain("Read featured update →");
    expect(markup).toContain('href="/updates/featured-update"');
    expect(markup).not.toContain("latest");
    expect(markup).not.toContain("Latest");
    expect(markup).not.toContain("announcement");
    expect(markup).not.toContain("2099-01-01");
    expect(markup).not.toContain("2099-01-02");
    expect(markup).not.toContain("raw-update-id-123");
    expect(markup).not.toContain("Raw update body");
    expect(markup).not.toContain("raw-author-id-123");
  });

  it("uses distinct honest copy for empty and unavailable states", () => {
    const emptyMarkup = renderPaths({ status: "empty" });
    const unavailableMarkup = renderPaths({ status: "unavailable" });

    expect(emptyMarkup).toContain("No public update is featured yet.");
    expect(emptyMarkup).toContain('href="/projects"');
    expect(unavailableMarkup).toContain("Featured update is temporarily unavailable.");
    expect(unavailableMarkup).toContain('href="/projects"');
  });
});
