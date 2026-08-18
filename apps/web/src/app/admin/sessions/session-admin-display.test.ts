import { afterEach, describe, expect, it, vi } from "vitest";

import { formatSessionActivity, getDeviceSummary } from "./session-admin-data";

describe("session admin display helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns a desktop Chrome user agent into a short recognizable label", () => {
    const summary = getDeviceSummary(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36"
    );

    expect(summary).toEqual({
      label: "Chrome 151 · Linux",
      mobile: false
    });
  });

  it("recognizes mobile Safari without inventing location or device identity", () => {
    const summary = getDeviceSummary(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1"
    );

    expect(summary).toEqual({
      label: "Safari 18 · iPhone",
      mobile: true
    });
  });

  it("formats recent activity for quick session scanning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T10:30:00.000Z"));

    expect(formatSessionActivity("2026-08-18T10:29:00.000Z")).toBe("Active now");
    expect(formatSessionActivity("2026-08-18T10:12:00.000Z")).toBe("18 minutes ago");
    expect(formatSessionActivity("2026-08-16T10:30:00.000Z")).toBe("2 days ago");
  });
});
