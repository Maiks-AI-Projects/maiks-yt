import { describe, expect, it } from "vitest";

import {
  getAccessibleStreamWindows,
  getStreamWindowKeyForPath,
  getStreamWindowLabel,
  normalizeStreamWindowPath,
  type StreamWindowAccessState
} from "./stream-window-registry.service.js";

const allowedControlAccess: StreamWindowAccessState = {
  ai: "unknown",
  control: "allowed",
  moderation: "unknown"
};

describe("stream window registry", () => {
  it.each([
    ["/", "control"],
    ["/control", "control"],
    ["/control/", "control"],
    ["/chat", "chat"],
    ["/moderation?devAuthToken=redacted", "moderation"],
    ["/ai#top", "ai"],
    ["/unknown", "control"]
  ] as const)("maps %s to %s", (pathname, key) => {
    expect(getStreamWindowKeyForPath(pathname)).toBe(key);
  });

  it("normalizes query strings, hashes, and trailing slashes before route checks", () => {
    expect(normalizeStreamWindowPath("/chat/?accessToken=redacted#state")).toBe("/chat");
  });

  it("keeps control and chat available after the control token gate is proven", () => {
    expect(getAccessibleStreamWindows({
      access: allowedControlAccess,
      currentPath: "/chat"
    }).map((windowDefinition) => windowDefinition.key)).toEqual(["control", "chat"]);
  });

  it("adds moderation only after moderation access is proven", () => {
    expect(getAccessibleStreamWindows({
      access: {
        ...allowedControlAccess,
        moderation: "allowed"
      },
      currentPath: "/control"
    }).map((windowDefinition) => windowDefinition.key)).toEqual(["control", "chat", "moderation"]);
  });

  it("keeps the current route visible even when that destination access is not separately proven", () => {
    expect(getAccessibleStreamWindows({
      access: allowedControlAccess,
      currentPath: "/ai"
    }).map((windowDefinition) => windowDefinition.key)).toEqual(["control", "chat", "ai"]);
  });

  it("uses typed labels from the registry", () => {
    expect(getStreamWindowLabel("/moderation")).toBe("Moderation");
    expect(getStreamWindowLabel("/unknown")).toBe("Control");
  });
});
