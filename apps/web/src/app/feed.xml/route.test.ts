import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicUpdates = vi.hoisted(() => vi.fn());

vi.mock("../updates/public-update-data", () => ({
  formatPublicUpdateKind: (kind: string) => kind,
  getPublicUpdates,
  getPublicUpdateUrl: (update: { slug: string }) => `/updates/${update.slug}`
}));

import { GET } from "./route";

const createUpdate = (slug: string, isExample: boolean) => ({
  id: slug,
  slug,
  title: `${slug} title`,
  summary: `${slug} summary`,
  kind: "post" as const,
  publishedAt: "2026-08-27T12:00:00.000Z",
  isPinned: false,
  isExample,
  updatedAt: "2026-08-27T12:00:00.000Z"
});

describe("updates RSS feed", () => {
  beforeEach(() => {
    getPublicUpdates.mockReset();
  });

  it("omits example records even when an upstream response contains one", async () => {
    getPublicUpdates.mockResolvedValue({
      status: "loaded",
      updates: [createUpdate("real-update", false), createUpdate("example-update", true)]
    });

    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain("real-update title");
    expect(xml).not.toContain("example-update");
  });
});
