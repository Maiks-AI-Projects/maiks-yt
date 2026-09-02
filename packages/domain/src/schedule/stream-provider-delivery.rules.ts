import type {
  StreamProviderCapabilityInput,
  StreamProviderDeliveryIntent,
  StreamProviderDeliveryOperation,
  StreamProviderPreflightIssue,
  StreamProviderPreflightResult
} from "./stream-provider-delivery.types.js";

const twitchBroadcastScope = "channel:manage:broadcast";
const twitchScheduleScope = "channel:manage:schedule";

const cleanKeyPart = (value: string): string => value.trim().toLocaleLowerCase("en");

export const buildStreamProviderDeliveryIdempotencyKey = (input: {
  scheduleEntryId: string;
  channelRef: string;
  operation: StreamProviderDeliveryOperation;
  desiredRevision: number;
}): string => {
  if (!input.scheduleEntryId.trim() || !input.channelRef.trim()) {
    throw new Error("stream_provider_delivery_identity_required");
  }
  if (!Number.isSafeInteger(input.desiredRevision) || input.desiredRevision < 1) {
    throw new Error("stream_provider_delivery_revision_invalid");
  }

  return [
    "stream-provider-delivery",
    cleanKeyPart(input.scheduleEntryId),
    cleanKeyPart(input.channelRef),
    input.operation,
    String(input.desiredRevision)
  ].join(":");
};

export const buildStreamProviderDeliveryIntents = (input: {
  scheduleEntryId: string;
  channelRef: string;
  provider: "twitch" | "youtube";
  desiredRevision: number;
}): readonly StreamProviderDeliveryIntent[] => {
  const scheduleEntryId = input.scheduleEntryId.trim();
  const channelRef = input.channelRef.trim();
  const operations: readonly StreamProviderDeliveryOperation[] = input.provider === "twitch"
    ? ["twitch.schedule-segment", "twitch.channel-metadata"]
    : ["youtube.broadcast", "youtube.stream-binding"];

  return operations.map((operation) => ({
    scheduleEntryId,
    channelRef,
    provider: input.provider,
    desiredRevision: input.desiredRevision,
    operation,
    idempotencyKey: buildStreamProviderDeliveryIdempotencyKey({
      scheduleEntryId,
      channelRef,
      operation,
      desiredRevision: input.desiredRevision
    })
  }));
};

const issue = (
  code: string,
  severity: StreamProviderPreflightIssue["severity"],
  message: string,
  ownerActionRequired: boolean
): StreamProviderPreflightIssue => ({ code, severity, message, ownerActionRequired });

export const evaluateStreamProviderPreflight = (
  input: StreamProviderCapabilityInput
): StreamProviderPreflightResult => {
  const issues: StreamProviderPreflightIssue[] = [];

  if (!input.consentConnected) {
    issues.push(issue(
      "provider-consent-disconnected",
      "blocking",
      `${input.provider === "youtube" ? "YouTube" : "Twitch"} Owner consent is not connected.`,
      true
    ));
  }

  if (input.provider === "twitch") {
    if (input.tokenOwnerChannelId !== input.providerChannelId) {
      issues.push(issue(
        "twitch-token-owner-mismatch",
        "blocking",
        "The Twitch user token does not belong to this broadcaster.",
        true
      ));
    }
    if (!input.grantedScopes.includes(twitchBroadcastScope)) {
      issues.push(issue(
        "twitch-broadcast-scope-missing",
        "blocking",
        `Twitch consent is missing ${twitchBroadcastScope}.`,
        true
      ));
    }
    if (!input.grantedScopes.includes(twitchScheduleScope)) {
      issues.push(issue(
        "twitch-schedule-scope-missing",
        "degraded",
        `Twitch consent is missing ${twitchScheduleScope}; channel metadata can still be prepared.`,
        true
      ));
    } else if (input.twitchScheduleSupported === false) {
      issues.push(issue(
        "twitch-one-off-schedule-unsupported",
        "degraded",
        "This Twitch channel cannot create a non-recurring schedule segment; channel metadata can still be prepared.",
        false
      ));
    }
  }

  return {
    provider: input.provider,
    canPrepare: !issues.some((entry) => entry.severity === "blocking"),
    issues
  };
};
