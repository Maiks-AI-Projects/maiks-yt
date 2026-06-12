import type { OverlayEvent } from "./overlay.events.js";

export type RealtimeEvent = OverlayEvent;

export type RealtimeTransportState = "disconnected" | "connecting" | "connected";

export type RealtimeTransport = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  publish: (event: RealtimeEvent) => Promise<void>;
  subscribe: (handler: (event: RealtimeEvent) => void) => () => void;
  getState: () => RealtimeTransportState;
};
