import { describe, expect, it } from "vitest";

import {
  buildDefaultEventRoutingRule,
  canManageEventRouting,
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
});
