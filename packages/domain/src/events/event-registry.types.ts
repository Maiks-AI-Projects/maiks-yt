export const eventSourcePlatforms = [
  "twitch",
  "youtube",
  "discord",
  "website",
  "test/system"
] as const;

export type EventSourcePlatform = typeof eventSourcePlatforms[number];

export const eventKinds = [
  "chat",
  "website.signup",
  "website.username-change",
  "website.profile-image-update",
  "website.project-update-published",
  "website.schedule-changed",
  "website.schedule-cancelled",
  "website.action-panel-item",
  "website.free-tts-request",
  "website.account-security-change",
  "website.provider-token-change",
  "twitch.follow",
  "twitch.sub",
  "twitch.bits",
  "twitch.raid",
  "twitch.redeem",
  "youtube.subscriber",
  "youtube.member",
  "youtube.super-chat",
  "youtube.super-sticker",
  "discord.message",
  "discord.join",
  "discord.role",
  "discord.boost",
  "simulated.support-money"
] as const;

export type EventKind = typeof eventKinds[number];

export type EventRoutingSafety = {
  overlayEligible: boolean;
  internalOnly: boolean;
  moneyGated: boolean;
  providerGated: boolean;
  approvalRecommended: boolean;
  optOutSupported: boolean;
  cooldownRecommended: boolean;
  simulatedOnly: boolean;
};

export type EventRegistryEntry = {
  kind: EventKind;
  label: string;
  description: string;
  sourcePlatforms: readonly EventSourcePlatform[];
  safety: EventRoutingSafety;
};
