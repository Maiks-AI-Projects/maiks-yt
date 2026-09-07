import { describe, expect, it } from "vitest";

import { classifyControlShellSurface, getControlShellDataAttributes } from "./control-shell-surface.service.js";

describe("control shell surface classifier", () => {
  it.each([
    ["/", "control", "default"],
    ["/control", "control", "default"],
    ["/control/", "control", "default"],
    ["/chat", "chat", "default"],
    ["/chat/", "chat", "default"],
    ["/moderation", "moderation", "default"],
    ["/ai", "ai", "default"],
    ["/unknown", "control", "default"]
  ] as const)("classifies %s", (pathname, surface, theme) => {
    expect(classifyControlShellSurface(pathname)).toEqual({
      surface,
      theme
    });
  });

  it.each([
    "/chatty",
    "/moderation-tools",
    "/airoute",
    "/controller"
  ])("does not classify prefix lookalike %s as a separate shell surface", (pathname) => {
    expect(classifyControlShellSurface(pathname)).toEqual({
      surface: "control",
      theme: "default"
    });
  });

  it("ignores query strings and hashes instead of treating them as route or theme authority", () => {
    expect(classifyControlShellSurface("/control?theme=satisfactory")).toEqual({
      surface: "control",
      theme: "default"
    });
    expect(classifyControlShellSurface("/chat?surface=control#moderation")).toEqual({
      surface: "chat",
      theme: "default"
    });
    expect(classifyControlShellSurface("/moderation#theme=satisfactory")).toEqual({
      surface: "moderation",
      theme: "default"
    });
  });

  it("returns only stable shell data attributes with valid theme ids", () => {
    expect(getControlShellDataAttributes("/chat?theme=satisfactory")).toEqual({
      "data-site-surface": "chat",
      "data-site-theme": "default"
    });
    expect(getControlShellDataAttributes("/moderation")).toEqual({
      "data-site-surface": "moderation",
      "data-site-theme": "default"
    });
    expect(getControlShellDataAttributes("/unknown")).toEqual({
      "data-site-surface": "control",
      "data-site-theme": "default"
    });
  });
});
