export type NotificationZone = "top" | "center";

export type OverlayTopBarNotificationKind =
  | "donation"
  | "name-change"
  | "image-change"
  | "subscription"
  | "follow"
  | "bits"
  | "gifted-sub"
  | "community-highlight";

export type OverlayTopBarNotificationQueuedEvent = {
  type: "overlay.top-bar-notification.queued";
  payload: {
    id: string;
    actorName: string;
    actionLabel: string;
    avatarUrl: string;
    createdAt: string;
    kind: OverlayTopBarNotificationKind;
    platform: "site" | "youtube" | "twitch" | "discord" | "system";
    priority: "normal" | "important" | "urgent";
  };
};

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

export type OverlayEvent = OverlayNotificationQueuedEvent | OverlayTopBarNotificationQueuedEvent | ProjectFocusChangedEvent;
