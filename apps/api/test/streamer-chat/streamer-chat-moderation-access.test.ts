import { describe, expect, it } from "vitest";

import { canViewStreamerChatModerationWindow } from "../../src/streamer-chat/index.js";

describe("streamer chat moderation window access", () => {
  it.each([
    ["owner wildcard", ["*"]],
    ["chat viewer", ["chat:view"]],
    ["moderation rule viewer", ["moderation-rules:view"]]
  ])("allows %s access", (_label, permissions) => {
    expect(canViewStreamerChatModerationWindow(permissions)).toBe(true);
  });

  it.each([
    ["role manager only", ["moderators:manage"]],
    ["fake chat moderator only", ["fake-local-chat:moderate"]],
    ["no permissions", []]
  ])("denies %s access when no remaining panel is available", (_label, permissions) => {
    expect(canViewStreamerChatModerationWindow(permissions)).toBe(false);
  });
});
