import { describe, expect, it } from "vitest";

import {
  combineLocalDateAndTime,
  normalizeScheduleKey,
  splitLocalDateTime,
  validateScheduleTimeRange
} from "./stream-schedule-form.rules";

describe("stream schedule form rules", () => {
  it("normalizes display names before they reach key-only API fields", () => {
    expect(normalizeScheduleKey("MaiksPlays")).toBe("maiksplays");
    expect(normalizeScheduleKey("The Last Caretaker")).toBe("the-last-caretaker");
  });

  it("round-trips local date and military time without AM/PM", () => {
    expect(splitLocalDateTime("2026-09-02T21:00")).toEqual({
      date: "2026-09-02",
      time: "21:00"
    });
    expect(combineLocalDateAndTime("2026-09-02", "21:00")).toBe("2026-09-02T21:00");
  });

  it("rejects an end time that is not later than the start time", () => {
    expect(validateScheduleTimeRange("2026-09-02T21:00", "2026-09-02T12:00")).toEqual([{
      field: "endsAt",
      message: "The end must be later than the start. If the stream ends after midnight, choose the next date."
    }]);
    expect(validateScheduleTimeRange("2026-09-02T21:00", "2026-09-03T00:00")).toEqual([]);
  });

  it("explains that 00:00 after an evening start needs the next date", () => {
    expect(validateScheduleTimeRange("2026-09-02T21:00", "2026-09-02T00:00")).toEqual([{
      field: "endsAt",
      message: "00:00 is the beginning of the selected date. If you mean midnight after the stream, choose the next date."
    }]);
  });
});
