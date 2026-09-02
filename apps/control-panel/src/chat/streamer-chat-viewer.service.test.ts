import { describe, expect, it } from "vitest";

import {
  canOpenStreamerChatOptions,
  createStreamerChatModerationAccessUrl,
  getStreamerChatAvatarUrl,
  getStreamerChatReconnectDelayMs,
  mergeStreamerChatMessages,
  shouldReconnectStreamerChat,
  noStreamerChatActionAccess
} from "./streamer-chat-viewer.service.js";

const createMessage = (id: string, message = id) => ({
  authorKind: "human" as const,
  authorName: `Author ${id}`,
  createdAt: "2026-08-27T20:00:00.000Z",
  id,
  message,
  source: "twitch" as const,
  visibleOnOverlayByDefault: false
});

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

  it("caps reconnect backoff while allowing access-policy recovery", () => {
    expect([0, 1, 2, 3, 4, 9].map(getStreamerChatReconnectDelayMs)).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      15_000,
      15_000
    ]);
    expect(shouldReconnectStreamerChat(1006)).toBe(true);
    expect(shouldReconnectStreamerChat(1012)).toBe(true);
    expect(shouldReconnectStreamerChat(1008)).toBe(true);
  });

  it("merges newer live messages ahead of history and deduplicates ids", () => {
    expect(mergeStreamerChatMessages(
      [createMessage("live", "new live message"), createMessage("shared", "new shared message")],
      [createMessage("shared", "stale shared message"), createMessage("history")]
    )).toEqual([
      createMessage("live", "new live message"),
      createMessage("shared", "new shared message"),
      createMessage("history")
    ]);
  });

  it("bounds merged chat history", () => {
    const messages = Array.from({ length: 80 }, (_, index) => createMessage(String(index)));

    expect(mergeStreamerChatMessages(messages, [], 75)).toHaveLength(75);
    expect(mergeStreamerChatMessages(messages, [], 75).at(-1)?.id).toBe("74");
  });

  it("allows only credential-free HTTPS avatar URLs", () => {
    expect(getStreamerChatAvatarUrl("https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj")).toBe(
      "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj"
    );
    expect(getStreamerChatAvatarUrl("http://example.test/avatar.png")).toBeNull();
    expect(getStreamerChatAvatarUrl("https://user:pass@example.test/avatar.png")).toBeNull();
    expect(getStreamerChatAvatarUrl("javascript:alert(1)")).toBeNull();
  });
});
