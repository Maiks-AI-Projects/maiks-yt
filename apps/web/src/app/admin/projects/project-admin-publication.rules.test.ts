import { describe, expect, it } from "vitest";
import type { ProjectReadModelSource } from "@maiks-yt/domain/projects";

import {
  canPublishProject,
  getFailureMessage,
  getProjectPublicationCopy,
  getProjectPublicationLabel,
  getProjectPublicPreviewCopy,
  isProjectPublishable,
  isPublicRouteVisible,
  toProjectForm
} from "./project-admin-client.service";

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

describe("project admin publication rules", () => {
  it("uses the public read predicate for displayed publication state", () => {
    const published = createProject("published", {
      status: "active",
      isPublic: true
    });
    const hidden = createProject("hidden", {
      status: "mothballed",
      isPublic: true
    });

    expect(isPublicRouteVisible(published)).toBe(true);
    expect(getProjectPublicationLabel(published)).toBe("Published");
    expect(getProjectPublicationCopy(published)).toBe("This project is published on the website.");
    expect(isPublicRouteVisible(hidden)).toBe(false);
    expect(getProjectPublicationLabel(hidden)).toBe("Hidden");
    expect(getProjectPublicationCopy(hidden)).toBe("Marked public, but this status is hidden from public routes.");
    expect(toProjectForm(hidden).isPublic).toBe(false);
  });

  it("only enables publish for private projects with public-eligible statuses", () => {
    const privatePlanning = createProject("planning", {
      status: "planning",
      isPublic: false
    });
    const privateCancelled = createProject("cancelled", {
      status: "cancelled",
      isPublic: false
    });

    expect(isProjectPublishable(privatePlanning)).toBe(true);
    expect(canPublishProject(privatePlanning)).toBe(true);
    expect(isProjectPublishable(privateCancelled)).toBe(false);
    expect(canPublishProject(privateCancelled)).toBe(false);
    expect(canPublishProject(createProject("already-public", {
      status: "completed",
      isPublic: true
    }))).toBe(false);
  });

  it("shows the publishability failure returned by the API", () => {
    expect(getFailureMessage(
      new Response(null, { status: 400 }),
      "project_admin_unpublishable_status"
    )).toBe("Only planning, active, or completed projects can be published.");
  });

  it("distinguishes an incomplete eligible draft from a hidden status", () => {
    expect(getProjectPublicPreviewCopy({
      isPublished: false,
      status: "planning",
      hasPreviewSource: false,
      hasPublicPreview: false
    })).toBe("Complete the required project fields to preview the public page shape.");
    expect(getProjectPublicPreviewCopy({
      isPublished: false,
      status: "cancelled",
      hasPreviewSource: false,
      hasPublicPreview: false
    })).toBe("This status is hidden from public project routes.");
  });
});
