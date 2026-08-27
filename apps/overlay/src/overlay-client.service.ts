import type {
  OverlayActiveGoalState,
  OverlayFakeChatMessageReceivedEvent,
  OverlayLayoutKey,
  OverlaySceneKey,
  OverlaySceneSlotDefinition,
  OverlayStateSnapshot,
  OverlayThemeKey,
  OverlayRoutedNotificationQueuedEvent,
  OverlayTopBarNotificationQueuedEvent
} from "@maiks-yt/events";
import type { CSSProperties } from "react";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api.maiks.yt";
export const overlayAccessStorageKey = "maiks.yt.overlay.accessToken";
export const overlayCanvasWidth = 1920;
export const overlayCanvasHeight = 1080;
export const topBarIntakeDelayMs = 500;
export const maxVisibleTopBarNotifications = 8;
export const maxVisibleFakeChatMessages = 6;

export type OverlayRuntimeState =
  | {
    status: "loading";
  }
  | {
    status: "ready";
    liveStatus: "snapshot" | "live" | "reconnecting" | "offline";
    snapshot: OverlayStateSnapshot;
    lastHeartbeatAt: string | null;
  }
  | {
    status: "error";
    message: string;
  };

export type OverlayUrlOptions = {
  scene: OverlaySceneKey;
  layout: OverlayLayoutKey;
  theme: OverlayThemeKey;
  mode: OverlayStateSnapshot["mode"];
};

type OverlayStateResponse = {
  ok: true;
  snapshot: OverlayStateSnapshot;
} | {
  ok: false;
  reason: string;
};

type CachedOverlaySnapshotRecord = {
  cachedAt: string;
  snapshot: OverlayStateSnapshot;
};

export type TopBarNotification = OverlayTopBarNotificationQueuedEvent["payload"];
export type RoutedNotification = OverlayRoutedNotificationQueuedEvent["payload"];
export type FakeChatMessage = OverlayFakeChatMessageReceivedEvent["payload"];
export type CenterNotificationRuntime = {
  notification: RoutedNotification;
  phase: "onscreen" | "fading";
};
export type OverlayLiveStatus = "snapshot" | "live" | "reconnecting" | "offline";
export type NotificationSoundAudio = Pick<HTMLAudioElement, "play" | "volume">;
export type NotificationSoundAudioFactory = (url: string) => NotificationSoundAudio;
export type SoundPlayableNotification = Pick<TopBarNotification, "id" | "sound"> & {
  center?: Pick<NonNullable<RoutedNotification["center"]>, "audioUrl" | "sound">;
};

const playedNotificationSoundLimit = 200;
const fallbackNotificationSoundVolume = 0.28;

export const isMinimalFallbackLiveStatus = (liveStatus: OverlayLiveStatus): boolean =>
  liveStatus === "reconnecting" || liveStatus === "offline";

export const canRenderFakeChat = (snapshot: OverlayStateSnapshot): boolean =>
  snapshot.slots.chat.visible && snapshot.sceneDefinition.slots.chat.visible;

export const isRenderableFakeChatMessage = (message: FakeChatMessage): boolean =>
  message.source === "fake-local" && message.authorKind === "human";

const clampSoundVolume = (volume: number): number =>
  Number.isFinite(volume) ? Math.max(0, Math.min(volume, 1)) : fallbackNotificationSoundVolume;

export const getPlayableNotificationSound = (
  notification: SoundPlayableNotification
): { url: string; volume: number } | null => {
  if (notification.sound) {
    return notification.sound;
  }

  if (notification.center?.sound) {
    return notification.center.sound;
  }

  if (notification.center?.audioUrl) {
    return {
      url: notification.center.audioUrl,
      volume: fallbackNotificationSoundVolume
    };
  }

  return null;
};

export const playNotificationSoundOnce = (
  notification: SoundPlayableNotification,
  playedIds: Set<string>,
  createAudio: NotificationSoundAudioFactory = (url) => new Audio(url)
): boolean => {
  if (playedIds.has(notification.id)) {
    return false;
  }

  const sound = getPlayableNotificationSound(notification);

  if (!sound) {
    return false;
  }

  playedIds.add(notification.id);

  while (playedIds.size > playedNotificationSoundLimit) {
    const oldestId = playedIds.values().next().value as string | undefined;

    if (!oldestId) {
      break;
    }

    playedIds.delete(oldestId);
  }

  const audio = createAudio(sound.url);
  audio.volume = clampSoundVolume(sound.volume);
  void audio.play().catch(() => undefined);

  return true;
};

