import { describe, expect, it } from "vitest";
import {
  buildStreamProviderDeliveryIdempotencyKey,
  buildStreamProviderDeliveryIntents,
  evaluateStreamProviderPreflight
} from "../src/schedule/stream-provider-delivery.rules.js";

describe("stream provider delivery rules", () => {
  it("builds stable provider-specific intents for one desired revision", () => {
    expect(buildStreamProviderDeliveryIntents({
      scheduleEntryId: " Schedule-1 ",
      channelRef: " Channel-1 ",
      provider: "youtube",
      desiredRevision: 3,
      phase: "schedule",
      visibility: "public",
      status: "planned"
    })).toEqual([
      {
        scheduleEntryId: "Schedule-1",
        channelRef: "Channel-1",
        provider: "youtube",
        operation: "youtube.broadcast",
        desiredRevision: 3,
        idempotencyKey: "stream-provider-delivery:schedule-1:channel-1:youtube.broadcast:3"
      }
    ]);
  });

  it("separates accepted schedule publication from launch preparation", () => {
    expect(buildStreamProviderDeliveryIntents({
      scheduleEntryId: "schedule-1",
      channelRef: "channel-1",
      provider: "twitch",
      desiredRevision: 2,
      phase: "schedule",
      visibility: "public",
      status: "planned"
    }).map((intent) => intent.operation)).toEqual(["twitch.schedule-segment"]);

    expect(buildStreamProviderDeliveryIntents({
      scheduleEntryId: "schedule-1",
      channelRef: "channel-1",
      provider: "twitch",
      desiredRevision: 2,
      phase: "prepare",
      visibility: "public",
      status: "planned"
    }).map((intent) => intent.operation)).toEqual(["twitch.channel-metadata"]);

    expect(buildStreamProviderDeliveryIntents({
      scheduleEntryId: "schedule-1",
      channelRef: "channel-1",
      provider: "youtube",
      desiredRevision: 2,
      phase: "prepare",
      visibility: "private",
      status: "planned"
    }).map((intent) => intent.operation)).toEqual(["youtube.stream-binding"]);
  });

  it("does not enqueue provider calls for drafts or terminal schedule states", () => {
    expect(buildStreamProviderDeliveryIntents({
      scheduleEntryId: "schedule-1",
      channelRef: "channel-1",
      provider: "youtube",
      desiredRevision: 1,
      phase: "schedule",
      visibility: "draft",
      status: "planned"
    })).toEqual([]);
    expect(buildStreamProviderDeliveryIntents({
      scheduleEntryId: "schedule-1",
      channelRef: "channel-1",
      provider: "twitch",
      desiredRevision: 2,
      phase: "prepare",
      visibility: "public",
      status: "cancelled"
    })).toEqual([]);
  });

  it("rejects empty identities and invalid revisions", () => {
    expect(() => buildStreamProviderDeliveryIdempotencyKey({
      scheduleEntryId: "",
      channelRef: "channel-1",
      operation: "twitch.channel-metadata",
      desiredRevision: 1
    })).toThrow("stream_provider_delivery_identity_required");
    expect(() => buildStreamProviderDeliveryIdempotencyKey({
      scheduleEntryId: "schedule-1",
      channelRef: "channel-1",
      operation: "twitch.channel-metadata",
      desiredRevision: 0
    })).toThrow("stream_provider_delivery_revision_invalid");
  });

  it("blocks Twitch preparation when the token owner or broadcast scope is wrong", () => {
    const result = evaluateStreamProviderPreflight({
      provider: "twitch",
      providerChannelId: "1531201792",
      consentConnected: true,
      tokenOwnerChannelId: "617410645",
      grantedScopes: ["channel:manage:schedule"],
      twitchScheduleSupported: true
    });

    expect(result.canPrepare).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual([
      "twitch-token-owner-mismatch",
      "twitch-broadcast-scope-missing"
    ]);
  });

  it("keeps Twitch metadata preparation available when scheduling is unsupported", () => {
    const result = evaluateStreamProviderPreflight({
      provider: "twitch",
      providerChannelId: "1531201792",
      consentConnected: true,
      tokenOwnerChannelId: "1531201792",
      grantedScopes: ["channel:manage:broadcast", "channel:manage:schedule"],
      twitchScheduleSupported: false
    });

    expect(result.canPrepare).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "twitch-one-off-schedule-unsupported",
        severity: "degraded",
        ownerActionRequired: false
      })
    ]);
  });

  it("reports YouTube consent as the only blocking preflight issue", () => {
    expect(evaluateStreamProviderPreflight({
      provider: "youtube",
      providerChannelId: "youtube-channel-1",
      consentConnected: false,
      tokenOwnerChannelId: null,
      grantedScopes: []
    })).toEqual({
      provider: "youtube",
      canPrepare: false,
      issues: [{
        code: "provider-consent-disconnected",
        severity: "blocking",
        message: "YouTube Owner consent is not connected.",
        ownerActionRequired: true
      }]
    });
  });
});
