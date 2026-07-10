import { describe, expect, it } from "vitest";

import {
  eventActionCatalog,
  getEventActionCatalogEntry,
  getProviderEventCatalogEntry,
  listProviderActionCapabilities,
  providerEventCatalog,
  summarizeProviderEventCatalog
} from "../src/events/index.js";

describe("provider event catalog", () => {
  it("covers key Twitch EventSub events across chat, money, moderation, stream, and auth", () => {
    expect(getProviderEventCatalogEntry("twitch", "channel.chat.message")).toMatchObject({
      category: "chat",
      mechanism: "twitch-eventsub",
      safety: {
        highVolume: true,
        overlayEligibleByDefault: false
      }
    });
    expect(getProviderEventCatalogEntry("twitch", "channel.subscription.gift")).toMatchObject({
      category: "money",
      safety: {
        moneyShaped: true,
        internalOnly: true
      }
    });
    expect(getProviderEventCatalogEntry("twitch", "channel.moderate.v2")).toMatchObject({
      category: "moderation",
      safety: {
        moderationShaped: true
      }
    });
    expect(getProviderEventCatalogEntry("twitch", "stream.online")).toMatchObject({
      category: "stream"
    });
    expect(getProviderEventCatalogEntry("twitch", "user.authorization.revoke")).toMatchObject({
      category: "auth",
      safety: {
        authOrTokenShaped: true,
        internalOnly: true
      }
    });
  });

  it("covers YouTube live chat, activity, and PubSubHubbub event sources", () => {
    expect(getProviderEventCatalogEntry("youtube", "textMessageEvent")).toMatchObject({
      mechanism: "youtube-live-chat",
      safety: {
        highVolume: true
      }
    });
    expect(getProviderEventCatalogEntry("youtube", "superChatEvent")).toMatchObject({
      category: "money",
      safety: {
        moneyShaped: true
      }
    });
    expect(getProviderEventCatalogEntry("youtube", "userBannedEvent")).toMatchObject({
      category: "moderation",
      safety: {
        moderationShaped: true
      }
    });
    expect(getProviderEventCatalogEntry("youtube", "upload")).toMatchObject({
      mechanism: "youtube-activity"
    });
    expect(getProviderEventCatalogEntry("youtube", "video.title.update")).toMatchObject({
      mechanism: "youtube-pubsub"
    });
  });

  it("covers Discord Gateway and Webhook events", () => {
    expect(getProviderEventCatalogEntry("discord", "MESSAGE_CREATE")).toMatchObject({
      category: "chat",
      mechanism: "discord-gateway",
      safety: {
        highVolume: true
      }
    });
    expect(getProviderEventCatalogEntry("discord", "GUILD_MEMBER_ADD")).toMatchObject({
      category: "community"
    });
    expect(getProviderEventCatalogEntry("discord", "AUTO_MODERATION_ACTION_EXECUTION")).toMatchObject({
      category: "moderation",
      safety: {
        moderationShaped: true
      }
    });
    expect(getProviderEventCatalogEntry("discord", "ENTITLEMENT_CREATE")).toMatchObject({
      category: "money"
    });
    expect(getProviderEventCatalogEntry("discord", "APPLICATION_DEAUTHORIZED")).toMatchObject({
      mechanism: "discord-webhook",
      safety: {
        authOrTokenShaped: true
      }
    });
  });

  it("keeps all provider events non-overlay by default", () => {
    expect(providerEventCatalog.length).toBeGreaterThan(150);
    expect(providerEventCatalog.every((catalogEntry) => !catalogEntry.safety.overlayEligibleByDefault)).toBe(true);

    const summary = summarizeProviderEventCatalog();
    expect(summary.total).toBe(providerEventCatalog.length);
    expect(summary.byPlatform).toMatchObject({
      discord: expect.any(Number),
      twitch: expect.any(Number),
      youtube: expect.any(Number)
    });
    expect(summary.actions.moneyShaped).toBeGreaterThan(10);
    expect(summary.actions.moderationShaped).toBeGreaterThan(10);
  });
});

describe("event action catalog", () => {
  it("separates currently enabled local actions from gated provider-write and money actions", () => {
    expect(getEventActionCatalogEntry("internal.log")).toMatchObject({
      safety: {
        enabledInCurrentPhase: true,
        providerWriteRequired: false
      }
    });
    expect(getEventActionCatalogEntry("provider.warn-in-origin-chat")).toMatchObject({
      safety: {
        enabledInCurrentPhase: false,
        moderationGated: true,
        providerWriteRequired: true
      }
    });
    expect(getEventActionCatalogEntry("money.review")).toMatchObject({
      safety: {
        enabledInCurrentPhase: false,
        moneyGated: true
      }
    });
    expect(eventActionCatalog.every((catalogEntry) => catalogEntry.safety.publicOutput
      ? catalogEntry.safety.requiresApprovalSupport
      : true)).toBe(true);
  });
});

describe("provider action capability matrix", () => {
  it("marks implemented provider writes fail-closed and keeps YouTube destructive actions gated", () => {
    const capabilities = listProviderActionCapabilities();

    expect(capabilities.filter((entry) => entry.actionKey === "provider.warn-in-origin-chat")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: "discord", status: "implemented-fail-closed" }),
        expect.objectContaining({ platform: "twitch", status: "implemented-fail-closed" }),
        expect.objectContaining({ platform: "youtube", requiresLiveContext: true, status: "implemented-fail-closed" })
      ])
    );
    expect(capabilities.filter((entry) => entry.actionKey === "provider.ban-origin-user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: "discord", status: "implemented-fail-closed" }),
        expect.objectContaining({ platform: "twitch", status: "implemented-fail-closed" }),
        expect.objectContaining({ platform: "youtube", status: "gated" })
      ])
    );
  });
});
