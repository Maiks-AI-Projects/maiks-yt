import { describe, expect, it } from "vitest";

import { createInMemoryRealtimeTransport, type RealtimeEvent } from "../src/index.js";

const event: RealtimeEvent = {
  type: "overlay.notification.queued",
  payload: {
    id: "event-1",
    title: "Event",
    message: "Hello",
    zone: "top",
    priority: "normal"
  }
};

const fakeChatEvent: RealtimeEvent = {
  type: "overlay.fake-chat.message.received",
  payload: {
    id: "chat-event-1",
    authorName: "Test chatter",
    authorKind: "human",
    message: "Hello from the fake chat harness",
    source: "fake-local",
    createdAt: "2026-06-18T12:00:00.000Z"
  }
};

describe("createInMemoryRealtimeTransport", () => {
  it("starts disconnected and can connect", async () => {
    const transport = createInMemoryRealtimeTransport();

    expect(transport.getState()).toBe("disconnected");
    await transport.connect();
    expect(transport.getState()).toBe("connected");
  });

  it("publishes events to subscribers", async () => {
    const transport = createInMemoryRealtimeTransport();
    const receivedEvents: RealtimeEvent[] = [];

    transport.subscribe((nextEvent) => receivedEvents.push(nextEvent));
    await transport.connect();
    await transport.publish(event);

    expect(receivedEvents).toEqual([event]);
    expect(transport.getPublishedEvents()).toEqual([event]);
  });

  it("publishes typed fake chat messages to subscribers", async () => {
    const transport = createInMemoryRealtimeTransport();
    const receivedEvents: RealtimeEvent[] = [];

    transport.subscribe((nextEvent) => receivedEvents.push(nextEvent));
    await transport.connect();
    await transport.publish(fakeChatEvent);

    expect(receivedEvents).toEqual([fakeChatEvent]);
    expect(transport.getPublishedEvents()).toEqual([fakeChatEvent]);
  });

  it("stops sending events after unsubscribe", async () => {
    const transport = createInMemoryRealtimeTransport();
    const receivedEvents: RealtimeEvent[] = [];
    const unsubscribe = transport.subscribe((nextEvent) => receivedEvents.push(nextEvent));

    await transport.connect();
    unsubscribe();
    await transport.publish(event);

    expect(receivedEvents).toEqual([]);
  });

  it("blocks publishing while disconnected", async () => {
    const transport = createInMemoryRealtimeTransport();

    await expect(transport.publish(event)).rejects.toThrow("Realtime transport is not connected.");
  });

  it("clears subscribers on disconnect", async () => {
    const transport = createInMemoryRealtimeTransport();
    const receivedEvents: RealtimeEvent[] = [];

    transport.subscribe((nextEvent) => receivedEvents.push(nextEvent));
    await transport.connect();
    await transport.disconnect();
    await transport.connect();
    await transport.publish(event);

    expect(receivedEvents).toEqual([]);
  });
});
