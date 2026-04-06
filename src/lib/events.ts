import { EventEmitter } from 'events';

// Re-use existing EventEmitter in development to avoid multiple emitters during hot reloading
export interface SessionInfo {
  id: string;
  channel: string;
  connectedAt: string;
}

const globalForEvents = global as unknown as {
  eventEmitter: EventEmitter;
  activeSessions: Map<string, SessionInfo>;
};

export const eventEmitter = globalForEvents.eventEmitter || new EventEmitter();
export const activeSessions = globalForEvents.activeSessions || new Map<string, SessionInfo>();

// Increase max listeners to support many concurrent SSE clients without warnings
eventEmitter.setMaxListeners(1000);

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.eventEmitter = eventEmitter;
  globalForEvents.activeSessions = activeSessions;
}

/**
 * Event type constants for the application.
 */
export const EVENT_TYPES = {
  DONATION: 'donation',
  VERIFICATION: 'verification',
  CHAT: 'chat',
  SYSTEM: 'system',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export interface AppEvent {
  id: string;
  type: EventType;
  channel: string;
  data: any;
  timestamp: string;
}

/**
 * Helper to trigger an event from anywhere in the application.
 * @param channel - The channel to broadcast to (e.g., 'global', 'mc', 'coding')
 * @param type - The type of event (e.g., 'donation', 'chat')
 * @param data - The payload for the event
 */
export function triggerEvent(channel: string, type: EventType, data: any) {
  const event: AppEvent = {
    id: Math.random().toString(36).substring(2, 15),
    type,
    channel,
    data,
    timestamp: new Date().toISOString(),
  };

  // Emit 'app-event' for internal consumption and 'channel-specific-event' for granular control if needed
  eventEmitter.emit('app-event', event);
  
  // Also emit to the specific channel for more targeted internal listeners
  eventEmitter.emit(`channel:${channel}`, event);

  console.log(`[EventTrigger] Channel: ${channel}, Type: ${type}`, data);
}