export const getOverlayCanvasScale = (): number => {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.min(
    window.innerWidth / overlayCanvasWidth,
    window.innerHeight / overlayCanvasHeight
  );
};

export const parseUrlOptions = (): OverlayUrlOptions => {
  const params = new URL(window.location.href).searchParams;

  return {
    scene: parseSceneKey(params.get("scene")),
    layout: parseParam(params.get("layout"), ["standard", "camera-left", "camera-right", "clean"], "standard"),
    theme: parseParam(params.get("theme"), ["default", "satisfactory"], "default"),
    mode: parseParam(params.get("mode"), ["normal", "clean"], "normal")
  };
};

const parseSceneKey = (value: string | null): OverlaySceneKey => {
  return value && /^[a-z0-9][a-z0-9-]{0,47}$/.test(value) ? value : "default";
};

const parseParam = <TValue extends string>(
  value: string | null,
  allowedValues: readonly TValue[],
  fallback: TValue
): TValue => {
  return allowedValues.includes(value as TValue) ? value as TValue : fallback;
};

const getOverlaySnapshotStorageKey = (options: OverlayUrlOptions): string => {
  const params = new URLSearchParams({
    layout: options.layout,
    mode: options.mode,
    scene: options.scene,
    theme: options.theme
  });

  return `maiks.yt.overlay.last-known-good.v1:${params.toString()}`;
};

export const readCachedSnapshot = (options: OverlayUrlOptions): OverlayStateSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getOverlaySnapshotStorageKey(options);

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<CachedOverlaySnapshotRecord>;

    return parsedValue.snapshot ?? null;
  } catch {
    return null;
  }
};

export const writeCachedSnapshot = (snapshot: OverlayStateSnapshot, options: OverlayUrlOptions): void => {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getOverlaySnapshotStorageKey(options);
  const record: CachedOverlaySnapshotRecord = {
    cachedAt: new Date().toISOString(),
    snapshot
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // Ignore storage write failures so the overlay can continue rendering.
  }
};

const createApiUrl = (path: string, token: string, options: OverlayUrlOptions): URL => {
  const url = new URL(path, apiBaseUrl);

  url.searchParams.set("accessToken", token);
  url.searchParams.set("scene", options.scene);
  url.searchParams.set("layout", options.layout);
  url.searchParams.set("theme", options.theme);
  url.searchParams.set("mode", options.mode);

  return url;
};

export const createWebSocketUrl = (path: string, token: string, options: OverlayUrlOptions): string => {
  const url = createApiUrl(path, token, options);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
};

export const loadSnapshot = async (token: string, options: OverlayUrlOptions): Promise<OverlayStateSnapshot> => {
  const response = await fetch(createApiUrl("/overlay/state", token, options));

  if (!response.ok) {
    throw new Error(`Snapshot failed with ${response.status}`);
  }

  const result = await response.json() as OverlayStateResponse;

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.snapshot;
};

const fallbackTopBarHighlights: Array<Omit<TopBarNotification, "createdAt" | "id">> = [
  {
    actorName: "#1 Donator",
    actionLabel: "Donated EUR 20",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  },
  {
    actorName: "#1 Bits",
    actionLabel: "Cheered 500",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  },
  {
    actorName: "#1 Gifted Subs",
    actionLabel: "Gifted 5 subs",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  }
];

export const createFallbackTopBarHighlight = (index: number): TopBarNotification => ({
  id: `fallback-${Date.now()}-${index}`,
  createdAt: new Date().toISOString(),
  ...fallbackTopBarHighlights[index % fallbackTopBarHighlights.length]!
});

export const createSlotStyle = (slot: OverlaySceneSlotDefinition): CSSProperties => ({
  bottom: "auto",
  height: `${slot.height / 10.8}%`,
  left: `${slot.x / 19.2}%`,
  right: "auto",
  top: `${slot.y / 10.8}%`,
  transform: "none",
  width: `${slot.width / 19.2}%`
});

export const clampGoalProgress = (goal: OverlayActiveGoalState): number => {
  if (goal.targetAmount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(goal.currentAmount / goal.targetAmount, 1));
};

export const formatGoalAmount = (amount: number, currencyCode: string): string => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(amount);
};
