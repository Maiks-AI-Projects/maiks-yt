import { describe, expect, it } from "vitest";

import {
  canManageNotifications,
  validateNotificationCreateInput
} from "../src/notifications/index.js";

describe("notification rules", () => {
  it("normalizes valid notification input", () => {
    expect(validateNotificationCreateInput({
      title: "  Dev smoke failed  ",
      body: "  API health returned 502.  ",
      severity: "critical",
      source: "dev_smoke",
      actionUrl: " /admin/event-routing "
    })).toEqual({
      ok: true,
      value: {
        title: "Dev smoke failed",
        body: "API health returned 502.",
        severity: "critical",
        source: "dev_smoke",
        actionUrl: "/admin/event-routing"
      }
    });
  });

  it("rejects empty text and unsafe action URLs", () => {
    expect(validateNotificationCreateInput({
      title: "",
      body: " ",
      severity: "warning",
      source: "system",
      actionUrl: "javascript:alert(1)"
    })).toEqual({
      ok: false,
      issues: [
        "notification_title_required",
        "notification_body_required",
        "notification_action_url_invalid"
      ]
    });
  });

  it("allows owner wildcard or notification permission", () => {
    expect(canManageNotifications(["*"])).toBe(true);
    expect(canManageNotifications(["notifications:manage"])).toBe(true);
    expect(canManageNotifications(["event-routing:manage"])).toBe(false);
  });
});
