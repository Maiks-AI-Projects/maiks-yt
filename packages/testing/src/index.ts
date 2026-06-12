import type { RealtimeEvent } from "@maiks-yt/events";

export type EventStormPreset = "notification-burst" | "urgent-center-alert" | "project-focus-shift";

export type ReplayEvent = {
  offsetMs: number;
  event: RealtimeEvent;
};

export type ReplaySessionFixture = {
  title: string;
  source: "manual" | "recorded" | "fixture";
  sanitized: boolean;
  events: readonly ReplayEvent[];
};

export type FakeEventOptions = {
  id?: string;
  title?: string;
  message?: string;
  zone?: "top" | "center";
  priority?: "normal" | "important" | "urgent";
};

const sensitivePayloadKeys = new Set([
  "accessToken",
  "address",
  "email",
  "ipAddress",
  "phone",
  "privateMessage",
  "realName",
  "refreshToken",
  "token"
]);

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
    key,
    sensitivePayloadKeys.has(key) ? "[redacted]" : sanitizeValue(nestedValue)
  ]));
};

export const sanitizeReplayEvent = (event: RealtimeEvent): RealtimeEvent => {
  switch (event.type) {
    case "overlay.notification.queued":
      return {
        ...event,
        payload: sanitizeValue(event.payload) as typeof event.payload
      };
    case "overlay.top-bar-notification.queued":
      return {
        ...event,
        payload: sanitizeValue(event.payload) as typeof event.payload
      };
    case "project.focus.changed":
      return {
        ...event,
        payload: sanitizeValue(event.payload) as typeof event.payload
      };
  }
};

export const createFakeNotificationEvent = (options: FakeEventOptions = {}): RealtimeEvent => ({
  type: "overlay.notification.queued",
  payload: {
    id: options.id ?? "fake-notification-1",
    title: options.title ?? "Test notification",
    message: options.message ?? "The simulator can drive overlay events.",
    zone: options.zone ?? "top",
    priority: options.priority ?? "normal"
  }
});

export const createFakeProjectFocusEvent = (
  projectId = "project-stream-simulator",
  milestoneId?: string
): RealtimeEvent => ({
  type: "project.focus.changed",
  payload: {
    projectId,
    ...(milestoneId ? { milestoneId } : {})
  }
});

export const createNotificationScenario = (): readonly RealtimeEvent[] => [
  createFakeNotificationEvent({ id: "scenario-notification-1" })
];

export const createEventStormPreset = (preset: EventStormPreset): readonly RealtimeEvent[] => {
  switch (preset) {
    case "notification-burst":
      return Array.from({ length: 8 }, (_, index) =>
        createFakeNotificationEvent({
          id: `burst-notification-${index + 1}`,
          title: `Burst notification ${index + 1}`,
          message: "Multiple top notifications arrived close together.",
          zone: "top",
          priority: index > 4 ? "important" : "normal"
        }));
    case "urgent-center-alert":
      return [
        createFakeNotificationEvent({
          id: "urgent-center-alert",
          title: "Manual approval needed",
          message: "This tests a center-screen important notification.",
          zone: "center",
          priority: "urgent"
        })
      ];
    case "project-focus-shift":
      return [
        createFakeProjectFocusEvent("project-stream-simulator", "milestone-event-replayer"),
        createFakeNotificationEvent({
          id: "project-focus-notification",
          title: "Project focus changed",
          message: "The active stream project changed during the session.",
          zone: "top",
          priority: "important"
        })
      ];
  }
};

export const createReplaySessionFixture = (
  title: string,
  events: readonly RealtimeEvent[],
  options: {
    source?: ReplaySessionFixture["source"];
    startOffsetMs?: number;
    stepMs?: number;
    sanitize?: boolean;
  } = {}
): ReplaySessionFixture => {
  const startOffsetMs = options.startOffsetMs ?? 0;
  const stepMs = options.stepMs ?? 1000;
  const shouldSanitize = options.sanitize ?? true;

  return {
    title,
    source: options.source ?? "fixture",
    sanitized: shouldSanitize,
    events: events.map((event, index) => ({
      offsetMs: startOffsetMs + index * stepMs,
      event: shouldSanitize ? sanitizeReplayEvent(event) : event
    }))
  };
};

export const createReplaySessionFromPreset = (preset: EventStormPreset): ReplaySessionFixture =>
  createReplaySessionFixture(preset, createEventStormPreset(preset));
