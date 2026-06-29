import { describe, expect, it } from "vitest";

import {
  createStreamerChatMessageFromFakeLocal,
  type OverlayFakeChatMessage,
  type StreamerChatMessage
} from "../src/index.js";

const createFakeMessage = (authorKind: OverlayFakeChatMessage["authorKind"]): OverlayFakeChatMessage => ({
  id: `message-${authorKind}`,
  authorKind,
  authorName: `${authorKind} author`,
  createdAt: "2026-06-18T12:00:00.000Z",
  message: `Hello from ${authorKind}`,
  source: "fake-local"
});

describe("createStreamerChatMessageFromFakeLocal", () => {
  it("keeps fake/local human messages visible on the overlay by default", () => {
    expect(createStreamerChatMessageFromFakeLocal(createFakeMessage("human"))).toMatchObject({
      authorKind: "human",
      source: "fake-local",
      visibleOnOverlayByDefault: true
    });
  });

  it("marks fake/local bot and system messages as streamer-only by default", () => {
    expect(createStreamerChatMessageFromFakeLocal(createFakeMessage("bot")).visibleOnOverlayByDefault).toBe(false);
    expect(createStreamerChatMessageFromFakeLocal(createFakeMessage("system")).visibleOnOverlayByDefault).toBe(false);
  });

  it("allows Twitch streamer chat messages without making them overlay fake chat", () => {
    const twitchMessage: StreamerChatMessage = {
      id: "twitch-message-1",
      authorKind: "human",
      authorName: "Viewer",
      channelName: "maiksmc",
      createdAt: "2026-06-29T14:00:00.000Z",
      message: "Hello Twitch",
      providerMessageId: "provider-message-1",
      source: "twitch",
      visibleOnOverlayByDefault: false
    };

    expect(twitchMessage).toMatchObject({
      source: "twitch",
      visibleOnOverlayByDefault: false
    });
  });
});
