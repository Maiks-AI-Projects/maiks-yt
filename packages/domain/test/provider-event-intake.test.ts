import { describe, expect, it } from "vitest";

import { normalizeProviderEventIntake } from "../src/events/index.js";

describe("provider event intake normalization", () => {
  it("normalizes known provider events from the catalog", () => {
    const result = normalizeProviderEventIntake({
      mechanism: "twitch-eventsub",
      provider: "twitch",
      providerEventName: "channel.subscription.gift",
      redactedPayload: {
        total: 5
      },
      sourceEventId: "evt-1"
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        catalogKnown: true,
        category: "money",
        internalTrigger: "provider.twitch.eventsub.channel-subscription-gift",
        providerEventName: "channel.subscription.gift",
        safety: {
          moneyShaped: true,
          overlayEligibleByDefault: false
        },
        sourceEventId: "evt-1"
      }
    });
  });

  it("keeps unknown provider events internal and loggable", () => {
    const result = normalizeProviderEventIntake({
      mechanism: "discord-gateway",
      provider: "discord",
      providerEventName: "SOMETHING_NEW",
      redactedPayload: {
        id: "event-1"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        catalogKnown: false,
        category: "unknown",
        internalTrigger: "provider.discord.unknown.discord.gateway.something-new",
        safety: {
          internalOnly: true,
          overlayEligibleByDefault: false
        }
      }
    });
  });

  it("redacts secret-shaped payload fields and trims display fields", () => {
    const result = normalizeProviderEventIntake({
      actorDisplayName: ` ${"a".repeat(220)} `,
      mechanism: "youtube-live-chat",
      provider: "youtube",
      providerEventName: "textMessageEvent",
      redactedPayload: {
        accessToken: "secret-token",
        message: "hello",
        nested: {
          refresh_secret: "secret"
        }
      }
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        actorDisplayName: "a".repeat(191),
        redactedPayload: {
          accessToken: "[redacted]",
          message: "hello",
          nested: {
            refresh_secret: "[redacted]"
          }
        }
      }
    });
  });

  it("rejects empty event names and missing payloads", () => {
    expect(normalizeProviderEventIntake({
      mechanism: "twitch-irc",
      provider: "twitch",
      providerEventName: " ",
      redactedPayload: { id: "1" }
    })).toEqual({ ok: false, reason: "provider_event_name_required" });

    expect(normalizeProviderEventIntake({
      mechanism: "twitch-irc",
      provider: "twitch",
      providerEventName: "PRIVMSG"
    })).toEqual({ ok: false, reason: "redacted_payload_required" });
  });
});
