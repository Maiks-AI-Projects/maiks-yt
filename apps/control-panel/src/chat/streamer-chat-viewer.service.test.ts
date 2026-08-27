import { describe, expect, it } from "vitest";

import {
  canOpenStreamerChatOptions,
  createStreamerChatModerationAccessUrl,
  noStreamerChatActionAccess
} from "./streamer-chat-viewer.service.js";

describe("streamer chat viewer access", () => {
  it("fails closed before moderation permissions are loaded", () => {
    expect(noStreamerChatActionAccess).toEqual({
      canAllow: false,
      canBan: false,
      canHide: false,
      canProviderModerate: false,
      canWarn: false
    });
  });

  it("builds the existing moderation access endpoint on the configured API origin", () => {
    expect(createStreamerChatModerationAccessUrl("https://api.maiks.yt/base", "control token")).toBe(
      "https://api.maiks.yt/streamer-chat/moderation/access?accessToken=control+token"
    );
  });

  it("opens options for each independent capability that owns an option", () => {
    expect(canOpenStreamerChatOptions({ ...noStreamerChatActionAccess, canAllow: true }, "youtube")).toBe(true);
    expect(canOpenStreamerChatOptions({ ...noStreamerChatActionAccess, canProviderModerate: true }, "twitch")).toBe(true);
    expect(canOpenStreamerChatOptions({ ...noStreamerChatActionAccess, canProviderModerate: true }, "discord")).toBe(true);
    expect(canOpenStreamerChatOptions({ ...noStreamerChatActionAccess, canWarn: true }, "youtube")).toBe(true);
  });

  it("keeps unsupported provider-only and denied options closed", () => {
    expect(canOpenStreamerChatOptions({ ...noStreamerChatActionAccess, canProviderModerate: true }, "youtube")).toBe(false);
    expect(canOpenStreamerChatOptions(noStreamerChatActionAccess, "twitch")).toBe(false);
    expect(canOpenStreamerChatOptions(noStreamerChatActionAccess, "fake-local")).toBe(false);
  });
});
