import { describe, expect, it } from "vitest";

import { classifySiteSurface } from "./site-surface.service";

describe("site surface classifier", () => {
  it.each([
    ["", "public", "default", "public-surface-body"],
    ["/", "public", "default", "public-surface-body"],
    ["/schedule", "public", "default", "public-surface-body"],
    ["/music/player", "public", "default", "public-surface-body"],
    ["/gemini-lab/satisfactory", "public", "satisfactory", "public-surface-body"],
    ["/admin", "admin", "default", "admin-surface-body"],
    ["/admin/games", "admin", "default", "admin-surface-body"],
    ["/tools/actions", "tool", "default", "tool-surface-body"],
    ["/tools/notifications", "tool", "default", "tool-surface-body"],
    ["/dev/test-console", "dev", "default", "dev-surface-body"]
  ] as const)("classifies %s", (pathname, surface, theme, bodyClassName) => {
    expect(classifySiteSurface(pathname)).toEqual({
      surface,
      theme,
      bodyClassName
    });
  });

  it.each([
    ["/administer", "public"],
    ["/tools", "public"],
    ["/toolbox/actions", "public"],
    ["/developer-notes", "public"]
  ] as const)("does not classify prefix lookalike %s as privileged", (pathname, surface) => {
    expect(classifySiteSurface(pathname).surface).toBe(surface);
  });

  it("ignores query strings and hashes instead of using them for classification", () => {
    expect(classifySiteSurface("/schedule?surface=admin").surface).toBe("public");
    expect(classifySiteSurface("/schedule?theme=satisfactory").theme).toBe("default");
    expect(classifySiteSurface("/updates#tools").surface).toBe("public");
    expect(classifySiteSurface("/tools/actions?surface=public#top")).toEqual({
      surface: "tool",
      theme: "default",
      bodyClassName: "tool-surface-body"
    });
    expect(classifySiteSurface("/gemini-lab/satisfactory?theme=default#top").theme).toBe("satisfactory");
  });
});
