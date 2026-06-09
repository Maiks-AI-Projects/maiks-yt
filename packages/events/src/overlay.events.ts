export type NotificationZone = "top" | "center";

export type OverlayNotificationQueuedEvent = {
  type: "overlay.notification.queued";
  payload: {
    id: string;
    title: string;
    message: string;
    zone: NotificationZone;
    priority: "normal" | "important" | "urgent";
  };
};

export type ProjectFocusChangedEvent = {
  type: "project.focus.changed";
  payload: {
    projectId: string;
    milestoneId?: string;
  };
};

export type OverlayEvent = OverlayNotificationQueuedEvent | ProjectFocusChangedEvent;
