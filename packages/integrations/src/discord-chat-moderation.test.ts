import { describe, expect, it, vi } from "vitest";

import { DiscordChatModerationService } from "./discord-chat-moderation.service.js";

describe("DiscordChatModerationService", () => {
  it("deletes a Discord message through the channel message endpoint", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 204
    }));
    const service = new DiscordChatModerationService({
      env: {
        DISCORD_BOT_TOKEN: "discord-bot-token"
      },
      fetchFn
    });

    await expect(service.moderate({
      action: "delete_message",
      channelId: "234567890123456789",
      guildId: "345678901234567890",
      messageId: "456789012345678901",
      reason: "Delete from Maiks.yt chat.",
      userId: "123456789012345678"
    })).resolves.toMatchObject({
      ok: true,
      providerAction: true,
      providerActionSent: true
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/234567890123456789/messages/456789012345678901",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bot discord-bot-token"
        }),
        method: "DELETE"
      })
    );
  });

  it("times out and bans Discord users through guild member endpoints", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 204
    }));
    const service = new DiscordChatModerationService({
      env: {
        DISCORD_BOT_TOKEN: "discord-bot-token"
      },
      fetchFn
    });

    await service.moderate({
      action: "timeout_author",
      channelId: "234567890123456789",
      durationSeconds: 600,
      guildId: "345678901234567890",
      messageId: "456789012345678901",
      reason: "Timeout from Maiks.yt chat.",
      userId: "123456789012345678"
    });
    await service.moderate({
      action: "ban_author",
      channelId: "234567890123456789",
      guildId: "345678901234567890",
      messageId: "456789012345678901",
      reason: "Ban from Maiks.yt chat.",
      userId: "123456789012345678"
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "https://discord.com/api/v10/guilds/345678901234567890/members/123456789012345678",
      expect.objectContaining({
        body: expect.stringContaining("communication_disabled_until"),
        method: "PATCH"
      })
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "https://discord.com/api/v10/guilds/345678901234567890/bans/123456789012345678",
      expect.objectContaining({
        body: JSON.stringify({
          delete_message_seconds: 0
        }),
        method: "PUT"
      })
    );
  });

  it("fails closed without token or required provider context", async () => {
    await expect(new DiscordChatModerationService({
      env: {},
      fetchFn: vi.fn()
    }).moderate({
      action: "delete_message",
      channelId: "234567890123456789",
      guildId: "345678901234567890",
      messageId: "456789012345678901",
      reason: "Delete from Maiks.yt chat.",
      userId: "123456789012345678"
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      reason: "discord_moderation_unconfigured"
    });

    await expect(new DiscordChatModerationService({
      env: {
        DISCORD_BOT_TOKEN: "discord-bot-token"
      },
      fetchFn: vi.fn()
    }).moderate({
      action: "delete_message",
      channelId: null,
      guildId: "345678901234567890",
      messageId: "456789012345678901",
      reason: "Delete from Maiks.yt chat.",
      userId: "123456789012345678"
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      reason: "discord_moderation_missing_context"
    });
  });

  it("returns sanitized provider failures without leaking the bot token", async () => {
    const service = new DiscordChatModerationService({
      env: {
        DISCORD_BOT_TOKEN: "secret-discord-token"
      },
      fetchFn: vi.fn(async () => ({
        ok: false,
        status: 403
      }))
    });

    const result = await service.moderate({
      action: "ban_author",
      channelId: "234567890123456789",
      guildId: "345678901234567890",
      messageId: "456789012345678901",
      reason: "Ban from Maiks.yt chat.",
      userId: "123456789012345678"
    });

    expect(result).toMatchObject({
      ok: false,
      providerAction: true,
      providerActionSent: false,
      reason: "discord_moderation_provider_rejected"
    });
    expect(JSON.stringify(result)).not.toContain("secret-discord-token");
  });
});
