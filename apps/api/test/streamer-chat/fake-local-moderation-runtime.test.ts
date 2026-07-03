import type { OverlayLiveMessage, StreamerChatMessage } from "@maiks-yt/events";
import { describe, expect, it } from "vitest";

import {
  InMemoryFakeLocalModerationRuntime,
  StreamerChatRuntime
} from "../../src/streamer-chat/index.js";

const createMessage = (overrides: Partial<StreamerChatMessage> = {}): StreamerChatMessage => ({
  id: "message-1",
  authorKind: "human",
  authorName: "Local chatter",
  createdAt: "2026-07-03T00:00:00.000Z",
  message: "Hello from local chat.",
  source: "fake-local",
  visibleOnOverlayByDefault: true,
  ...overrides
});

const createRuntime = () => {
  const overlayMessages: OverlayLiveMessage[] = [];
  const chatRuntime = new StreamerChatRuntime({ maxHistory: 10 });
  const fakeLocalRuntime = new InMemoryFakeLocalModerationRuntime({
    chatRuntime,
    publishOverlayMessage: (message) => {
      overlayMessages.push(message);
    }
  });
  chatRuntime.setVisibilityFilter((message) => fakeLocalRuntime.isMessageVisible(message));

  return {
    chatRuntime,
    fakeLocalRuntime,
    overlayMessages
  };
};

describe("InMemoryFakeLocalModerationRuntime", () => {
  it("hides a message, removes it from chat history, and publishes an overlay hide", () => {
    const { chatRuntime, fakeLocalRuntime, overlayMessages } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "message-1" }));

    expect(fakeLocalRuntime.hideMessage("message-1", "2026-07-03T00:01:00.000Z")).toMatchObject({
      id: "message-1"
    });
    expect(chatRuntime.findMessage("message-1")).toBeNull();
    expect(chatRuntime.listVisibleMessages()).toEqual([]);
    expect(overlayMessages).toEqual([
      {
        type: "overlay.fake-chat.message.hidden",
        payload: {
          id: "message-1",
          source: "fake-local",
          hiddenAt: "2026-07-03T00:01:00.000Z"
        }
      }
    ]);
  });

  it("tracks temporary fake-local mutes and expires them", () => {
    const { fakeLocalRuntime } = createRuntime();

    expect(fakeLocalRuntime.muteAuthor("Local chatter", "2026-07-03T00:05:00.000Z")).toEqual({
      authorName: "Local chatter",
      mutedUntil: "2026-07-03T00:05:00.000Z"
    });
    expect(fakeLocalRuntime.isAuthorMuted("local CHATTER", new Date("2026-07-03T00:04:00.000Z"))).toEqual({
      authorName: "Local chatter",
      mutedUntil: "2026-07-03T00:05:00.000Z"
    });
    expect(fakeLocalRuntime.isAuthorMuted("Local chatter", new Date("2026-07-03T00:06:00.000Z"))).toBeNull();
  });
});
