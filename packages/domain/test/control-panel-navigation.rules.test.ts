import { describe, expect, it } from "vitest";

import {
  projectControlPanelPages,
  resolveControlPanelPage
} from "../src/security/control-panel-navigation.rules.js";

describe("control panel navigation rules", () => {
  it("keeps the existing core Control pages available after the outer access gate", () => {
    expect(projectControlPanelPages([])).toEqual(["overview", "stream", "overlays"]);
  });

  it("projects optional pages from their existing backend capabilities", () => {
    expect(projectControlPanelPages([
      "action-panel:view",
      "music:play-control",
      "chat:view"
    ])).toEqual(["overview", "stream", "overlays", "actions", "music", "providers"]);
  });

  it("gives the owner wildcard every current Control page", () => {
    expect(projectControlPanelPages(["*"])).toEqual([
      "overview",
      "stream",
      "overlays",
      "actions",
      "music",
      "providers"
    ]);
  });

  it("falls back from a direct page that is not in the current projection", () => {
    expect(resolveControlPanelPage("music", ["overview", "stream", "overlays"])).toBe("overview");
    expect(resolveControlPanelPage("stream", ["overview", "stream", "overlays"])).toBe("stream");
  });
});
