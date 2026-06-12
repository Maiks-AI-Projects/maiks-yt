import type { RealtimeEvent, RealtimeTransport, RealtimeTransportState } from "./realtime.types.js";

export type InMemoryRealtimeTransport = RealtimeTransport & {
  getPublishedEvents: () => readonly RealtimeEvent[];
};

export const createInMemoryRealtimeTransport = (): InMemoryRealtimeTransport => {
  const subscribers = new Set<(event: RealtimeEvent) => void>();
  const publishedEvents: RealtimeEvent[] = [];
  let state: RealtimeTransportState = "disconnected";

  return {
    async connect() {
      state = "connecting";
      state = "connected";
    },
    async disconnect() {
      state = "disconnected";
      subscribers.clear();
    },
    async publish(event) {
      if (state !== "connected") {
        throw new Error("Realtime transport is not connected.");
      }

      publishedEvents.push(event);
      subscribers.forEach((handler) => handler(event));
    },
    subscribe(handler) {
      subscribers.add(handler);

      return () => {
        subscribers.delete(handler);
      };
    },
    getState() {
      return state;
    },
    getPublishedEvents() {
      return [...publishedEvents];
    }
  };
};
