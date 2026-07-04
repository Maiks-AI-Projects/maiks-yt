import type { NormalizedProviderEventIntake } from "@maiks-yt/domain/events";
import type {
  DiscordChatProjectedMessage,
  TwitchChatProjectedMessage,
  YouTubeLiveChatProjectedMessage
} from "@maiks-yt/integrations";
import { describe, expect, it } from "vitest";

import { ProviderEventIntakeLogService } from "../../src/provider-integrations/provider-event-intake-log.service.js";
import type { ProviderEventIntakeLogRepository } from "../../src/provider-integrations/provider-event-intake-log.types.js";

class FakeProviderEventIntakeLogRepository implements ProviderEventIntakeLogRepository {
  public readonly writes: NormalizedProviderEventIntake[] = [];
  public shouldThrow = false;

  public async write(input: NormalizedProviderEventIntake): Promise<{ inserted: boolean }> {
    if (this.shouldThrow) {
      throw new Error("database unavailable with secret-token-value");
    }

    this.writes.push(structuredClone(input));
    return { inserted: true };
  }
}

const fixedNow = new Date("2026-07-04T16:00:00.000Z");

describe("ProviderEventIntakeLogService", () => {
  it("records Twitch chat as a pre-routing Twitch IRC event", async () => {
    const repository = new FakeProviderEventIntakeLogRepository();
    const service = new ProviderEventIntakeLogService({
      now: () => fixedNow,
      repository
    });
    const message: TwitchChatProjectedMessage = {
      authorKind: "human",
      authorName: "MaiksViewer",
      channelName: "maiksmc",
      createdAt: "2026-07-04T15:59:59.000Z",
      id: "local-twitch-1",
      message: "hello twitch",
      providerMessageId: "twitch-message-1",
      source: "twitch",
      visibleOnOverlayByDefault: false
    };

    await expect(service.recordChatMessage(message)).resolves.toEqual({
      inserted: true,
      ok: true
    });

    expect(repository.writes).toHaveLength(1);
    expect(repository.writes[0]).toMatchObject({
      actorDisplayName: "MaiksViewer",
      catalogKnown: true,
      category: "chat",
      internalTrigger: "provider.twitch.irc.privmsg",
      mechanism: "twitch-irc",
      provider: "twitch",
      providerChannelId: "maiksmc",
      providerEventName: "PRIVMSG",
      providerMessageId: "twitch-message-1",
      sourceEventId: "twitch-message-1"
    });
    expect(repository.writes[0]?.safety.overlayEligibleByDefault).toBe(false);
    expect(repository.writes[0]?.redactedPayload).toMatchObject({
      message: "hello twitch",
      source: "twitch"
    });
  });

  it("records Discord chat as a Gateway message create event", async () => {
    const repository = new FakeProviderEventIntakeLogRepository();
    const service = new ProviderEventIntakeLogService({
      now: () => fixedNow,
      repository
    });
    const message: DiscordChatProjectedMessage = {
      authorKind: "human",
      authorName: "DiscordUser",
      channelId: "discord-channel-1",
      channelName: "general",
      createdAt: "2026-07-04T15:59:59.000Z",
      guildId: "discord-guild-1",
      id: "local-discord-1",
      message: "hello discord",
      providerMessageId: "discord-message-1",
      source: "discord",
      visibleOnOverlayByDefault: false
    };

    await expect(service.recordChatMessage(message)).resolves.toMatchObject({
      ok: true
    });

    expect(repository.writes[0]).toMatchObject({
      actorDisplayName: "DiscordUser",
      internalTrigger: "provider.discord.gateway.message-create",
      mechanism: "discord-gateway",
      provider: "discord",
      providerChannelId: "discord-channel-1",
      providerEventName: "MESSAGE_CREATE"
    });
    expect(repository.writes[0]?.redactedPayload).toMatchObject({
      channelId: "discord-channel-1",
      guildId: "discord-guild-1",
      message: "hello discord"
    });
  });

  it("records YouTube chat as a live chat text event", async () => {
    const repository = new FakeProviderEventIntakeLogRepository();
    const service = new ProviderEventIntakeLogService({
      now: () => fixedNow,
      repository
    });
    const message: YouTubeLiveChatProjectedMessage = {
      authorKind: "human",
      authorName: "YouTubeUser",
      channelName: "MaiksMC",
      createdAt: "2026-07-04T15:59:59.000Z",
      id: "local-youtube-1",
      message: "hello youtube",
      providerMessageId: "youtube-message-1",
      source: "youtube",
      visibleOnOverlayByDefault: false
    };

    await expect(service.recordChatMessage(message)).resolves.toMatchObject({
      ok: true
    });

    expect(repository.writes[0]).toMatchObject({
      actorDisplayName: "YouTubeUser",
      internalTrigger: "provider.youtube.live.chat.textmessageevent",
      mechanism: "youtube-live-chat",
      provider: "youtube",
      providerChannelId: "MaiksMC",
      providerEventName: "textMessageEvent"
    });
  });

  it("returns a safe failure when the repository write fails", async () => {
    const repository = new FakeProviderEventIntakeLogRepository();
    repository.shouldThrow = true;
    const service = new ProviderEventIntakeLogService({
      now: () => fixedNow,
      repository
    });

    await expect(service.recordChatMessage({
      authorKind: "human",
      authorName: "MaiksViewer",
      channelName: "maiksmc",
      createdAt: "2026-07-04T15:59:59.000Z",
      id: "local-twitch-1",
      message: "hello twitch",
      providerMessageId: "twitch-message-1",
      source: "twitch",
      visibleOnOverlayByDefault: false
    })).resolves.toEqual({
      ok: false,
      reason: "write_failed"
    });
  });
});
