import type { StreamerChatMessage } from "@maiks-yt/events";
import { describe, expect, it } from "vitest";

import { StreamerChatRuntime, type StreamerChatLiveSocket } from "../../src/streamer-chat/index.js";

class FakeStreamerChatSocket implements StreamerChatLiveSocket {
  public readonly sentMessages: string[] = [];
  private closeListener: (() => void) | null = null;

  public close(): void {
    this.closeListener?.();
  }

  public on(event: "close", listener: () => void): void {
    if (event === "close") {
      this.closeListener = listener;
    }
  }

  public send(data: string): void {
    this.sentMessages.push(data);
  }
}

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

describe("StreamerChatRuntime", () => {
  it("stores newest messages first and trims history", () => {
    const runtime = new StreamerChatRuntime({ maxHistory: 2 });

    runtime.appendMessage(createMessage({ id: "message-1", message: "one" }));
    runtime.appendMessage(createMessage({ id: "message-2", message: "two" }));
    runtime.appendMessage(createMessage({ id: "message-3", message: "three" }));

    expect(runtime.listAllMessages().map((message) => message.id)).toEqual(["message-3", "message-2"]);
    expect(runtime.findMessage("message-1")).toBeNull();
  });

  it("sends snapshots and live messages only for visible messages", () => {
    const runtime = new StreamerChatRuntime({ maxHistory: 10 });
    runtime.setVisibilityFilter((message) => !message.id.includes("hidden"));
    runtime.appendMessage(createMessage({ id: "visible-message" }));
    runtime.appendMessage(createMessage({ id: "hidden-message" }));

    const socket = new FakeStreamerChatSocket();
    runtime.registerLiveClient("connection-1", socket);
    runtime.appendMessage(createMessage({ id: "next-visible-message" }));
    runtime.appendMessage(createMessage({ id: "next-hidden-message" }));

    const parsedMessages = socket.sentMessages.map((message) => JSON.parse(message) as { type: string; payload: unknown });

    expect(parsedMessages).toHaveLength(2);
    expect(parsedMessages[0]).toMatchObject({
      type: "streamer-chat.snapshot",
      payload: {
        messages: [
          { id: "visible-message" }
        ]
      }
    });
    expect(parsedMessages[1]).toMatchObject({
      type: "streamer-chat.message.received",
      payload: {
        id: "next-visible-message"
      }
    });
  });

  it("removes messages and broadcasts an updated snapshot", () => {
    const runtime = new StreamerChatRuntime({ maxHistory: 10 });
    runtime.appendMessage(createMessage({ id: "message-1" }));
    runtime.appendMessage(createMessage({ id: "message-2" }));
    const socket = new FakeStreamerChatSocket();
    runtime.registerLiveClient("connection-1", socket);

    expect(runtime.removeMessage("message-1")).toMatchObject({ id: "message-1" });
    expect(runtime.findMessage("message-1")).toBeNull();

    const lastMessage = JSON.parse(socket.sentMessages.at(-1) ?? "{}") as { payload?: { messages?: StreamerChatMessage[] } };
    expect(lastMessage.payload?.messages?.map((message) => message.id)).toEqual(["message-2"]);
  });
});
