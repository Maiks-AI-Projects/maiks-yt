import { describe, expect, it } from "vitest";

import { resolveLayoutSurface } from "./layout-surface.rules";

describe("layout surface boundary", () => {
  it("keeps the public shell on the recovery login route without account navigation", () => {
    expect(resolveLayoutSurface("/access/recovery")).toEqual({
      authenticatedContext: null,
      bodyClassKind: "site",
      showPublicShell: true
    });
  });

  it("keeps normal account pages in the account navigation context", () => {
    expect(resolveLayoutSurface("/account/connections")).toMatchObject({
      authenticatedContext: "account",
      bodyClassKind: "site",
      showPublicShell: true
    });
  });

  it.each([
    "/control",
    "/control/music",
    "/chat",
    "/moderation",
    "/moderation/rules",
    "/tools/notifications",
    "/music/player"
  ])("keeps %s out of the public website shell", (pathname) => {
    expect(resolveLayoutSurface(pathname)).toMatchObject({
      authenticatedContext: null,
      bodyClassKind: "tool",
      showPublicShell: false
    });
  });

  it("preserves the admin body boundary", () => {
    expect(resolveLayoutSurface("/admin/provider-integrations")).toEqual({
      authenticatedContext: null,
      bodyClassKind: "admin",
      showPublicShell: false
    });
  });
});
