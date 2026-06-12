export type NotificationZone = "top" | "center";

export type OverlayTopBarNotificationKind =
  | "donation"
  | "name-change"
  | "image-change"
  | "subscription"
  | "follow"
  | "bits"
  | "gifted-sub"
  | "redeem"
  | "website"
  | "system"
  | "community-highlight";

export type OverlayNotificationPriority = "normal" | "important" | "urgent";

export type OverlayNotificationPlatform = "site" | "youtube" | "twitch" | "discord" | "system";

export type OverlayNotificationDisplay = {
  id: string;
  actorName: string;
  actionLabel: string;
  avatarUrl: string;
  createdAt: string;
  kind: OverlayTopBarNotificationKind;
  platform: OverlayNotificationPlatform;
  priority: OverlayNotificationPriority;
};

export type OverlayTopBarNotificationQueuedEvent = {
  type: "overlay.top-bar-notification.queued";
  payload: OverlayNotificationDisplay;
};

export type OverlayCenterNotificationTiming = {
  onscreenMs: number;
  fadeOutMs: number;
  restMs: number;
};

export type OverlayRoutedNotificationQueuedEvent = {
  type: "overlay.routed-notification.queued";
  payload: OverlayNotificationDisplay & {
    route: "top" | "center";
    center?: {
      title: string;
      message: string;
      imageUrl?: string;
      audioUrl?: string;
      timing: OverlayCenterNotificationTiming;
    };
  };
};

export type OverlayNotificationQueuedEvent = {
  type: "overlay.notification.queued";
  payload: {
    id: string;
    title: string;
    message: string;
    zone: NotificationZone;
    priority: OverlayNotificationPriority;
  };
};

export type ProjectFocusChangedEvent = {
  type: "project.focus.changed";
  payload: {
    projectId: string;
    milestoneId?: string;
  };
};

export type OverlayEvent =
  | OverlayNotificationQueuedEvent
  | OverlayRoutedNotificationQueuedEvent
  | OverlayTopBarNotificationQueuedEvent
  | ProjectFocusChangedEvent;
