import { describe, expect, it } from "vitest";

import type {
  EventRoutingDestinationCapability,
  EventRoutingOncePerStreamAvailability,
  EventRoutingRuleInput,
  EventRoutingRuleValidationResult,
  EventRoutingSafety
} from "@maiks-yt/domain/events";

import {
  canTurnOnOncePerStream,
  getAdminDestinationCapability,
  getAdminDestinationOptions,
  getAdminFormValidation,
  getLiveOfflineControlCopy,
  getOncePerStreamCopy,
  getSavedLegacyDisplayValues,
  getValidProductionOverrideSources
} from "./event-routing-admin.rules";

const capabilities: readonly EventRoutingDestinationCapability[] = [
  {
    destination: "ignore",
    runtimeConsumer: "not_required",
    supportsPriority: false,
    supportsTemplate: false,
    supportsTheme: false,
    supportsSound: false
  },
  {
    destination: "top_notification",
    runtimeConsumer: "available",
    supportsPriority: true,
    supportsTemplate: false,
    supportsTheme: false,
    supportsSound: true
  },
  {
    destination: "control_panel",
    runtimeConsumer: "unavailable",
    supportsPriority: false,
    supportsTemplate: false,
    supportsTheme: false,
    supportsSound: false
  }
];

const rule = (overrides: Partial<EventRoutingRuleInput> = {}): EventRoutingRuleInput => ({
  eventKind: "website.signup",
  sourcePlatform: "any",
  destination: "ignore",
  enabled: false,
  liveOnly: false,
  offlineOnly: false,
  approvalRequired: true,
  perUserCooldownSeconds: null,
  globalCooldownSeconds: 60,
  oncePerStream: false,
  templateKey: null,
  themeKey: null,
  soundKey: null,
  notificationPriority: "normal",
  ...overrides
});

const safety: EventRoutingSafety = {
  overlayEligible: true,
  internalOnly: false,
  moneyGated: false,
  providerGated: false,
  approvalRecommended: true,
  optOutSupported: true,
  cooldownRecommended: true,
  simulatedOnly: false
};

const validServerValidation: EventRoutingRuleValidationResult = {
  ok: true,
  issues: [],
  requiresUserOptOutCheck: false,
  requiresCooldownCheck: false,
  requiresApprovalByDefault: true
};

const savedRule = (
  ruleOverrides: Partial<EventRoutingRuleInput> = {},
  metadataOverrides: Partial<{
    persisted: boolean;
    safety: EventRoutingSafety;
    validation: EventRoutingRuleValidationResult;
    oncePerStreamAvailability: EventRoutingOncePerStreamAvailability;
  }> = {}
) => ({
  ...rule(ruleOverrides),
  persisted: true,
  safety,
  validation: validServerValidation,
  oncePerStreamAvailability: {
    supported: false,
    reason: "website_stream_state_unavailable" as const
  },
  ...metadataOverrides
});

