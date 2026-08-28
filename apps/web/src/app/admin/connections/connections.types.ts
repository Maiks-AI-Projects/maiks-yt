export const connectionsSources = [
  "any",
  "twitch",
  "youtube",
  "discord",
  "website"
] as const;

export type ConnectionsSource = typeof connectionsSources[number];

export type Provider = Extract<ConnectionsSource, "twitch" | "youtube" | "discord">;

export type ProcessingStatus =
  | "stored"
  | "normalized"
  | "mapped_to_event_history"
  | "ignored"
  | "failed";

export type ProviderEventIntakeRow = {
  reviewRef: string;
  provider: Provider;
  mechanism: string;
  providerEventName: string;
  internalTrigger: string;
  category: string;
  catalogKnown: boolean;
  safetyFlags: {
    moneyShaped: boolean;
    moderationShaped: boolean;
    authOrTokenShaped: boolean;
    highVolume: boolean;
  };
  overlayEligibleByDefault: false;
  processingStatus: ProcessingStatus;
  reviewable: boolean;
  safeSummary: string;
  occurredAt: string | null;
  receivedAt: string;
};

export type ProviderIntakeHealthStatus = "healthy" | "stale" | "missing";

export type ProviderIntakeHealthEntry = {
  provider: Provider;
  mechanism: string;
  label: string;
  lastProviderEventName: string | null;
  lastReceivedAt: string | null;
  rowCount: number;
  status: ProviderIntakeHealthStatus;
};
