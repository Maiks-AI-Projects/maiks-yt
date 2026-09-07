import { describe, expect, it } from "vitest";

import { classifySiteSurface } from "./site-surface";

describe("site surface classifier", () => {
  it.each([
    ["", "public", "default"],
    ["/", "public", "default"],
    ["/schedule", "public", "default"],
    ["/music/player", "public", "default"],
    ["/gemini-lab/satisfactory", "public", "satisfactory"],
    ["/admin", "admin", "default"],
    ["/admin/games", "admin", "default"],
    ["/tools/actions", "tool", "default"],
    ["/tools/notifications", "tool", "default"],
    ["/dev/test-console", "dev", "default"]
  ] as const)("classifies %s", (pathname, surface, theme) => {
    expect(classifySiteSurface(pathname)).toEqual({
      surface,
      theme
    });
  });

  it.each([
    ["/administer", "public"],
    ["/tools", "public"],
    ["/toolbox/actions", "public"],
    ["/developer-notes", "public"]
  ] as const)("does not classify prefix lookalike %s as a separate surface", (pathname, surface) => {
    expect(classifySiteSurface(pathname).surface).toBe(surface);
  });

  it("ignores query strings and hashes instead of using them for classification", () => {
    expect(classifySiteSurface("/schedule?surface=admin").surface).toBe("public");
    expect(classifySiteSurface("/schedule?theme=satisfactory").theme).toBe("default");
    expect(classifySiteSurface("/updates#tools").surface).toBe("public");
    expect(classifySiteSurface("/tools/actions?surface=public#top")).toEqual({
      surface: "tool",
      theme: "default"
    });
    expect(classifySiteSurface("/gemini-lab/satisfactory?theme=default#top").theme).toBe("satisfactory");
  });
});
