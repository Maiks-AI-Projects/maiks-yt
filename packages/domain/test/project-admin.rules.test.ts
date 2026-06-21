import { describe, expect, it } from "vitest";

import {
  buildProjectAdminPublicPreview,
  canManageProjects,
  isValidProjectAdminItemInput,
  isValidProjectAdminMilestoneInput,
  isValidProjectAdminProjectInput,
  isValidProjectAdminUpdateInput,
  projectAdminManageCapability,
  type ProjectReadModelSource
} from "../src/projects/index.js";

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
  isPublic: false,
  milestones: [],
  items: [],
  updates: [],
  ...overrides
});

describe("project admin permissions", () => {
  it("allows owner wildcard and project-admin manage capability", () => {
    expect(canManageProjects(["*"])).toBe(true);
    expect(canManageProjects([projectAdminManageCapability])).toBe(true);
  });

  it("does not grant access from unrelated or malformed permissions", () => {
    expect(canManageProjects([])).toBe(false);
    expect(canManageProjects(["action-panel:view", "project-admin:view", null])).toBe(false);
  });
});

describe("project admin validation", () => {
  it("accepts valid non-money project, milestone, and item inputs", () => {
    expect(isValidProjectAdminProjectInput({
      slug: "manual-admin-slice",
      title: "Manual Admin Slice",
      summary: "Owner-managed project content.",
      type: "stream-work-project",
      category: "software-project",
      status: "planning",
      isPublic: false
    })).toBe(true);
    expect(isValidProjectAdminMilestoneInput({
      title: "Build forms",
      description: null,
      status: "active",
      sortOrder: 1
    })).toBe(true);
    expect(isValidProjectAdminItemInput({
      parentItemId: null,
      title: "Admin form",
      description: "No estimate or provider data.",
      kind: "task",
      status: "planned",
      quantity: 1,
      sortOrder: 1
    })).toBe(true);
    expect(isValidProjectAdminUpdateInput({
      title: "Manual update",
      summary: "Short public summary.",
      body: "A manually written project update.",
      status: "draft",
      isVisible: true,
      isPinned: false,
      sortOrder: 1
    })).toBe(true);
  });

  it("rejects malformed slugs, blank titles, long descriptions, and invalid counts", () => {
    expect(isValidProjectAdminProjectInput({
      slug: "Bad Slug",
      title: "Project",
      type: "milestone-only",
      category: "software-project",
      status: "planning",
      isPublic: false
    })).toBe(false);
    expect(isValidProjectAdminMilestoneInput({
      title: " ",
      description: null,
      status: "planned",
      sortOrder: 0
    })).toBe(false);
    expect(isValidProjectAdminItemInput({
      title: "Item",
      description: "x".repeat(2_001),
      kind: "task",
      status: "planned",
      quantity: 0,
      sortOrder: 0
    })).toBe(false);
    expect(isValidProjectAdminUpdateInput({
      title: "Update",
      body: "",
      status: "published",
      isVisible: true,
      publishedAt: "not-a-date",
      isPinned: false,
      sortOrder: -1
    })).toBe(false);
  });
});

describe("project admin public preview", () => {
  it("builds a public projection for private draft projects without publishing them", () => {
    const preview = buildProjectAdminPublicPreview(createProject("draft", {
      isPublic: false,
      status: "active",
      milestones: [
        {
          id: "live",
          title: "Live milestone",
          status: "active",
          sortOrder: 1
        },
        {
          id: "cancelled",
          title: "Cancelled milestone",
          status: "cancelled",
          sortOrder: 2
        }
      ],
      items: [
        {
          id: "visible",
          title: "Visible item",
          kind: "task",
          status: "planned",
          quantity: 1,
          sortOrder: 1
        },
        {
          id: "removed",
          title: "Removed item",
          kind: "task",
          status: "removed",
          quantity: 1,
          sortOrder: 2
        }
      ],
      updates: [
        {
          id: "public-update",
          title: "Public update",
          body: "Visible in preview.",
          status: "published",
          isVisible: true,
          isPinned: false,
          sortOrder: 1
        },
        {
          id: "draft-update",
          title: "Draft update",
          body: "Hidden in preview.",
          status: "draft",
          isVisible: true,
          isPinned: false,
          sortOrder: 2
        }
      ]
    }));

    expect(preview.ok).toBe(true);

    if (preview.ok) {
      expect(preview.project.slug).toBe("draft");
      expect(preview.project.milestones.map((milestone) => milestone.id)).toEqual(["live"]);
      expect(preview.project.items.map((item) => item.id)).toEqual(["visible"]);
      expect(preview.project.updates.map((update) => update.id)).toEqual(["public-update"]);
    }
  });

  it("blocks preview when the project status would not be public", () => {
    expect(buildProjectAdminPublicPreview(createProject("cancelled", {
      status: "cancelled"
    }))).toEqual({
      ok: false,
      reason: "project_admin_preview_unavailable_status"
    });
  });
});
