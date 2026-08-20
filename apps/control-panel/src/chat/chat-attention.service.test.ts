import { describe, expect, it } from "vitest";

import type { StreamerChatMessage } from "@maiks-yt/events";
import {
  createChatAttentionReadout,
  createChatAttentionTitle,
  normalizeChatAttentionText,
  shouldAnnounceChatMessage
} from "./chat-attention.service.js";

const message = (overrides: Partial<StreamerChatMessage> = {}): StreamerChatMessage => ({
  id: "message-1",
  authorKind: "human",
  authorName: "Michael",
  createdAt: "2026-08-21T10:00:00.000Z",
  message: "Hello from chat",
  source: "twitch",
  visibleOnOverlayByDefault: false,
  ...overrides
});

describe("chat attention", () => {
  it("announces only non-empty human messages", () => {
    expect(shouldAnnounceChatMessage(message())).toBe(true);
    expect(shouldAnnounceChatMessage(message({ authorKind: "bot" }))).toBe(false);
    expect(shouldAnnounceChatMessage(message({ message: "  \n " }))).toBe(false);
  });

  it("normalizes and bounds spoken text", () => {
    expect(normalizeChatAttentionText(" hello  \n world ")).toBe("hello world");
    expect(normalizeChatAttentionText("x".repeat(300))).toHaveLength(240);
    expect(createChatAttentionReadout(message({ authorName: "  Viewer  ", message: "Hi   there" })))
      .toBe("Viewer says: Hi there");
  });

  it("creates an unread document title", () => {
    expect(createChatAttentionTitle(0)).toBe("Maiks.yt Streamer Chat");
    expect(createChatAttentionTitle(3)).toBe("(3) Maiks.yt Streamer Chat");
  });
});
