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

    const parsedMessages = socket.sentMessages.map((message) => JSON.parse(message) as {
      payload: unknown;
      revision: number;
      sessionId: string;
      type: string;
    });

    expect(parsedMessages).toHaveLength(2);
    expect(parsedMessages[0]).toMatchObject({
      type: "streamer-chat.snapshot",
      revision: 2,
      sessionId: expect.any(String),
      payload: {
        messages: [
          { id: "visible-message" }
        ]
      }
    });
    expect(parsedMessages[1]).toMatchObject({
      type: "streamer-chat.message.received",
      revision: 3,
      sessionId: parsedMessages[0]?.sessionId,
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

    const lastMessage = JSON.parse(socket.sentMessages.at(-1) ?? "{}") as {
      payload?: { messages?: StreamerChatMessage[] };
      revision?: number;
    };
    expect(lastMessage.payload?.messages?.map((message) => message.id)).toEqual(["message-2"]);
    expect(lastMessage.revision).toBe(3);
  });

  it("purges the viewer buffer and suppresses messages until emergency clear is restored", () => {
    const runtime = new StreamerChatRuntime({ maxHistory: 10 });
    runtime.appendMessage(createMessage({ id: "before-clear" }));
    const socket = new FakeStreamerChatSocket();
    runtime.registerLiveClient("connection-1", socket);

    expect(runtime.setEmergencyClearEnabled(true)).toBe(true);
    expect(runtime.listAllMessages()).toEqual([]);
    runtime.appendMessage(createMessage({ id: "while-cleared" }));
    expect(runtime.listAllMessages()).toEqual([]);

    expect(runtime.setEmergencyClearEnabled(false)).toBe(false);
    expect(runtime.listAllMessages()).toEqual([]);
    runtime.appendMessage(createMessage({ id: "after-restore" }));

    const parsedMessages = socket.sentMessages.map((message) => JSON.parse(message) as {
      payload: StreamerChatMessage | { messages: StreamerChatMessage[] };
      type: string;
    });
    expect(parsedMessages).toHaveLength(4);
    expect(parsedMessages[1]).toMatchObject({
      type: "streamer-chat.snapshot",
      payload: { messages: [] }
    });
    expect(parsedMessages[2]).toMatchObject({
      type: "streamer-chat.snapshot",
      payload: { messages: [] }
    });
    expect(parsedMessages[3]).toMatchObject({
      type: "streamer-chat.message.received",
      payload: { id: "after-restore" }
    });
  });
});
