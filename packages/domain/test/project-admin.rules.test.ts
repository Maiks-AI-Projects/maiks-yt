import { describe, expect, it } from "vitest";

import {
  canManageProjects,
  isValidProjectAdminItemInput,
  isValidProjectAdminMilestoneInput,
  isValidProjectAdminProjectInput,
  projectAdminManageCapability
} from "../src/projects/index.js";

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
  });
});
