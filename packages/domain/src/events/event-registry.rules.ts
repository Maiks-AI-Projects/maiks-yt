import {
  eventKinds,
  eventSourcePlatforms,
  type EventKind,
  type EventRegistryEntry,
  type EventRoutingSafety,
  type EventSourcePlatform
} from "./event-registry.types.js";

const eventSourcePlatformSet = new Set<string>(eventSourcePlatforms);
const eventKindSet = new Set<string>(eventKinds);

const defaultSafety = {
  overlayEligible: false,
  internalOnly: false,
  moneyGated: false,
  providerGated: false,
  approvalRecommended: false,
  optOutSupported: false,
  cooldownRecommended: false,
  simulatedOnly: false
} satisfies EventRoutingSafety;

const overlaySafety = {
  ...defaultSafety,
  overlayEligible: true,
  approvalRecommended: true,
  optOutSupported: true,
  cooldownRecommended: true
} satisfies EventRoutingSafety;

const providerOverlaySafety = {
  ...overlaySafety,
  providerGated: true,
  optOutSupported: false
} satisfies EventRoutingSafety;

const internalOnlySafety = {
  ...defaultSafety,
  internalOnly: true
} satisfies EventRoutingSafety;

export const eventRegistry = [
  {
    kind: "chat",
    label: "Chat Message",
    description: "A live chat message from a chat-capable provider or test source.",
    sourcePlatforms: ["twitch", "youtube", "test/system"],
    safety: {
      ...providerOverlaySafety,
      cooldownRecommended: true
    }
  },
  {
    kind: "website.signup",
    label: "Website Signup",
    description: "A website account signup event for future promotional routing.",
    sourcePlatforms: ["website", "test/system"],
    safety: overlaySafety
  },
  {
    kind: "website.username-change",
    label: "Website Username Change",
    description: "A public website display-name change.",
    sourcePlatforms: ["website", "test/system"],
    safety: overlaySafety
  },
  {
    kind: "website.profile-image-update",
    label: "Website Profile Image Update",
    description: "A public website profile image update.",
    sourcePlatforms: ["website", "test/system"],
    safety: overlaySafety
  },
  {
    kind: "website.project-update-published",
    label: "Project Update Published",
    description: "A public project update was published on the website.",
    sourcePlatforms: ["website", "test/system"],
    safety: {
      ...overlaySafety,
      optOutSupported: false
    }
  },
  {
    kind: "website.schedule-changed",
    label: "Schedule Changed",
    description: "A public stream schedule entry changed.",
    sourcePlatforms: ["website", "test/system"],
    safety: {
      ...overlaySafety,
      optOutSupported: false
    }
  },
  {
    kind: "website.schedule-cancelled",
    label: "Schedule Cancelled",
    description: "A public stream schedule entry was cancelled.",
    sourcePlatforms: ["website", "test/system"],
    safety: {
      ...overlaySafety,
      optOutSupported: false
    }
  },
  {
    kind: "website.action-panel-item",
    label: "Action Panel Item",
    description: "An internal action item became available for review.",
    sourcePlatforms: ["website", "test/system"],
    safety: internalOnlySafety
  },
  {
    kind: "website.free-tts-request",
    label: "Free Website TTS Request",
    description: "A future free website TTS request for dev-console simulation.",
    sourcePlatforms: ["website", "test/system"],
    safety: {
      ...overlaySafety,
      approvalRecommended: true,
      cooldownRecommended: true
    }
  },
  {
    kind: "website.account-security-change",
    label: "Account Security Change",
    description: "A privacy or account-security change that must stay internal.",
    sourcePlatforms: ["website", "test/system"],
    safety: internalOnlySafety
  },
  {
    kind: "website.provider-token-change",
    label: "Provider Token Change",
    description: "A provider credential or token lifecycle event that must stay internal.",
    sourcePlatforms: ["website", "test/system"],
    safety: internalOnlySafety
  },
  {
    kind: "twitch.follow",
    label: "Twitch Follow",
    description: "A future Twitch follow provider event.",
    sourcePlatforms: ["twitch", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "twitch.sub",
    label: "Twitch Subscription",
    description: "A future Twitch subscription or resubscription provider event.",
    sourcePlatforms: ["twitch", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "twitch.bits",
    label: "Twitch Bits",
    description: "A future Twitch bits provider event.",
    sourcePlatforms: ["twitch", "test/system"],
    safety: {
      ...providerOverlaySafety,
      moneyGated: true
    }
  },
  {
    kind: "twitch.raid",
    label: "Twitch Raid",
    description: "A future Twitch raid provider event.",
    sourcePlatforms: ["twitch", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "twitch.redeem",
    label: "Twitch Channel Point Redeem",
    description: "A future Twitch channel-point redeem provider event.",
    sourcePlatforms: ["twitch", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "youtube.subscriber",
    label: "YouTube Subscriber",
    description: "A future YouTube subscriber provider event.",
    sourcePlatforms: ["youtube", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "youtube.member",
    label: "YouTube Member",
    description: "A future YouTube membership provider event.",
    sourcePlatforms: ["youtube", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "youtube.super-chat",
    label: "YouTube Super Chat",
    description: "A future YouTube Super Chat provider event.",
    sourcePlatforms: ["youtube", "test/system"],
    safety: {
      ...providerOverlaySafety,
      moneyGated: true
    }
  },
  {
    kind: "youtube.super-sticker",
    label: "YouTube Super Sticker",
    description: "A future YouTube Super Sticker provider event.",
    sourcePlatforms: ["youtube", "test/system"],
    safety: {
      ...providerOverlaySafety,
      moneyGated: true
    }
  },
  {
    kind: "discord.message",
    label: "Discord Message",
    description: "A future Discord message provider event.",
    sourcePlatforms: ["discord", "test/system"],
    safety: {
      ...providerOverlaySafety,
      approvalRecommended: true,
      cooldownRecommended: true
    }
  },
  {
    kind: "discord.join",
    label: "Discord Join",
    description: "A future Discord community join provider event.",
    sourcePlatforms: ["discord", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "discord.role",
    label: "Discord Role Change",
    description: "A future Discord role-change provider event.",
    sourcePlatforms: ["discord", "test/system"],
    safety: {
      ...internalOnlySafety,
      providerGated: true
    }
  },
  {
    kind: "discord.boost",
    label: "Discord Boost",
    description: "A future Discord server boost provider event.",
    sourcePlatforms: ["discord", "test/system"],
    safety: providerOverlaySafety
  },
  {
    kind: "simulated.support-money",
    label: "Simulated Support Money",
    description: "A simulated support or money event for dev-only routing tests.",
    sourcePlatforms: ["website", "test/system"],
    safety: {
      ...overlaySafety,
      moneyGated: true,
      approvalRecommended: true,
      cooldownRecommended: true,
      simulatedOnly: true
    }
  }
] as const satisfies readonly EventRegistryEntry[];

export const isEventSourcePlatform = (value: unknown): value is EventSourcePlatform =>
  typeof value === "string" && eventSourcePlatformSet.has(value);

export const isEventKind = (value: unknown): value is EventKind =>
  typeof value === "string" && eventKindSet.has(value);

export const getEventRegistryEntry = (kind: EventKind): EventRegistryEntry =>
  eventRegistry.find((entry) => entry.kind === kind) as EventRegistryEntry;

export const canSourceEmitEventKind = (
  sourcePlatform: EventSourcePlatform,
  kind: EventKind
): boolean => getEventRegistryEntry(kind).sourcePlatforms.includes(sourcePlatform);

export const listEventKindsForSource = (sourcePlatform: EventSourcePlatform): EventKind[] =>
  (eventRegistry as readonly EventRegistryEntry[])
    .filter((entry) => entry.sourcePlatforms.includes(sourcePlatform))
    .map((entry) => entry.kind);

export const listOverlayEligibleEventKindsForSource = (sourcePlatform: EventSourcePlatform): EventKind[] =>
  (eventRegistry as readonly EventRegistryEntry[])
    .filter((entry) =>
      entry.sourcePlatforms.includes(sourcePlatform)
      && entry.safety.overlayEligible
      && !entry.safety.internalOnly
    )
    .map((entry) => entry.kind);
