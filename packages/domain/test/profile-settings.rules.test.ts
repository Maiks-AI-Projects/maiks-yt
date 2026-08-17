import { describe, expect, it } from "vitest";

import { validateProfileSettings } from "../src/identity/profile-settings.rules.js";

describe("validateProfileSettings", () => {
  it("normalizes a custom display name", () => {
    expect(validateProfileSettings({
      displayName: "  Maiks   MC  "
    })).toEqual({
      ok: true,
      value: {
        displayName: "Maiks MC"
      }
    });
  });

  it("rejects blank and control-character display names", () => {
    expect(validateProfileSettings({ displayName: " " })).toEqual({
      ok: false,
      reason: "invalid_display_name"
    });
    expect(validateProfileSettings({ displayName: "bad\nname" })).toEqual({
      ok: false,
      reason: "invalid_display_name"
    });
  });
});
