import type { PublicProjectSummary } from "@maiks-yt/domain/projects";
import type { PublicStreamScheduleEntry } from "@maiks-yt/domain/schedule";
import type { PublicUpdateSummary } from "@maiks-yt/domain/updates";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListLoadResult } from "../projects/project-read-data";
import type { StreamScheduleLoadResult } from "../schedule/stream-schedule-data";
import type { PublicUpdateListLoadResult } from "../updates/public-update-data";
import { HomeCurrentSection } from "./home-current-section";
import { getHomeProjectSlot, type HomeProjectSlot } from "./home-project-data";
import type { HomeScheduleSlot } from "./home-schedule-data";

const getPublicProjects = vi.hoisted(() => vi.fn());
const getPublicStreamSchedule = vi.hoisted(() => vi.fn());
const getPublicUpdates = vi.hoisted(() => vi.fn());

vi.mock("../projects/project-read-data", () => ({
  getPublicProjects
}));

vi.mock("../schedule/stream-schedule-data", () => ({
  formatScheduleDate: (value: string) => `formatted ${value}`,
  getPublicStreamSchedule
}));

vi.mock("../updates/public-update-data", () => ({
  getPublicUpdates
}));

const createProject = (
  slug: string,
  overrides: Partial<PublicProjectSummary> = {}
): PublicProjectSummary => ({
  slug,
  title: `Project ${slug}`,
  summary: `Summary for ${slug}`,
  type: "stream-work-project",
  category: "software-project",
  status: "planning",
  milestoneCount: 0,
  itemCount: 0,
  updateCount: 0,
  updatedAt: "2026-08-28T12:00:00.000Z",
  ...overrides
});

const createStream = (
  label: string,
  overrides: Partial<PublicStreamScheduleEntry> = {}
): PublicStreamScheduleEntry => ({
  title: `Stream ${label}`,
  description: null,
  startsAt: "2026-08-28T18:00:00.000Z",
  endsAt: null,
  channelKey: "coding",
  topicKey: null,
  focusLabel: null,
  focusNote: null,
  focusProject: null,
  gameLinks: [],
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  ...overrides
});

const projectLoaded = (projects: readonly PublicProjectSummary[]): ProjectListLoadResult => ({
  status: "loaded",
  projects
});

const scheduleLoaded = (streams: readonly PublicStreamScheduleEntry[]): StreamScheduleLoadResult => ({
  status: "loaded",
  streams
});

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

const updateLoaded = (updates: readonly PublicUpdateSummary[]): PublicUpdateListLoadResult => ({
  status: "loaded",
  updates
});

const emptyScheduleSlot: HomeScheduleSlot = { status: "empty" };

const renderCurrentProject = (projectSlot: HomeProjectSlot): string =>
  renderToStaticMarkup(
    <HomeCurrentSection projectSlot={projectSlot} scheduleSlot={emptyScheduleSlot} />
  );

const createDeferred = <Value,>(): {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
} => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

