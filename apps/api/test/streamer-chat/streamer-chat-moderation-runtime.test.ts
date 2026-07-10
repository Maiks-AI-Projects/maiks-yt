import type { OverlayLiveMessage, StreamerChatMessage } from "@maiks-yt/events";
import { describe, expect, it } from "vitest";

import {
  InMemoryStreamerChatModerationRuntime,
  StreamerChatRuntime
} from "../../src/streamer-chat/index.js";

const createMessage = (overrides: Partial<StreamerChatMessage> = {}): StreamerChatMessage => ({
  id: "message-1",
  authorKind: "human",
  authorName: "Test chatter",
  createdAt: "2026-07-03T00:00:00.000Z",
  message: "Hello from chat.",
  source: "twitch",
  visibleOnOverlayByDefault: false,
  ...overrides
});

const createRuntime = () => {
  const overlayMessages: OverlayLiveMessage[] = [];
  const chatRuntime = new StreamerChatRuntime({ maxHistory: 10 });
  const moderationRuntime = new InMemoryStreamerChatModerationRuntime({
    chatRuntime,
    publishOverlayMessage: (message) => {
      overlayMessages.push(message);
    }
  });
  chatRuntime.setVisibilityFilter((message) => moderationRuntime.isMessageVisible(message));

  return {
    chatRuntime,
    moderationRuntime,
    overlayMessages
  };
};

describe("InMemoryStreamerChatModerationRuntime", () => {
  it("hides one message and publishes overlay hide only for fake-local chat", () => {
    const { chatRuntime, moderationRuntime, overlayMessages } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "twitch-message", source: "twitch" }));
    chatRuntime.appendMessage(createMessage({ id: "local-message", source: "fake-local" }));

    expect(moderationRuntime.hideMessage("twitch-message")).toMatchObject({ id: "twitch-message" });
    expect(moderationRuntime.hideMessage("local-message")).toMatchObject({ id: "local-message" });

    expect(chatRuntime.listVisibleMessages().map((message) => message.id)).toEqual([]);
    expect(overlayMessages).toHaveLength(1);
    expect(overlayMessages[0]).toMatchObject({
      type: "overlay.fake-chat.message.hidden",
      payload: {
        id: "local-message",
        source: "fake-local"
      }
    });
  });

  it("bans an author across their existing messages", () => {
    const { chatRuntime, moderationRuntime } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "message-1", authorName: "Same Author" }));
    chatRuntime.appendMessage(createMessage({ id: "message-2", authorName: "same author" }));
    chatRuntime.appendMessage(createMessage({ id: "message-3", authorName: "Other Author" }));

    expect(moderationRuntime.banActorFromMessage("message-1")).toMatchObject({
      affectedMessages: [
        { id: "message-2" },
        { id: "message-1" }
      ],
      bannedMessage: {
        id: "message-1"
      }
    });
    expect(chatRuntime.listVisibleMessages().map((message) => message.id)).toEqual(["message-3"]);
    expect(moderationRuntime.isActorBanned("twitch", "same author")).toBe(true);
  });

  it("auto-bans on the third warning", () => {
    const { chatRuntime, moderationRuntime } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "message-1" }));

    expect(moderationRuntime.warnActorFromMessage("message-1", 2)).toMatchObject({
      autoBanned: true,
      affectedMessages: [
        { id: "message-1" }
      ],
      warningCount: 3,
      warningThreshold: 3
    });
    expect(chatRuntime.listVisibleMessages()).toEqual([]);
  });

  it("allows a message or author ahead of hide and ban suppression", () => {
    const { chatRuntime, moderationRuntime } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "message-1", authorName: "Same Author" }));
    chatRuntime.appendMessage(createMessage({ id: "message-2", authorName: "Same Author" }));

    expect(moderationRuntime.hideMessage("message-1")).toMatchObject({ id: "message-1" });
    expect(moderationRuntime.allowMessage("message-1", null)).toMatchObject({ id: "message-1" });
    expect(chatRuntime.listVisibleMessages().map((message) => message.id)).toEqual(["message-2", "message-1"]);

    expect(moderationRuntime.banActorFromMessage("message-2")).toMatchObject({
      affectedMessages: [
        { id: "message-2" },
        { id: "message-1" }
      ]
    });
    expect(chatRuntime.listVisibleMessages().map((message) => message.id)).toEqual(["message-1"]);

    expect(moderationRuntime.allowActorFromMessage("message-2", null)).toMatchObject({ id: "message-2" });
    expect(chatRuntime.listVisibleMessages().map((message) => message.id)).toEqual(["message-2", "message-1"]);
  });

  it("ignores expired allow rules", () => {
    const { chatRuntime, moderationRuntime } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "message-1" }));
    expect(moderationRuntime.hideMessage("message-1")).toMatchObject({ id: "message-1" });

    moderationRuntime.hydrateAllowedMessage(
      "message-1",
      "Test chatter",
      "twitch",
      "2026-07-03T00:00:00.000Z",
      "2000-01-01T00:00:00.000Z"
    );

    expect(chatRuntime.listVisibleMessages()).toEqual([]);
  });

  it("retracts hydrated moderation rules", () => {
    const { chatRuntime, moderationRuntime } = createRuntime();
    chatRuntime.appendMessage(createMessage({ id: "message-1" }));
    moderationRuntime.hydrateHiddenMessage("message-1", "Test chatter", "twitch", "2026-07-03T00:00:00.000Z");

    expect(chatRuntime.listVisibleMessages()).toEqual([]);
    expect(moderationRuntime.retractRule("message_hidden:message-1")).toMatchObject({
      id: "message_hidden:message-1",
      kind: "message_hidden",
      messageId: "message-1"
    });
    expect(chatRuntime.listVisibleMessages()).toMatchObject([{ id: "message-1" }]);
  });
});
