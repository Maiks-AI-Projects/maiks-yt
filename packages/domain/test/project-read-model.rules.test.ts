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
});