describe("home project slot", () => {
  beforeEach(() => {
    vi.resetModules();
    getPublicProjects.mockReset();
    getPublicStreamSchedule.mockReset();
    getPublicUpdates.mockReset();
  });

  it("selects the first active project before planning projects while preserving API order", () => {
    expect(getHomeProjectSlot(projectLoaded([
      createProject("planning-first", {
        status: "planning",
        title: "Planning project"
      }),
      createProject("active-first", {
        status: "active",
        title: "First active project"
      }),
      createProject("active-second", {
        status: "active",
        title: "Second active project"
      })
    ]))).toEqual({
      status: "available",
      title: "First active project",
      summary: "Summary for active-first",
      slug: "active-first"
    });
  });

  it("uses the first planning project when there is no active project and never calls completed current", () => {
    expect(getHomeProjectSlot(projectLoaded([
      createProject("completed", {
        status: "completed",
        title: "Completed project"
      }),
      createProject("planning-first", {
        status: "planning",
        title: "First planning project"
      }),
      createProject("planning-second", {
        status: "planning",
        title: "Second planning project"
      })
    ]))).toEqual({
      status: "available",
      title: "First planning project",
      summary: "Summary for planning-first",
      slug: "planning-first"
    });

    expect(getHomeProjectSlot(projectLoaded([
      createProject("completed-only", {
        status: "completed",
        title: "Completed only"
      })
    ]))).toEqual({ status: "empty" });
  });

  it("projects only the optional milestone title when one is present", () => {
    const slot = getHomeProjectSlot(projectLoaded([
      createProject("with-milestone", {
        status: "active",
        nextMilestone: {
          title: "Wire real project data",
          status: "active",
          description: "Internal milestone note."
        }
      })
    ]));

    expect(Object.keys(slot)).toEqual([
      "status",
      "title",
      "summary",
      "slug",
      "nextMilestoneTitle"
    ]);
    expect(slot).toEqual({
      status: "available",
      title: "Project with-milestone",
      summary: "Summary for with-milestone",
      slug: "with-milestone",
      nextMilestoneTitle: "Wire real project data"
    });
  });

  it.each([
    ["extra raw id", { id: "raw-project-id" }],
    ["bad slug", { slug: "bad slug" }],
    ["blank title", { title: " " }],
    ["missing summary", { summary: undefined }],
    ["bad type", { type: "custom-project" }],
    ["bad category", { category: "secret-category" }],
    ["bad status", { status: "mothballed" }],
    ["negative milestone count", { milestoneCount: -1 }],
    ["fractional item count", { itemCount: 1.5 }],
    ["infinite update count", { updateCount: Number.POSITIVE_INFINITY }],
    ["bad updatedAt", { updatedAt: "not-a-date" }],
    ["null updatedAt", { updatedAt: null }],
    ["null milestone", { nextMilestone: null }],
    ["extra milestone id", {
      nextMilestone: {
        id: "raw-milestone-id",
        title: "Current work",
        status: "active"
      }
    }],
    ["extra milestone database field", {
      nextMilestone: {
        title: "Current work",
        status: "active",
        sortOrder: 1
      }
    }],
    ["bad milestone status", {
      nextMilestone: {
        title: "Current work",
        status: "cancelled"
      }
    }],
    ["null milestone description", {
      nextMilestone: {
        title: "Current work",
        status: "active",
        description: null
      }
    }],
    ["numeric milestone description", {
      nextMilestone: {
        title: "Current work",
        status: "active",
        description: 123
      }
    }]
  ])("fails closed for malformed project loader data: %s", (_label, overrides) => {
    const badProject = {
      ...createProject("malformed-active", { status: "active" }),
      ...overrides
    };

    expect(getHomeProjectSlot({
      status: "loaded",
      projects: [badProject]
    } as unknown as ProjectListLoadResult)).toEqual({ status: "unavailable" });
  });

  it("fails closed when an unselected public summary is malformed", () => {
    expect(getHomeProjectSlot({
      status: "loaded",
      projects: [
        createProject("selected-active", { status: "active" }),
        {
          ...createProject("completed-malformed", { status: "completed" }),
          type: "custom-project"
        }
      ]
    } as unknown as ProjectListLoadResult)).toEqual({ status: "unavailable" });
  });

  it("fails closed when project data is not an array", () => {
      expect(getHomeProjectSlot({
        status: "loaded",
        projects: null
      } as unknown as ProjectListLoadResult)).toEqual({ status: "unavailable" });
  });

  it("keeps empty and unavailable project states distinct", () => {
    expect(getHomeProjectSlot(projectLoaded([]))).toEqual({ status: "empty" });
    expect(getHomeProjectSlot({ status: "error" })).toEqual({ status: "unavailable" });
  });

  it("bounds the project summary to 280 characters", () => {
    const slot = getHomeProjectSlot(projectLoaded([
      createProject("long-summary", {
        status: "active",
        summary: `${"A".repeat(280)}tail`
      })
    ]));

    expect(slot.status).toBe("available");
    expect(Object.keys(slot)).toEqual(["status", "title", "summary", "slug"]);
    expect(slot.status === "available" ? slot.summary : "").toHaveLength(280);
    expect(slot.status === "available" ? slot.summary : "").not.toContain("tail");
  });

  it("renders the current project card with encoded detail link and no raw project fields", () => {
    const slot = getHomeProjectSlot(projectLoaded([
      createProject("maiks-yt-v2", {
        title: "  Build Maiks.yt V2  ",
        summary: "  Public summary only.  ",
        type: "subscription",
        category: "ongoing-cost",
        status: "active",
        milestoneCount: 91,
        itemCount: 82,
        updateCount: 73,
        updatedAt: "2099-01-01T00:00:00.000Z",
        nextMilestone: {
          title: "  Current public milestone  ",
          status: "active",
          description: "Raw milestone description."
        }
      })
    ]));
    const markup = renderCurrentProject(slot);

    expect(markup).toContain("Build Maiks.yt V2");
    expect(markup).toContain("Public summary only.");
    expect(markup).toContain("Current milestone: Current public milestone");
    expect(markup).toContain('href="/projects/maiks-yt-v2"');
    expect(markup).not.toContain("raw-project-id-123");
    expect(markup).not.toContain("subscription");
    expect(markup).not.toContain("ongoing-cost");
    expect(markup).not.toContain("91");
    expect(markup).not.toContain("82");
    expect(markup).not.toContain("73");
    expect(markup).not.toContain("2099-01-01");
    expect(markup).not.toContain("raw-milestone-id-123");
    expect(markup).not.toContain("Raw milestone description");
  });

  it("keeps useful projects links for empty and unavailable states", () => {
    expect(renderCurrentProject({ status: "empty" })).toContain('href="/projects"');
    expect(renderCurrentProject({ status: "unavailable" })).toContain('href="/projects"');
  });

  it("starts schedule, project, and update loaders once and keeps the shared schedule projection", async () => {
    const { default: HomePage } = await import("../page");
    const calls: string[] = [];
    const schedule = createDeferred<StreamScheduleLoadResult>();
    const projects = createDeferred<ProjectListLoadResult>();
    const updates = createDeferred<PublicUpdateListLoadResult>();

    getPublicStreamSchedule.mockImplementation(() => {
      calls.push("schedule");
      return schedule.promise;
    });
    getPublicProjects.mockImplementation(() => {
      calls.push("projects");
      return projects.promise;
    });
    getPublicUpdates.mockImplementation(() => {
      calls.push("updates");
      return updates.promise;
    });

    const page = HomePage();

    expect(calls).toEqual(["schedule", "projects", "updates"]);
    expect(getPublicStreamSchedule).toHaveBeenCalledTimes(1);
    expect(getPublicProjects).toHaveBeenCalledTimes(1);
    expect(getPublicUpdates).toHaveBeenCalledTimes(1);

    schedule.resolve(scheduleLoaded([
      createStream("next-stream", {
        title: "Concurrent schedule stream",
        startsAt: "2026-08-29T18:00:00.000Z"
      })
    ]));
    projects.resolve(projectLoaded([
      createProject("concurrent-project", {
        status: "active",
        title: "Concurrent public project"
      })
    ]));
    updates.resolve(updateLoaded([
      createUpdate("concurrent-update", {
        title: "Concurrent update"
      })
    ]));

    const markup = renderToStaticMarkup(await page);

    expect(markup.match(/Concurrent schedule stream/g)).toHaveLength(2);
    expect(markup).toContain("formatted 2026-08-29T18:00:00.000Z");
    expect(markup).toContain("Concurrent public project");
    expect(markup).toContain("Featured update: Concurrent update");
  });
});