describe("event routing admin client rules", () => {
  it("uses server-returned destination capabilities and keeps missing destinations fail-closed", () => {
    expect(getAdminDestinationOptions(capabilities)).toEqual([
      "ignore",
      "top_notification",
      "control_panel"
    ]);
    expect(getAdminDestinationCapability(capabilities, "top_notification")).toMatchObject({
      runtimeConsumer: "available",
      supportsPriority: true,
      supportsTemplate: false,
      supportsTheme: false,
      supportsSound: true
    });
    expect(getAdminDestinationCapability(capabilities, "streamer_chat")).toEqual({
      destination: "streamer_chat",
      runtimeConsumer: "unavailable",
      supportsPriority: false,
      supportsTemplate: false,
      supportsTheme: false,
      supportsSound: false
    });
  });

  it("uses server validation unchanged for the initial form state", () => {
    const serverValidation: EventRoutingRuleValidationResult = {
      ...validServerValidation,
      ok: false,
      issues: ["event_routing_source_cannot_emit_event"]
    };
    const baseline = savedRule({}, { validation: serverValidation });

    expect(getAdminFormValidation({
      formRule: rule(),
      savedRule: baseline,
      destinationCapabilities: []
    })).toBe(serverValidation);
  });

  it("validates dirty forms from received capabilities and fails closed when metadata is missing", () => {
    const baseline = savedRule();

    expect(getAdminFormValidation({
      formRule: rule({
        destination: "control_panel",
        enabled: true,
        approvalRequired: false
      }),
      savedRule: baseline,
      destinationCapabilities: capabilities
    }).issues).toContain("event_routing_enabled_destination_unavailable");

    expect(getAdminFormValidation({
      formRule: rule({
        destination: "center_notification",
        approvalRequired: false
      }),
      savedRule: baseline,
      destinationCapabilities: capabilities
    }).issues).toContain("event_routing_invalid_destination");
  });

  it("preserves saved legacy display values but rejects new unsupported values", () => {
    const legacy = savedRule({
      destination: "top_notification",
      templateKey: "legacy-template",
      themeKey: "legacy-theme"
    });

    expect(getAdminFormValidation({
      formRule: { ...rule(legacy), approvalRequired: false },
      savedRule: legacy,
      destinationCapabilities: capabilities
    }).ok).toBe(true);
    expect(getAdminFormValidation({
      formRule: { ...rule(legacy), templateKey: "new-template" },
      savedRule: legacy,
      destinationCapabilities: capabilities
    }).issues).toContain("event_routing_unsupported_template");

    const unsaved = savedRule({}, { persisted: false });
    expect(getAdminFormValidation({
      formRule: { ...rule(unsaved), themeKey: "new-theme" },
      savedRule: unsaved,
      destinationCapabilities: capabilities
    }).issues).toContain("event_routing_unsupported_theme");
  });

  it("applies server safety metadata when a dirty form selects a public destination", () => {
    const baseline = savedRule({}, {
      safety: { ...safety, internalOnly: true, overlayEligible: false }
    });
    const validation = getAdminFormValidation({
      formRule: rule({
        destination: "top_notification",
        enabled: true,
        approvalRequired: false
      }),
      savedRule: baseline,
      destinationCapabilities: capabilities
    });

    expect(validation.issues).toEqual(expect.arrayContaining([
      "event_routing_internal_only_public_destination",
      "event_routing_overlay_ineligible_public_destination",
      "event_routing_internal_only_enabled_public_destination"
    ]));
  });

  it("separates provider and website live/offline copy while the admin control stays disabled", () => {
    expect(getLiveOfflineControlCopy(rule({
      eventKind: "twitch.follow",
      sourcePlatform: "any"
    }))).toContain("Provider rules enforce known broadcaster state fail-closed");
    expect(getLiveOfflineControlCopy(rule({
      eventKind: "website.schedule-changed",
      sourcePlatform: "website"
    }))).toContain("Website rules block live/offline until authoritative website stream state exists");
    expect(getLiveOfflineControlCopy(rule())).toContain("not yet enabled or rehearsed");
  });

  it("keeps once-per-stream unavailable copy honest for provider rules", () => {
    const providerUnavailable: EventRoutingOncePerStreamAvailability = {
      supported: false,
      reason: "provider_stream_session_identity_unavailable"
    };
    const scheduleAvailable: EventRoutingOncePerStreamAvailability = {
      supported: true,
      reason: "website_schedule_identity_available"
    };

    expect(getOncePerStreamCopy(providerUnavailable)).toContain("Unavailable for provider rules");
    expect(getOncePerStreamCopy(scheduleAvailable)).toContain("Available for website schedule rules");
    expect(canTurnOnOncePerStream(providerUnavailable, false)).toBe(false);
    expect(canTurnOnOncePerStream(providerUnavailable, true)).toBe(true);
    expect(canTurnOnOncePerStream(scheduleAvailable, false)).toBe(true);

    const providerRule = savedRule({
      eventKind: "twitch.follow",
      sourcePlatform: "twitch"
    }, { oncePerStreamAvailability: providerUnavailable });
    expect(getAdminFormValidation({
      formRule: { ...rule(providerRule), oncePerStream: true },
      savedRule: providerRule,
      destinationCapabilities: capabilities
    }).issues).toContain("event_routing_unsupported_once_per_stream");

    const scheduleRule = savedRule({
      eventKind: "website.schedule-changed",
      sourcePlatform: "website"
    }, { oncePerStreamAvailability: scheduleAvailable });
    expect(getAdminFormValidation({
      formRule: { ...rule(scheduleRule), oncePerStream: true },
      savedRule: scheduleRule,
      destinationCapabilities: capabilities
    }).ok).toBe(true);
  });

  it("shows saved legacy template and theme values without making them new editable fields", () => {
    expect(getSavedLegacyDisplayValues(rule())).toEqual([]);
    expect(getSavedLegacyDisplayValues(rule({
      templateKey: "legacy-template",
      themeKey: "legacy-theme"
    }))).toEqual([
      { label: "Template", value: "legacy-template" },
      { label: "Theme", value: "legacy-theme" }
    ]);
  });

  it("keeps real source-specific override options visible while excluding test/system", () => {
    expect(getValidProductionOverrideSources("chat")).toEqual(["twitch", "youtube"]);
    expect(getValidProductionOverrideSources("discord.message")).toEqual(["discord"]);
    expect(getValidProductionOverrideSources("website.schedule-changed")).toEqual(["website"]);
  });
});
