import type { RealtimeEvent } from "@maiks-yt/events";

export const createNotificationScenario = (): readonly RealtimeEvent[] => [
  {
    type: "overlay.notification.queued",
    payload: {
      id: "scenario-notification-1",
      title: "Test notification",
      message: "The simulator can drive overlay events.",
      zone: "top",
      priority: "normal"
    }
  }
];
