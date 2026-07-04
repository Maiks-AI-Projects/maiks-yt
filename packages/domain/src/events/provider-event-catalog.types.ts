export const providerEventPlatforms = ["twitch", "youtube", "discord"] as const;

export type ProviderEventPlatform = typeof providerEventPlatforms[number];

export const providerEventMechanisms = [
  "twitch-eventsub",
  "twitch-irc",
  "youtube-live-chat",
  "youtube-activity",
  "youtube-pubsub",
  "discord-gateway",
  "discord-webhook"
] as const;

export type ProviderEventMechanism = typeof providerEventMechanisms[number];

export const providerEventCategories = [
  "auth",
  "channel",
  "chat",
  "community",
  "content",
  "interaction",
  "moderation",
  "money",
  "operations",
  "roles",
  "stream",
  "system",
  "unknown"
] as const;

export type ProviderEventCategory = typeof providerEventCategories[number];

export type ProviderEventSafety = {
  readonly authOrTokenShaped: boolean;
  readonly highVolume: boolean;
  readonly internalOnly: boolean;
  readonly moderationShaped: boolean;
  readonly moneyShaped: boolean;
  readonly overlayEligibleByDefault: boolean;
  readonly providerWriteRequired: boolean;
};

export type ProviderEventCatalogEntry = {
  readonly category: ProviderEventCategory;
  readonly description: string;
  readonly internalTrigger: string;
  readonly label: string;
  readonly mechanism: ProviderEventMechanism;
  readonly platform: ProviderEventPlatform;
  readonly providerEventName: string;
  readonly safety: ProviderEventSafety;
};

export type ProviderEventCatalogSummary = {
  readonly actions: {
    readonly authOrTokenShaped: number;
    readonly highVolume: number;
    readonly internalOnly: number;
    readonly moderationShaped: number;
    readonly moneyShaped: number;
    readonly overlayEligibleByDefault: number;
  };
  readonly byPlatform: Readonly<Record<ProviderEventPlatform, number>>;
  readonly total: number;
};
