import type { StreamScheduleChannelProvider } from "./stream-schedule.types.js";

export const streamProviderDeliveryStatuses = [
  "pending",
  "syncing",
  "ready",
  "degraded",
  "failed",
  "removed"
] as const;

export const streamProviderDeliveryOperations = [
  "twitch.schedule-segment",
  "twitch.channel-metadata",
  "youtube.broadcast",
  "youtube.stream-binding"
] as const;

export type StreamProviderDeliveryStatus = typeof streamProviderDeliveryStatuses[number];
export type StreamProviderDeliveryOperation = typeof streamProviderDeliveryOperations[number];
export type StreamProviderDeliveryPhase = "schedule" | "prepare";

export type StreamProviderDeliveryBinding = {
  id: string;
  scheduleEntryId: string;
  channelRef: string;
  provider: StreamScheduleChannelProvider;
  providerChannelIdSnapshot: string;
  displayNameSnapshot: string;
  handleSnapshot: string | null;
  desiredRevision: number;
  status: StreamProviderDeliveryStatus;
  providerResourceId: string | null;
  providerStreamId: string | null;
  providerCategoryId: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type StreamProviderDeliveryIntent = {
  scheduleEntryId: string;
  channelRef: string;
  provider: StreamScheduleChannelProvider;
  operation: StreamProviderDeliveryOperation;
  desiredRevision: number;
  idempotencyKey: string;
};

export type StreamProviderCapabilityInput = {
  provider: StreamScheduleChannelProvider;
  providerChannelId: string;
  consentConnected: boolean;
  tokenOwnerChannelId: string | null;
  grantedScopes: readonly string[];
  twitchScheduleSupported?: boolean | null;
};

export type StreamProviderPreflightIssue = {
  code: string;
  severity: "blocking" | "degraded";
  message: string;
  ownerActionRequired: boolean;
};

export type StreamProviderPreflightResult = {
  provider: StreamScheduleChannelProvider;
  canPrepare: boolean;
  issues: readonly StreamProviderPreflightIssue[];
};
