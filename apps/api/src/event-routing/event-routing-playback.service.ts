import {
  getEventRegistryEntry,
  type EventKind,
  type EventRoutingDestination,
  type EventRoutingNotificationPriority,
  type EventSourcePlatform
} from "@maiks-yt/domain/events";
import type {
  OverlayNotificationDisplay,
  OverlayNotificationPlatform,
  OverlayNotificationPriority,
  OverlayRoutedNotificationQueuedEvent,
  OverlayTopBarNotificationKind,
  OverlayTopBarNotificationQueuedEvent
} from "@maiks-yt/events";

export type EventRoutingPlaybackHistory = {
  id: string;
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  actorDisplayName: string | null;
  redactedPayload: Record<string, unknown>;
  isTest: boolean;
  isSimulated: boolean;
  isRealMoney: boolean;
  testResettable: boolean;
  createdAt: string;
};

export type EventRoutingPlaybackProjection = {
  destination: Extract<EventRoutingDestination, "top_notification" | "center_notification">;
  overlayEvent: OverlayTopBarNotificationQueuedEvent | OverlayRoutedNotificationQueuedEvent;
};

export type EventRoutingPlaybackBlockReason =
  | "event_routing_playback_inert_destination"
  | "event_routing_playback_unsafe_history"
  | "event_routing_playback_internal_only"
  | "event_routing_playback_overlay_ineligible";

export type EventRoutingPlaybackProjectionResult =
  | {
    ok: true;
    projection: EventRoutingPlaybackProjection;
  }
  | {
    ok: false;
    reason: EventRoutingPlaybackBlockReason;
  };

const safeDefaultAvatarUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23161b22'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23f2c94c'/%3E%3Cpath d='M14 57c3-13 13-20 18-20s15 7 18 20' fill='%23d64545'/%3E%3C/svg%3E";

const priorityMap: Record<EventRoutingNotificationPriority, OverlayNotificationPriority> = {
  low: "normal",
  normal: "normal",
  high: "important",
  urgent: "urgent"
};

const platformMap: Record<EventSourcePlatform, OverlayNotificationPlatform> = {
  website: "site",
  "test/system": "system",
  twitch: "twitch",
  youtube: "youtube",
  discord: "discord"
};

const kindMap: Record<EventKind, OverlayTopBarNotificationKind> = {
  chat: "community-highlight",
  "website.signup": "website",
  "website.username-change": "name-change",
  "website.profile-image-update": "image-change",
  "website.project-update-published": "website",
  "website.schedule-changed": "website",
  "website.schedule-cancelled": "website",
  "website.action-panel-item": "system",
  "website.free-tts-request": "website",
  "website.account-security-change": "system",
  "website.provider-token-change": "system",
  "twitch.follow": "follow",
  "twitch.sub": "subscription",
  "twitch.bits": "bits",
  "twitch.raid": "community-highlight",
  "twitch.redeem": "redeem",
  "youtube.subscriber": "subscription",
  "youtube.member": "subscription",
  "youtube.super-chat": "community-highlight",
  "youtube.super-sticker": "community-highlight",
  "discord.message": "community-highlight",
  "discord.join": "community-highlight",
  "discord.role": "system",
  "discord.boost": "community-highlight",
  "simulated.support-money": "website"
};

const cleanText = (value: unknown, fallback: string, maxLength: number): string => {
  const source = typeof value === "string" ? value : fallback;
  const cleaned = source
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || fallback).slice(0, maxLength);
};

const safeAvatarUrl = (value: unknown): string => {
  if (typeof value !== "string") {
    return safeDefaultAvatarUrl;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? value.slice(0, 500)
      : safeDefaultAvatarUrl;
  } catch {
    return safeDefaultAvatarUrl;
  }
};

const buildDisplay = (input: {
  history: EventRoutingPlaybackHistory;
  priority: EventRoutingNotificationPriority;
}): OverlayNotificationDisplay => {
  const entry = getEventRegistryEntry(input.history.eventKind);
  const actorName = cleanText(
    input.history.actorDisplayName ?? input.history.redactedPayload.actor,
    input.history.sourcePlatform === "test/system" ? "Test Event" : entry.label,
    80
  );

  return {
    id: input.history.id,
    actorName,
    actionLabel: cleanText(
      input.history.redactedPayload.displayText ?? input.history.redactedPayload.action,
      entry.label,
      140
    ),
    avatarUrl: safeAvatarUrl(input.history.redactedPayload.avatarUrl),
    createdAt: input.history.createdAt,
    kind: kindMap[input.history.eventKind],
    platform: platformMap[input.history.sourcePlatform],
    priority: priorityMap[input.priority]
  };
};

export const buildSafeEventRoutingPlaybackProjection = (input: {
  history: EventRoutingPlaybackHistory;
  destination: EventRoutingDestination;
  notificationPriority: EventRoutingNotificationPriority;
}): EventRoutingPlaybackProjectionResult => {
  if (input.destination !== "top_notification" && input.destination !== "center_notification") {
    return {
      ok: false,
      reason: "event_routing_playback_inert_destination"
    };
  }

  if ((!input.history.isTest && !input.history.isSimulated)
    || input.history.isRealMoney
    || !input.history.testResettable) {
    return {
      ok: false,
      reason: "event_routing_playback_unsafe_history"
    };
  }

  const entry = getEventRegistryEntry(input.history.eventKind);

  if (entry.safety.internalOnly) {
    return {
      ok: false,
      reason: "event_routing_playback_internal_only"
    };
  }

  if (!entry.safety.overlayEligible) {
    return {
      ok: false,
      reason: "event_routing_playback_overlay_ineligible"
    };
  }

  const display = buildDisplay({
    history: input.history,
    priority: input.notificationPriority
  });

  if (input.destination === "top_notification") {
    return {
      ok: true,
      projection: {
        destination: input.destination,
        overlayEvent: {
          type: "overlay.top-bar-notification.queued",
          payload: display
        }
      }
    };
  }

  return {
    ok: true,
    projection: {
      destination: input.destination,
      overlayEvent: {
        type: "overlay.routed-notification.queued",
        payload: {
          ...display,
          route: "center",
          afterCenter: "none",
          center: {
            title: display.actorName,
            message: display.actionLabel,
            imageUrl: display.avatarUrl,
            timing: {
              onscreenMs: 4_000,
              fadeOutMs: 700,
              restMs: 1_500
            }
          }
        }
      }
    }
  };
};
