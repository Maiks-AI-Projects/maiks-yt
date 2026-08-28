import type { PublicProjectSummary } from "@maiks-yt/domain/projects";
import type {
  StreamScheduleEntry,
  StreamScheduleGameLink
} from "@maiks-yt/domain/schedule";
import type { PublicUpdateSummary } from "@maiks-yt/domain/updates";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListLoadResult } from "../projects/project-read-data";
import type { StreamScheduleLoadResult } from "../schedule/stream-schedule-data";
import type { PublicUpdateListLoadResult } from "../updates/public-update-data";
import { HomeCurrentSection } from "./home-current-section";
import type { HomeProjectSlot } from "./home-project-data";
import { getHomeScheduleSlot } from "./home-schedule-data";

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

const createStream = (
  id: string,
  overrides: Partial<StreamScheduleEntry> = {}
): StreamScheduleEntry => ({
  id,
  title: `Stream ${id}`,
  description: null,
  startsAt: "2026-08-28T18:00:00.000Z",
  endsAt: null,
  channelKey: "coding",
  topicKey: null,
  themeKey: null,
  projectId: null,
  focusLabel: null,
  focusNote: null,
  focusProject: null,
  gameLinks: [],
  visibility: "public",
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
  ...overrides
});

const createGameLink = (
  id: string,
  overrides: Partial<StreamScheduleGameLink> = {}
): StreamScheduleGameLink => ({
  id,
  gameId: `game-${id}`,
  slug: id,
  title: `Game ${id}`,
  platformLabel: null,
  ownershipStatus: "owned",
  interestStatus: "currently-playing",
  relationship: "current",
  publicNote: null,
  sortOrder: 0,
  ...overrides
});

const loaded = (streams: readonly StreamScheduleEntry[]): StreamScheduleLoadResult => ({
  status: "loaded",
  streams
});

const createProject = (
  slug: string,
  overrides: Partial<PublicProjectSummary> = {}
): PublicProjectSummary => ({
  id: `project-${slug}`,
  slug,
  title: `Project ${slug}`,
  summary: `Summary for ${slug}`,
  type: "stream-work-project",
  category: "software-project",
  status: "active",
  milestoneCount: 1,
  itemCount: 1,
  updateCount: 1,
  ...overrides
});

