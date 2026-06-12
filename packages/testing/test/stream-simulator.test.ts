import { describe, expect, it } from "vitest";

import {
  createEventStormPreset,
  createFakeNotificationEvent,
  createFakeProjectFocusEvent,
  createNotificationScenario
} from "../src/index.js";

describe("stream simulator fixtures", () => {
  it("creates typed notification events", () => {
    expect(createFakeNotificationEvent({
      id: "custom",
      title: "Custom",
      message: "Hello",
      zone: "center",
      priority: "urgent"
    })).toEqual({
      type: "overlay.notification.queued",
      payload: {
        id: "custom",
        title: "Custom",
        message: "Hello",
        zone: "center",
        priority: "urgent"
      }
    });
  });

  it("creates project focus events with optional milestones", () => {
    expect(createFakeProjectFocusEvent("project-1", "milestone-1")).toEqual({
      type: "project.focus.changed",
      payload: {
        projectId: "project-1",
        milestoneId: "milestone-1"
      }
    });
  });

  it("keeps the starter notification scenario available", () => {
    expect(createNotificationScenario()).toHaveLength(1);
  });

  it("creates a notification burst preset for queue pressure testing", () => {
    const events = createEventStormPreset("notification-burst");

    expect(events).toHaveLength(8);
    expect(events.every((event) => event.type === "overlay.notification.queued")).toBe(true);
  });

  it("creates mixed project focus presets", () => {
    expect(createEventStormPreset("project-focus-shift").map((event) => event.type)).toEqual([
      "project.focus.changed",
      "overlay.notification.queued"
    ]);
  });
});
