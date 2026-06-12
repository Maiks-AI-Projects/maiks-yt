import type { RealtimeEvent } from "@maiks-yt/events";

export type EventStormPreset = "notification-burst" | "urgent-center-alert" | "project-focus-shift";

export type FakeEventOptions = {
  id?: string;
  title?: string;
  message?: string;
  zone?: "top" | "center";
  priority?: "normal" | "important" | "urgent";
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
