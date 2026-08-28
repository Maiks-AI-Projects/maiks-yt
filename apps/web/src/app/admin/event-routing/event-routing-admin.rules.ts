import {
  getEventRegistryEntry,
  type EventKind,
  type EventRoutingDestination,
  type EventRoutingDestinationCapability,
  type EventRoutingOncePerStreamAvailability,
  type EventRoutingRuleInput,
  type EventRoutingRuleSourcePlatform,
  type EventRoutingRuleValidationIssue,
  type EventRoutingRuleValidationResult,
  type EventRoutingSafety
} from "@maiks-yt/domain/events";

export type AdminRuleCapabilityInput = Pick<EventRoutingRuleInput, "eventKind" | "sourcePlatform">;

const unavailableDestinationCapability = (
  destination: EventRoutingDestination
): EventRoutingDestinationCapability => ({
  destination,
  runtimeConsumer: "unavailable",
  supportsPriority: false,
  supportsTemplate: false,
  supportsTheme: false,
  supportsSound: false
});

export const getAdminDestinationCapability = (
  capabilities: readonly EventRoutingDestinationCapability[],
  destination: EventRoutingDestination
): EventRoutingDestinationCapability =>
  capabilities.find((capability) => capability.destination === destination)
  ?? unavailableDestinationCapability(destination);

export const getAdminDestinationOptions = (
  capabilities: readonly EventRoutingDestinationCapability[]
): readonly EventRoutingDestination[] => capabilities.map((capability) => capability.destination);

export type EventRoutingAdminFormBaseline = EventRoutingRuleInput & {
  persisted: boolean;
  safety: EventRoutingSafety;
  validation: EventRoutingRuleValidationResult;
  oncePerStreamAvailability: EventRoutingOncePerStreamAvailability;
};

const streamVisibleDestinations = new Set<EventRoutingDestination>([
  "top_notification",
  "center_notification",
  "streamer_feed",
  "streamer_chat",
  "approval_queue"
]);

const ruleInputKeys = [
  "eventKind",
  "sourcePlatform",
  "destination",
  "enabled",
  "liveOnly",
  "offlineOnly",
  "approvalRequired",
  "perUserCooldownSeconds",
  "globalCooldownSeconds",
  "oncePerStream",
  "templateKey",
  "themeKey",
  "soundKey",
  "notificationPriority"
] as const satisfies readonly (keyof EventRoutingRuleInput)[];

const isSameRuleInput = (
  left: EventRoutingRuleInput,
  right: EventRoutingRuleInput
): boolean => ruleInputKeys.every((key) => left[key] === right[key]);

