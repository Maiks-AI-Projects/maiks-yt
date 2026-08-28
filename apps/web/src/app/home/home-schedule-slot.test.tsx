import type { StreamScheduleEntry } from "@maiks-yt/domain/schedule";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StreamScheduleLoadResult } from "../schedule/stream-schedule-data";
import { getHomeScheduleSlot } from "./home-schedule-data";

const getPublicStreamSchedule = vi.hoisted(() => vi.fn());

vi.mock("../schedule/stream-schedule-data", () => ({
  formatScheduleDate: (value: string) => `formatted ${value}`,
  getPublicStreamSchedule
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

const loaded = (streams: readonly StreamScheduleEntry[]): StreamScheduleLoadResult => ({
  status: "loaded",
  streams
});

describe("home schedule slot", () => {
  beforeEach(() => {
    getPublicStreamSchedule.mockReset();
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

    const markup = renderToStaticMarkup(await HomePage());

    expect(getPublicStreamSchedule).toHaveBeenCalledTimes(1);
    expect(markup).toContain("Next stream: Homepage schedule stream");
    expect(markup).toContain("Homepage schedule stream");
    expect(markup).toContain("formatted 2026-08-29T18:00:00.000Z");
    expect(markup).not.toContain("createdAt");
    expect(markup).not.toContain("updatedAt");
    expect(markup).not.toContain("projectId");
    expect(markup).not.toContain("id=&quot;");
  });
});
