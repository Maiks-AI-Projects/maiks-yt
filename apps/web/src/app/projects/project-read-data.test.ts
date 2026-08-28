import { describe, expect, it } from "vitest";

import {
  parseProjectDetailApiResponse,
  parseProjectListApiResponse
} from "./project-read-data";

const createSummary = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  slug: "maiks-yt-v2",
  title: "Maiks.yt V2",
  summary: "Public project summary.",
  type: "stream-work-project",
  category: "software-project",
  status: "active",
  milestoneCount: 1,
  itemCount: 2,
  updateCount: 1,
  nextMilestone: {
    title: "Public milestone",
    status: "active"
  },
  updatedAt: "2026-08-28T12:00:00.000Z",
  ...overrides
});

const createDetail = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...createSummary(),
  milestones: [
    {
      title: "Public milestone",
      status: "active",
      description: "Visible milestone note."
    }
  ],
  items: [
    {
      title: "Public task",
      kind: "task",
      status: "active",
      quantity: 1,
      description: "Visible item note.",
      links: [
        {
          provider: "manual",
          url: "https://example.com/reference",
          label: "Reference",
          relationship: "reference"
        }
      ],
      children: [
        {
          title: "Child task",
          kind: "task",
          status: "planned",
          quantity: 1,
          links: [],
          children: []
        }
      ]
    }
  ],
  updates: [
    {
      title: "Published update",
      body: "Visible public update.",
      isPinned: false,
      summary: "Short public update.",
      publishedAt: "2026-08-28T12:00:00.000Z"
    }
  ],
  ...overrides
});

describe("project read data parsing", () => {
  it("accepts the finite public project list contract without raw identifiers", () => {
    const parsed = parseProjectListApiResponse({
      ok: true,
      projects: [createSummary()]
    });

    expect(parsed).toEqual({
      ok: true,
      projects: [createSummary()]
    });
    expect(JSON.stringify(parsed)).not.toContain("\"id\"");
  });

  it.each([
    ["project id", { projects: [{ ...createSummary(), id: "raw-project-id" }] }],
    ["milestone id", {
      projects: [
        createSummary({
          nextMilestone: {
            title: "Public milestone",
            status: "active",
            id: "raw-milestone-id"
          }
        })
      ]
    }],
    ["response extra field", { debug: "internal" }]
  ])("rejects extra/internal fields in the public list contract: %s", (_label, overrides) => {
    expect(parseProjectListApiResponse({
      ok: true,
      projects: [createSummary()],
      ...overrides
    })).toBeNull();
  });

  it("accepts every producer-valid public project list failure", () => {
    expect(parseProjectListApiResponse({
      ok: false,
      reason: "projects_unavailable"
    })).toEqual({
      ok: false,
      reason: "projects_unavailable"
    });
  });

  it.each([
    "project_not_found",
    "invalid_project_slug",
    "database_error"
  ])("rejects non-list public project failure reasons: %s", (reason) => {
    expect(parseProjectListApiResponse({
      ok: false,
      reason
    })).toBeNull();
  });

  it("rejects extra fields in the public project list failure contract", () => {
    expect(parseProjectListApiResponse({
      ok: false,
      reason: "projects_unavailable",
      debug: "internal"
    })).toBeNull();
  });

  it("accepts the finite public project detail contract without nested raw identifiers", () => {
    const parsed = parseProjectDetailApiResponse({
      ok: true,
      project: createDetail()
    });

    expect(parsed).toEqual({
      ok: true,
      project: createDetail()
    });
    expect(JSON.stringify(parsed)).not.toContain("\"id\"");
  });

  it.each([
    ["project id", { id: "raw-project-id" }],
    ["milestone id", {
      milestones: [
        {
          title: "Public milestone",
          status: "active",
          id: "raw-milestone-id"
        }
      ]
    }],
    ["item id", {
      items: [
        {
          title: "Public task",
          kind: "task",
          status: "active",
          quantity: 1,
          id: "raw-item-id",
          links: [],
          children: []
        }
      ]
    }],
    ["item link id", {
      items: [
        {
          title: "Public task",
          kind: "task",
          status: "active",
          quantity: 1,
          links: [
            {
              provider: "manual",
              url: "https://example.com/reference",
              label: "Reference",
              relationship: "reference",
              id: "raw-link-id"
            }
          ],
          children: []
        }
      ]
    }],
    ["update id", {
      updates: [
        {
          title: "Published update",
          body: "Visible public update.",
          isPinned: false,
          id: "raw-update-id"
        }
      ]
    }]
  ])("rejects extra/internal fields in the public detail contract: %s", (_label, overrides) => {
    expect(parseProjectDetailApiResponse({
      ok: true,
      project: createDetail(overrides)
    })).toBeNull();
  });

  it.each([
    "invalid_project_slug",
    "project_not_found",
    "projects_unavailable"
  ])("accepts producer-valid public project detail failure: %s", (reason) => {
    expect(parseProjectDetailApiResponse({
      ok: false,
      reason
    })).toEqual({
      ok: false,
      reason
    });
  });

  it("rejects a raw/internal public project detail failure reason", () => {
    expect(parseProjectDetailApiResponse({
      ok: false,
      reason: "database_error"
    })).toBeNull();
  });

  it("rejects extra fields in the public project detail failure contract", () => {
    expect(parseProjectDetailApiResponse({
      ok: false,
      reason: "project_not_found",
      debug: "internal"
    })).toBeNull();
  });
});