const projectLoaded = (projects: readonly PublicProjectSummary[]): ProjectListLoadResult => ({
  status: "loaded",
  projects
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

const emptyProjectSlot: HomeProjectSlot = { status: "empty" };

const renderSchedulePanel = (
  scheduleSlot: ReturnType<typeof getHomeScheduleSlot>
): string => renderToStaticMarkup(
  <HomeCurrentSection projectSlot={emptyProjectSlot} scheduleSlot={scheduleSlot} />
);

describe("home schedule slot", () => {
  beforeEach(() => {
    vi.resetModules();
    getPublicProjects.mockReset();
    getPublicStreamSchedule.mockReset();
    getPublicUpdates.mockReset();
  });

  it("selects the earliest live stream before planned streams", () => {
    expect(getHomeScheduleSlot(loaded([
      createStream("planned", {
        title: "Tomorrow build session",
        startsAt: "2026-08-29T18:00:00.000Z"
      }),
      createStream("later-live", {
        status: "live",
        title: "Later live production notes",
        startsAt: "2026-08-28T19:00:00.000Z"
      }),
      createStream("earlier-live", {
        status: "live",
        title: "Live production notes",
        startsAt: "2026-08-28T18:00:00.000Z"
      })
    ]))).toEqual({
      status: "live",
      title: "Live production notes",
      timeLabel: "formatted 2026-08-28T18:00:00.000Z"
    });
  });

  it("projects the first ordered valid game focus for the selected stream", () => {
    const slot = getHomeScheduleSlot(loaded([
      createStream("with-games", {
        title: "Stream with game focus",
        gameLinks: [
          createGameLink("first-game", {
            title: "First public game",
            platformLabel: "Steam"
          }),
          createGameLink("second-game", {
            title: "Second public game",
            platformLabel: "Xbox"
          })
        ]
      })
    ]));

    expect(Object.keys(slot)).toEqual(["status", "title", "timeLabel", "gameFocus"]);
    expect(slot.status === "planned" ? Object.keys(slot.gameFocus ?? {}) : []).toEqual([
      "title",
      "platformLabel"
    ]);
    expect(slot).toEqual({
      status: "planned",
      title: "Stream with game focus",
      timeLabel: "formatted 2026-08-28T18:00:00.000Z",
      gameFocus: {
        title: "First public game",
        platformLabel: "Steam"
      }
    });
  });

  it("omits game focus when the selected stream has no games", () => {
    const slot = getHomeScheduleSlot(loaded([
      createStream("without-games")
    ]));

    expect(Object.keys(slot)).toEqual(["status", "title", "timeLabel"]);
    expect(slot).toEqual({
      status: "planned",
      title: "Stream without-games",
      timeLabel: "formatted 2026-08-28T18:00:00.000Z"
    });
  });

  it("uses the earliest planned stream when nothing is live", () => {
    expect(getHomeScheduleSlot(loaded([
      createStream("later-planned", {
        title: "Later public schedule title",
        startsAt: "2026-08-30T18:00:00.000Z"
      }),
      createStream("cancelled", {
        status: "cancelled",
        title: "Cancelled earlier stream",
        startsAt: "2026-08-28T18:00:00.000Z",
        cancellationReasonCode: "energy",
        cancellationReason: "Rest day."
      }),
      createStream("earlier-planned", {
        title: "  Long public schedule title that stays in the existing panel  ",
        startsAt: "2026-08-29T18:00:00.000Z"
      })
    ]))).toEqual({
      status: "planned",
      title: "Long public schedule title that stays in the existing panel",
      timeLabel: "formatted 2026-08-29T18:00:00.000Z"
    });
  });

  it("does not promote cancelled-only schedules", () => {
    expect(getHomeScheduleSlot(loaded([
      createStream("cancelled", {
        status: "cancelled",
        title: "Cancelled stream",
        cancellationReasonCode: "energy",
        cancellationReason: "Rest day."
      })
    ]))).toEqual({ status: "empty" });
  });

  it("distinguishes successful empty schedules from unavailable schedule data", () => {
    expect(getHomeScheduleSlot(loaded([]))).toEqual({ status: "empty" });
    expect(getHomeScheduleSlot({ status: "error", streams: [] })).toEqual({ status: "unavailable" });
  });

  it("uses the unavailable fallback for malformed selected schedule data", () => {
    const result = {
      status: "loaded",
      streams: [
        { status: "live", title: "Broken date", startsAt: "not-a-date" },
        { status: "planned", startsAt: "2026-08-29T18:00:00.000Z" }
      ]
    } as unknown as StreamScheduleLoadResult;

    expect(getHomeScheduleSlot(result)).toEqual({ status: "unavailable" });
  });

  it("omits malformed or missing game links without making the schedule unavailable", () => {
    expect(getHomeScheduleSlot(loaded([
      createStream("not-array", {
        gameLinks: null as unknown as StreamScheduleEntry["gameLinks"]
      })
    ]))).toEqual({
      status: "planned",
      title: "Stream not-array",
      timeLabel: "formatted 2026-08-28T18:00:00.000Z"
    });

    const slot = getHomeScheduleSlot(loaded([
      createStream("malformed-link", {
        gameLinks: [
          {
            title: "Broken game",
            platformLabel: "Leaky platform",
            steamAppId: "123"
          },
          createGameLink("valid-after-broken", {
            title: "Valid game"
          })
        ] as unknown as StreamScheduleEntry["gameLinks"]
      })
    ]));

    expect(slot).toEqual({
      status: "planned",
      title: "Stream malformed-link",
      timeLabel: "formatted 2026-08-28T18:00:00.000Z",
      gameFocus: {
        title: "Valid game"
      }
    });
  });

  it("bounds game focus copy and omits absent platform labels", () => {
    const longGameSlot = getHomeScheduleSlot(loaded([
      createStream("long-game", {
        gameLinks: [
          createGameLink("long-game-focus", {
            title: `${"G".repeat(96)}tail`,
            platformLabel: `${"P".repeat(64)}tail`
          })
        ]
      })
    ]));
    const noPlatformSlot = getHomeScheduleSlot(loaded([
      createStream("no-platform", {
        gameLinks: [
          createGameLink("no-platform-focus", {
            title: "No platform game",
            platformLabel: null
          })
        ]
      })
    ]));

    expect(longGameSlot.status).toBe("planned");
    expect(longGameSlot.status === "planned" ? longGameSlot.gameFocus?.title : "").toHaveLength(96);
    expect(longGameSlot.status === "planned" ? longGameSlot.gameFocus?.platformLabel : "").toHaveLength(64);
    expect(longGameSlot.status === "planned" ? longGameSlot.gameFocus?.title : "").not.toContain("tail");
    expect(longGameSlot.status === "planned" ? longGameSlot.gameFocus?.platformLabel : "").not.toContain("tail");
    expect(noPlatformSlot.status === "planned" ? Object.keys(noPlatformSlot.gameFocus ?? {}) : []).toEqual(["title"]);
  });

  it("appends game focus to live and planned schedule body copy without leaking raw game fields", () => {
    const plannedMarkup = renderSchedulePanel(getHomeScheduleSlot(loaded([
      createStream("planned-game", {
        gameLinks: [
          {
            ...createGameLink("planned-focus", {
              title: "Public planned game",
              platformLabel: "Steam",
              publicNote: "Raw public note",
              sortOrder: 42
            }),
            steamAppId: "999",
            storeUrl: "https://store.example/game",
            artworkUrl: "https://cdn.example/art.png"
          } as unknown as StreamScheduleGameLink
        ]
      })
    ])));
    const liveMarkup = renderSchedulePanel(getHomeScheduleSlot(loaded([
      createStream("live-game", {
        status: "live",
        gameLinks: [
          createGameLink("live-focus", {
            title: "Public live game",
            platformLabel: null
          })
        ]
      })
    ])));

    expect(plannedMarkup).toContain("Game: Public planned game / Steam.");
    expect(liveMarkup).toContain("Game: Public live game.");
    expect(plannedMarkup).not.toContain("planned-focus");
    expect(plannedMarkup).not.toContain("game-planned-focus");
    expect(plannedMarkup).not.toContain("Raw public note");
    expect(plannedMarkup).not.toContain("42");
    expect(plannedMarkup).not.toContain("999");
    expect(plannedMarkup).not.toContain("store.example");
    expect(plannedMarkup).not.toContain("cdn.example");
  });

  it("uses the unavailable fallback when schedule streams are not an array", () => {
    expect(getHomeScheduleSlot({
      status: "loaded",
      streams: null
    } as unknown as StreamScheduleLoadResult)).toEqual({ status: "unavailable" });
  });

  it("fetches the public schedule once and feeds one projection to both homepage slots", async () => {
    const { default: HomePage } = await import("../page");
    getPublicStreamSchedule.mockResolvedValue(loaded([
      createStream("planned", {
        title: "Homepage schedule stream",
        startsAt: "2026-08-29T18:00:00.000Z"
      })
    ]));
    getPublicProjects.mockResolvedValue(projectLoaded([
      createProject("homepage-project", {
        title: "Homepage project",
        summary: "Public homepage project."
      })
    ]));
    getPublicUpdates.mockResolvedValue(updateLoaded([
      createUpdate("homepage-update")
    ]));

    const markup = renderToStaticMarkup(await HomePage());

    expect(getPublicStreamSchedule).toHaveBeenCalledTimes(1);
    expect(getPublicProjects).toHaveBeenCalledTimes(1);
    expect(getPublicUpdates).toHaveBeenCalledTimes(1);
    expect(markup).toContain("Next stream: Homepage schedule stream");
    expect(markup).toContain("Homepage schedule stream");
    expect(markup).toContain("formatted 2026-08-29T18:00:00.000Z");
    expect(markup).not.toContain("createdAt");
    expect(markup).not.toContain("updatedAt");
    expect(markup).not.toContain("projectId");
    expect(markup).not.toContain("id=&quot;");
  });
});
