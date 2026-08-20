import type { EventKind } from "./event-registry.types.js";
import type {
  EventRoutingSoundCatalogEntry,
  EventRoutingSoundRef
} from "./event-sound-catalog.types.js";

export const eventRoutingSoundDefaultVolume = 0.28 as const;

export const eventRoutingSoundCatalog = [
  {
    ref: "chat-radio-ping",
    label: "Chat radio ping",
    publicPath: "/event-sounds/01-frequent/chat-radio-ping.wav",
    sourcePath: "01-frequent/chat-radio-ping.wav",
    sourceTitle: "Metal button radio ping",
    recommendedFor: ["chat"]
  },
  {
    ref: "redeem-digital-interference",
    label: "Redeem digital interference",
    publicPath: "/event-sounds/01-frequent/redeem-digital-interference.wav",
    sourcePath: "01-frequent/redeem-digital-interference.wav",
    sourceTitle: "Digital signal interference",
    recommendedFor: ["twitch.redeem"]
  },
  {
    ref: "follow-creaky-door",
    label: "Follow creaky door",
    publicPath: "/event-sounds/02-standard-alerts/follow-creaky-door.wav",
    sourcePath: "02-standard-alerts/follow-creaky-door.wav",
    sourceTitle: "Creaky door open",
    recommendedFor: ["twitch.follow"]
  },
  {
    ref: "sub-key-in-lock",
    label: "Subscription key in lock",
    publicPath: "/event-sounds/02-standard-alerts/sub-key-in-lock.wav",
    sourcePath: "02-standard-alerts/sub-key-in-lock.wav",
    sourceTitle: "Door key in door lock",
    recommendedFor: ["twitch.sub", "youtube.member", "youtube.subscriber"]
  },
  {
    ref: "gift-sub-metal-door",
    label: "Gift sub metal door",
    publicPath: "/event-sounds/02-standard-alerts/gift-sub-metal-door.wav",
    sourcePath: "02-standard-alerts/gift-sub-metal-door.wav",
    sourceTitle: "Prison metal door close",
    recommendedFor: ["twitch.sub"]
  },
  {
    ref: "bits-loot-unlock",
    label: "Bits loot unlock",
    publicPath: "/event-sounds/02-standard-alerts/bits-loot-unlock.wav",
    sourcePath: "02-standard-alerts/bits-loot-unlock.wav",
    sourceTitle: "Unlock new item game notification",
    recommendedFor: ["twitch.bits", "youtube.super-chat", "youtube.super-sticker"]
  },
  {
    ref: "mod-action-door-shut",
    label: "Moderation door shut",
    publicPath: "/event-sounds/02-standard-alerts/mod-action-door-shut.wav",
    sourcePath: "02-standard-alerts/mod-action-door-shut.wav",
    sourceTitle: "Door hard shut",
    recommendedFor: []
  },
  {
    ref: "error-electric-fence",
    label: "Error electric fence",
    publicPath: "/event-sounds/02-standard-alerts/error-electric-fence.wav",
    sourcePath: "02-standard-alerts/error-electric-fence.wav",
    sourceTitle: "Electric fence alert",
    recommendedFor: []
  },
  {
    ref: "poll-countdown",
    label: "Poll countdown",
    publicPath: "/event-sounds/02-standard-alerts/poll-countdown.wav",
    sourcePath: "02-standard-alerts/poll-countdown.wav",
    sourceTitle: "Clock countdown bleeps",
    recommendedFor: []
  },
  {
    ref: "poll-result-radio-swell",
    label: "Poll result radio swell",
    publicPath: "/event-sounds/02-standard-alerts/poll-result-radio-swell.wav",
    sourcePath: "02-standard-alerts/poll-result-radio-swell.wav",
    sourceTitle: "Radio frequency signal swell",
    recommendedFor: []
  },
  {
    ref: "raid-broken-radio",
    label: "Raid broken radio",
    publicPath: "/event-sounds/03-big-events/raid-broken-radio.wav",
    sourcePath: "03-big-events/raid-broken-radio.wav",
    sourceTitle: "Broken radio frequency signal",
    recommendedFor: ["twitch.raid"]
  },
  {
    ref: "large-raid-zombie-growl",
    label: "Large raid zombie growl",
    publicPath: "/event-sounds/03-big-events/large-raid-zombie-growl.wav",
    sourcePath: "03-big-events/large-raid-zombie-growl.wav",
    sourceTitle: "Zombie monster growl",
    recommendedFor: [],
    catalogOnly: true
  }
] as const satisfies readonly EventRoutingSoundCatalogEntry[];

const eventRoutingSoundRefs = new Set<string>(
  eventRoutingSoundCatalog.map((entry) => entry.ref)
);

export const isEventRoutingSoundRef = (value: unknown): value is EventRoutingSoundRef =>
  typeof value === "string" && eventRoutingSoundRefs.has(value);

export const getEventRoutingSoundCatalogEntry = (
  ref: EventRoutingSoundRef
): EventRoutingSoundCatalogEntry =>
  eventRoutingSoundCatalog.find((entry) => entry.ref === ref) as EventRoutingSoundCatalogEntry;

export const getRecommendedEventRoutingSoundRefs = (
  eventKind: EventKind
): EventRoutingSoundRef[] =>
  eventRoutingSoundCatalog
    .filter((entry) => (entry.recommendedFor as readonly EventKind[]).includes(eventKind))
    .map((entry) => entry.ref);

export const resolveEventRoutingSound = (
  ref: string | null
): {
  ref: EventRoutingSoundRef;
  url: EventRoutingSoundCatalogEntry["publicPath"];
  volume: typeof eventRoutingSoundDefaultVolume;
} | null => {
  if (!isEventRoutingSoundRef(ref)) {
    return null;
  }

  return {
    ref,
    url: getEventRoutingSoundCatalogEntry(ref).publicPath,
    volume: eventRoutingSoundDefaultVolume
  };
};