export const getAdminFormValidation = (input: {
  formRule: EventRoutingRuleInput;
  savedRule: EventRoutingAdminFormBaseline;
  destinationCapabilities: readonly EventRoutingDestinationCapability[];
}): EventRoutingRuleValidationResult => {
  const { formRule, savedRule, destinationCapabilities } = input;

  if (isSameRuleInput(formRule, savedRule)) {
    return savedRule.validation;
  }

  const issues: EventRoutingRuleValidationIssue[] = [];
  const addIssue = (issue: EventRoutingRuleValidationIssue): void => {
    if (!issues.includes(issue)) issues.push(issue);
  };
  const capability = destinationCapabilities.find(
    (item) => item.destination === formRule.destination
  );
  const isStreamVisible = streamVisibleDestinations.has(formRule.destination);
  const samePersistedDestination = savedRule.persisted
    && savedRule.destination === formRule.destination;

  for (const issue of savedRule.validation.issues) {
    if (issue === "event_routing_invalid_source"
      || issue === "event_routing_production_catalogue_forbidden"
      || issue === "event_routing_source_cannot_emit_event") {
      addIssue(issue);
    }
    if (issue === "event_routing_invalid_priority"
      && savedRule.notificationPriority === formRule.notificationPriority) {
      addIssue(issue);
    }
    if (issue === "event_routing_unsupported_sound"
      && savedRule.destination === formRule.destination
      && savedRule.soundKey === formRule.soundKey) {
      addIssue(issue);
    }
  }

  if (formRule.eventKind !== savedRule.eventKind || formRule.sourcePlatform !== savedRule.sourcePlatform) {
    addIssue("event_routing_invalid_source");
  }
  if (!capability) addIssue("event_routing_invalid_destination");
  if (formRule.liveOnly && formRule.offlineOnly) addIssue("event_routing_live_offline_conflict");
  if (formRule.perUserCooldownSeconds !== null
    && (!Number.isFinite(formRule.perUserCooldownSeconds) || formRule.perUserCooldownSeconds < 0)) {
    addIssue("event_routing_negative_per_user_cooldown");
  }
  if (formRule.globalCooldownSeconds !== null
    && (!Number.isFinite(formRule.globalCooldownSeconds) || formRule.globalCooldownSeconds < 0)) {
    addIssue("event_routing_negative_global_cooldown");
  }
  if (formRule.oncePerStream && !savedRule.oncePerStreamAvailability.supported) {
    addIssue("event_routing_unsupported_once_per_stream");
  }

  if (capability) {
    if (formRule.enabled && capability.runtimeConsumer === "unavailable") {
      addIssue("event_routing_enabled_destination_unavailable");
    }
    if (!capability.supportsPriority && formRule.notificationPriority !== "normal") {
      addIssue("event_routing_unsupported_priority");
    }
    if (!capability.supportsTemplate && formRule.templateKey !== null
      && !(samePersistedDestination && formRule.templateKey === savedRule.templateKey)) {
      addIssue("event_routing_unsupported_template");
    }
    if (!capability.supportsTheme && formRule.themeKey !== null
      && !(samePersistedDestination && formRule.themeKey === savedRule.themeKey)) {
      addIssue("event_routing_unsupported_theme");
    }
    if (!capability.supportsSound && formRule.soundKey !== null) {
      addIssue("event_routing_unsupported_sound");
    }
  }

  if (isStreamVisible) {
    if (savedRule.safety.internalOnly) addIssue("event_routing_internal_only_public_destination");
    if (!savedRule.safety.overlayEligible) addIssue("event_routing_overlay_ineligible_public_destination");
    if (formRule.enabled && savedRule.safety.internalOnly) {
      addIssue("event_routing_internal_only_enabled_public_destination");
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    requiresUserOptOutCheck: savedRule.safety.optOutSupported && isStreamVisible,
    requiresCooldownCheck: savedRule.safety.cooldownRecommended && isStreamVisible,
    requiresApprovalByDefault: savedRule.validation.requiresApprovalByDefault
  };
};

export const isProviderRule = (rule: AdminRuleCapabilityInput): boolean => {
  if (rule.sourcePlatform === "twitch" || rule.sourcePlatform === "youtube" || rule.sourcePlatform === "discord") {
    return true;
  }

  if (rule.sourcePlatform !== "any") {
    return false;
  }

  return getEventRegistryEntry(rule.eventKind).sourcePlatforms.some((sourcePlatform) =>
    sourcePlatform === "twitch" || sourcePlatform === "youtube" || sourcePlatform === "discord"
  );
};

export const getLiveOfflineControlCopy = (rule: AdminRuleCapabilityInput): string =>
  isProviderRule(rule)
    ? "Provider rules enforce known broadcaster state fail-closed; this admin control is not yet enabled or rehearsed."
    : "Website rules block live/offline until authoritative website stream state exists; this admin control is not yet enabled or rehearsed.";

export const getOncePerStreamCopy = (
  availability: EventRoutingOncePerStreamAvailability
): string => {
  if (availability.supported) {
    return "Available for website schedule rules because schedule identity is stable.";
  }

  if (availability.reason === "provider_stream_session_identity_unavailable") {
    return "Unavailable for provider rules until authoritative stream-session identity exists.";
  }

  if (availability.reason === "website_stream_state_unavailable") {
    return "Unavailable until authoritative website stream state exists for this event kind.";
  }

  return "Unavailable because this event kind has no stable stream identity.";
};

export const canTurnOnOncePerStream = (
  availability: EventRoutingOncePerStreamAvailability,
  currentValue: boolean
): boolean => availability.supported || currentValue;

export const getSavedLegacyDisplayValues = (
  selectedRule: Pick<EventRoutingRuleInput, "templateKey" | "themeKey">
): Array<{
  label: "Template" | "Theme";
  value: string;
}> => [
  selectedRule.templateKey ? { label: "Template", value: selectedRule.templateKey } : null,
  selectedRule.themeKey ? { label: "Theme", value: selectedRule.themeKey } : null
].filter((item): item is { label: "Template" | "Theme"; value: string } => item !== null);

export type ProductionSourcePlatform = Exclude<EventRoutingRuleSourcePlatform, "test/system">;

export const getValidProductionOverrideSources = (
  eventKind: EventKind
): readonly Exclude<ProductionSourcePlatform, "any">[] =>
  getEventRegistryEntry(eventKind).sourcePlatforms.filter(
    (sourcePlatform): sourcePlatform is Exclude<ProductionSourcePlatform, "any"> =>
      sourcePlatform !== "test/system"
  );
