import { describe, expect, it } from "vitest";

import {
  reviewProviderIntakeForInternalEventRouting,
  resolveProviderIntakeEventKind,
  type ProviderIntakeEventRoutingReviewInput
} from "../src/events/index.js";

const baseInput = (overrides: Partial<ProviderIntakeEventRoutingReviewInput> = {}): ProviderIntakeEventRoutingReviewInput => ({
  authOrTokenShaped: false,
  catalogKnown: true,
  category: "community",
  highVolume: false,
  internalTrigger: "provider.twitch.eventsub.channel-follow",
  moderationShaped: false,
  moneyShaped: false,
  provider: "twitch",
  providerEventName: "channel.follow",
  ...overrides
});

describe("reviewProviderIntakeForInternalEventRouting", () => {
  it("maps known provider events to internal audit candidates", () => {
    expect(reviewProviderIntakeForInternalEventRouting(baseInput())).toEqual({
      candidate: {
        destination: "internal_audit",
        eventKind: "twitch.follow",
        publicRoutingAllowed: false,
        reason: "provider_intake_review_internal_only",
        routingOutcome: "stored_internal",
        sourcePlatform: "twitch"
      },
      ok: true
    });
  });

  it("maps chat and money-shaped provider events without making them public", () => {
    expect(reviewProviderIntakeForInternalEventRouting(baseInput({
      category: "chat",
      highVolume: true,
      internalTrigger: "provider.discord.gateway.message-create",
      provider: "discord",
      providerEventName: "MESSAGE_CREATE"
    }))).toMatchObject({
      candidate: {
        eventKind: "discord.message",
        destination: "internal_audit",
        publicRoutingAllowed: false
      },
      ok: true
    });

    expect(reviewProviderIntakeForInternalEventRouting(baseInput({
      category: "money",
      internalTrigger: "provider.youtube.live.chat.superchatevent",
      moneyShaped: true,
      provider: "youtube",
      providerEventName: "superChatEvent"
    }))).toMatchObject({
      candidate: {
        eventKind: "youtube.super-chat",
        destination: "internal_audit",
        publicRoutingAllowed: false
      },
      ok: true
    });
  });

  it("rejects unsafe or unmapped intake rows", () => {
    expect(reviewProviderIntakeForInternalEventRouting(baseInput({
      catalogKnown: false
    }))).toEqual({
      ok: false,
      reason: "provider_intake_review_unknown_catalog_event"
    });

    expect(reviewProviderIntakeForInternalEventRouting(baseInput({
      authOrTokenShaped: true
    }))).toEqual({
      ok: false,
      reason: "provider_intake_review_auth_or_token_shaped"
    });

    expect(reviewProviderIntakeForInternalEventRouting(baseInput({
      category: "interaction",
      highVolume: true,
      internalTrigger: "provider.discord.gateway.typing-start",
      provider: "discord",
      providerEventName: "TYPING_START"
    }))).toEqual({
      ok: false,
      reason: "provider_intake_review_high_volume"
    });

    expect(reviewProviderIntakeForInternalEventRouting(baseInput({
      category: "content",
      internalTrigger: "provider.youtube.activity.upload",
      provider: "youtube",
      providerEventName: "upload"
    }))).toEqual({
      ok: false,
      reason: "provider_intake_review_no_event_kind_mapping"
    });
  });

  it("does not turn a subscription-end notification into a subscription alert", () => {
    expect(resolveProviderIntakeEventKind(baseInput({
      category: "money",
      internalTrigger: "provider.twitch.eventsub.channel-subscription-end",
      moneyShaped: true,
      providerEventName: "channel.subscription.end"
    }))).toBeNull();
  });
});
