import {
  buildPublicProjectDetail,
  buildPublicProjectSummaryList,
  type ProjectReadModelSource
} from "../src/projects/index.js";
import { describe, expect, it } from "vitest";

const createProject = (
  id: string,
  overrides: Partial<ProjectReadModelSource> = {}
): ProjectReadModelSource => ({
  id,
  slug: id,
  title: `Project ${id}`,
  summary: `Summary for ${id}`,
  type: "milestone-only",
  category: "software-project",
  status: "planning",
  isPublic: true,
  milestones: [],
  items: [],
  updates: [],
  ...overrides
});

describe("project public read models", () => {
  it("keeps private and unavailable projects out of the public summary list", () => {
    const summaries = buildPublicProjectSummaryList([
      createProject("completed", { status: "completed", category: "hobby" }),
      createProject("private", { isPublic: false, status: "active" }),
      createProject("cancelled", { status: "cancelled" }),
      createProject("mothballed", { status: "mothballed" }),
      createProject("planning", { status: "planning", category: "community" }),
      createProject("active", { status: "active", category: "software-project" })
    ]);

    expect(summaries.map((project) => project.slug)).toEqual([
      "active",
      "planning",
      "completed"
    ]);
  });

  it("orders public milestones and strips cancelled milestones and removed items", () => {
    const detail = buildPublicProjectDetail(createProject("maiks-yt-v2", {
      status: "active",
      milestones: [
        {
          id: "cancelled",
          title: "Old direction",
          status: "cancelled",
          sortOrder: 0
        },
        {
          id: "active",
          title: "Current slice",
          status: "active",
          sortOrder: 2
        },
        {
          id: "planned",
          title: "Next slice",
          status: "planned",
          sortOrder: 3
        },
        {
          id: "done",
          title: "Foundation",
          status: "completed",
          sortOrder: 1
        }
      ],
      items: [
        {
          id: "removed",
          title: "Removed item",
          kind: "task",
          status: "removed",
          quantity: 1,
          sortOrder: 1
        },
        {
          id: "parent",
          title: "Parent task",
          kind: "task",
          status: "active",
          quantity: 1,
          sortOrder: 2
        },
        {
          id: "child",
          parentItemId: "parent",
          title: "Child task",
          kind: "task",
          status: "planned",
          quantity: 1,
          sortOrder: 1
        }
      ]
    }));

    expect(detail?.milestones.map((milestone) => milestone.id)).toEqual([
      "done",
      "active",
      "planned"
    ]);
    expect(detail?.nextMilestone?.id).toBe("active");
    expect(detail?.items).toHaveLength(1);
    expect(detail?.items[0]?.id).toBe("parent");
    expect(detail?.items[0]?.children[0]?.id).toBe("child");
    expect(detail?.itemCount).toBe(2);
  });

  it("does not build a detail model for a private project", () => {
    expect(buildPublicProjectDetail(createProject("private", {
      isPublic: false,
      status: "active"
    }))).toBeNull();
  });

  it("shows only published visible updates in public project detail", () => {
    const detail = buildPublicProjectDetail(createProject("updates", {
      status: "active",
      updates: [
        {
          id: "draft",
          title: "Draft update",
          body: "Hidden draft.",
          status: "draft",
          isVisible: true,
          isPinned: false,
          sortOrder: 1
        },
        {
          id: "hidden",
          title: "Hidden update",
          body: "Published but hidden.",
          status: "published",
          isVisible: false,
          publishedAt: "2026-06-20T10:00:00.000Z",
          isPinned: false,
          sortOrder: 2
        },
        {
          id: "newer",
          title: "Newer update",
          summary: "Public summary",
          body: "Visible update.",
          status: "published",
          isVisible: true,
          publishedAt: "2026-06-21T10:00:00.000Z",
          isPinned: false,
          sortOrder: 2
        },
        {
          id: "pinned",
          title: "Pinned update",
          body: "Pinned update.",
          status: "published",
          isVisible: true,
          publishedAt: "2026-06-19T10:00:00.000Z",
          isPinned: true,
          sortOrder: 1
        }
      ]
    }));

    expect(detail?.updates.map((update) => update.id)).toEqual(["pinned", "newer"]);
    expect(detail?.updateCount).toBe(2);
    expect(JSON.stringify(detail)).not.toContain("Hidden draft");
    expect(JSON.stringify(detail)).not.toContain("Published but hidden");
  });
});
