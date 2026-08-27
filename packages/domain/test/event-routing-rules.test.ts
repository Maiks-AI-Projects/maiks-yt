import { describe, expect, it } from "vitest";

import {
  buildDefaultEventRoutingRule,
  buildStreamVisibilityPreferenceValues,
  canManageEventRouting,
  eventRoutingDestinationCapabilities,
  getRecommendedEventRoutingSoundRefs,
  getEventRoutingDestinationCapability,
  resolveSafeSimulatedEventRoutingDecision,
  resolveEventRoutingSound,
  streamVisibilityPreferenceScopes,
  validateSafeSimulatedEventRoutingDispatch,
  validateEventRoutingRule,
  type EventRoutingRuleInput
} from "../src/events/index.js";

const validRule = (overrides: Partial<EventRoutingRuleInput> = {}): EventRoutingRuleInput => ({
  eventKind: "website.signup",
  sourcePlatform: "website",
  destination: "internal_audit",
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

describe("event routing rule validation", () => {
  it("builds disabled defaults from the typed event registry", () => {
    expect(buildDefaultEventRoutingRule("website.signup")).toMatchObject({
      eventKind: "website.signup",
      sourcePlatform: "any",
      destination: "ignore",
      enabled: false,
      approvalRequired: true,
      globalCooldownSeconds: 60
    });
    expect(buildDefaultEventRoutingRule("website.provider-token-change")).toMatchObject({
      destination: "internal_audit",
      enabled: false,
      approvalRequired: false
    });
  });

  it("accepts owner-managed internal rules and wildcard permissions", () => {
    expect(validateEventRoutingRule(validRule())).toMatchObject({
      ok: true,
      issues: []
    });
    expect(canManageEventRouting(["event-routing:manage"])).toBe(true);
    expect(canManageEventRouting(["*"])).toBe(true);
    expect(canManageEventRouting(["creator-links:manage"])).toBe(false);
  });

  it("rejects impossible provider and event combinations", () => {
    expect(validateEventRoutingRule(validRule({
      eventKind: "twitch.follow",
      sourcePlatform: "discord"
    })).issues).toContain("event_routing_source_cannot_emit_event");
    expect(validateEventRoutingRule(validRule({
      eventKind: "twitch.follow",
      sourcePlatform: "test/system"
    })).ok).toBe(true);
  });

  it("rejects live/offline conflicts and negative cooldowns", () => {
    const result = validateEventRoutingRule(validRule({
      liveOnly: true,
      offlineOnly: true,
      perUserCooldownSeconds: -1,
      globalCooldownSeconds: -5
    }));

    expect(result.issues).toEqual(expect.arrayContaining([
      "event_routing_live_offline_conflict",
      "event_routing_negative_per_user_cooldown",
      "event_routing_negative_global_cooldown"
    ]));
  });

  it("blocks internal-only events from public overlay destinations", () => {
    const result = validateEventRoutingRule(validRule({
      eventKind: "website.provider-token-change",
      sourcePlatform: "website",
      destination: "top_notification",
      enabled: true
    }));

    expect(result.issues).toEqual(expect.arrayContaining([
      "event_routing_internal_only_public_destination",
      "event_routing_overlay_ineligible_public_destination",
      "event_routing_internal_only_enabled_public_destination"
    ]));
  });

  it("marks stream-visible website profile events as opt-out and cooldown aware", () => {
    expect(validateEventRoutingRule(validRule({
      eventKind: "website.profile-image-update",
      destination: "center_notification"
    }))).toMatchObject({
      ok: true,
      requiresUserOptOutCheck: true,
      requiresCooldownCheck: true,
      requiresApprovalByDefault: true
    });
  });

  it("declares honest runtime and rendering capabilities for every destination", () => {
    expect(eventRoutingDestinationCapabilities).toHaveLength(8);
    expect(getEventRoutingDestinationCapability("control_panel")).toMatchObject({
      runtimeConsumer: "unavailable",
      supportsPriority: false,
      supportsSound: false
    });
    expect(getEventRoutingDestinationCapability("top_notification")).toMatchObject({
      runtimeConsumer: "available",
      supportsPriority: true,
      supportsTemplate: true,
      supportsTheme: true,
      supportsSound: true
    });
    expect(getEventRoutingDestinationCapability("center_notification").supportsSound).toBe(true);
    expect(eventRoutingDestinationCapabilities
      .filter((capability) => capability.supportsSound)
      .map((capability) => capability.destination))
      .toEqual(["top_notification", "center_notification"]);
  });

  it("rejects unavailable consumers and destination inputs that cannot be consumed", () => {
    expect(validateEventRoutingRule(validRule({
      destination: "control_panel",
      enabled: true
    })).issues).toContain("event_routing_enabled_destination_unavailable");

    const unsupported = validateEventRoutingRule(validRule({
      destination: "internal_audit",
      notificationPriority: "high",
      templateKey: "template",
      themeKey: "theme",
      soundKey: "sound"
    }));

    expect(unsupported.issues).toEqual(expect.arrayContaining([
      "event_routing_unsupported_priority",
      "event_routing_unsupported_template",
      "event_routing_unsupported_theme",
      "event_routing_unsupported_sound"
    ]));
  });

  it("allowlists event routing sound refs for top and center notifications only", () => {
    expect(validateEventRoutingRule(validRule({
      destination: "top_notification",
      soundKey: "follow-creaky-door"
    })).ok).toBe(true);
    expect(validateEventRoutingRule(validRule({
      destination: "center_notification",
      soundKey: "raid-broken-radio"
    })).ok).toBe(true);
    expect(validateEventRoutingRule(validRule({
      destination: "top_notification",
      soundKey: "https://example.test/sound.wav"
    })).issues).toContain("event_routing_unsupported_sound");
    expect(validateEventRoutingRule(validRule({
      destination: "internal_audit",
      soundKey: "follow-creaky-door"
    })).issues).toContain("event_routing_unsupported_sound");
  });

  it("recommends the first production Event Routing sound slice without forcing routing", () => {
    expect(getRecommendedEventRoutingSoundRefs("twitch.follow")).toEqual(["follow-creaky-door"]);
    expect(getRecommendedEventRoutingSoundRefs("twitch.sub")).toEqual(["sub-key-in-lock", "gift-sub-metal-door"]);
    expect(getRecommendedEventRoutingSoundRefs("twitch.bits")).toEqual(["bits-loot-unlock"]);
    expect(getRecommendedEventRoutingSoundRefs("twitch.raid")).toEqual(["raid-broken-radio"]);
    expect(getRecommendedEventRoutingSoundRefs("twitch.redeem")).toEqual(["redeem-digital-interference"]);
    expect(getRecommendedEventRoutingSoundRefs("chat")).toEqual(["chat-radio-ping"]);
    expect(resolveEventRoutingSound("follow-creaky-door")).toEqual({
      ref: "follow-creaky-door",
      url: "/event-sounds/02-standard-alerts/follow-creaky-door.wav",
      volume: 0.28
    });
    expect(resolveEventRoutingSound(null)).toBeNull();
    expect(resolveEventRoutingSound("../secrets.wav")).toBeNull();
  });

  it("builds user stream visibility preference values with safe missing-row defaults", () => {
    expect(streamVisibilityPreferenceScopes).toEqual([
      "all_stream_visible_website_events",
      "website.signup",
      "website.username-change",
      "website.profile-image-update",
      "website.free-tts-request"
    ]);

    expect(buildStreamVisibilityPreferenceValues([
      {
        scope: "all_stream_visible_website_events",
        optedOut: true
      },
      {
        scope: "website.profile-image-update",
        optedOut: true
      }
    ])).toEqual([
      expect.objectContaining({
        scope: "all_stream_visible_website_events",
        optedOut: true
      }),
      expect.objectContaining({
        scope: "website.signup",
        optedOut: false
      }),
      expect.objectContaining({
        scope: "website.username-change",
        optedOut: false
      }),
      expect.objectContaining({
        scope: "website.profile-image-update",
        optedOut: true
      }),
      expect.objectContaining({
        scope: "website.free-tts-request",
        optedOut: false
      })
    ]);
  });

  it("rejects real provider, real website, and real money dispatch inputs", () => {
    expect(validateSafeSimulatedEventRoutingDispatch({
      sourcePlatform: "twitch",
      eventKind: "twitch.follow",
      explicitSimulation: false,
      isRealMoney: false
    })).toMatchObject({
      ok: false,
      issues: ["event_routing_dispatch_real_provider_rejected"]
    });

    expect(validateSafeSimulatedEventRoutingDispatch({
      sourcePlatform: "website",
      eventKind: "website.signup",
      explicitSimulation: false,
      isRealMoney: false
    })).toMatchObject({
      ok: false,
      issues: ["event_routing_dispatch_real_website_rejected"]
    });

    expect(validateSafeSimulatedEventRoutingDispatch({
      sourcePlatform: "test/system",
      eventKind: "simulated.support-money",
      explicitSimulation: false,
      isRealMoney: true
    })).toMatchObject({
      ok: false,
      issues: ["event_routing_dispatch_real_money_rejected"]
    });
  });

  it("resolves approval-required simulated events to queued state", () => {
    expect(resolveSafeSimulatedEventRoutingDecision({
      dispatch: {
        sourcePlatform: "website",
        eventKind: "website.signup",
        explicitSimulation: true,
        isRealMoney: false
      },
      rule: validRule({
        destination: "top_notification",
        enabled: true,
        approvalRequired: true
      })
    })).toMatchObject({
      ok: true,
      routingOutcome: "queued_for_approval",
      destination: "top_notification",
      requiresApprovalQueue: true,
      requiresUserOptOutCheck: true
    });
  });
});
