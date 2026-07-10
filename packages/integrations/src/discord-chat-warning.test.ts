import { describe, expect, it, vi } from "vitest";

import { createDiscordWarningMessage } from "./discord-chat-warning.rules.js";
import { DiscordChatWarningDeliveryService } from "./discord-chat-warning.service.js";

describe("createDiscordWarningMessage", () => {
  it("uses explicit Discord mentions only for valid user ids", () => {
    expect(createDiscordWarningMessage({
      authorName: "  Viewer  ",
      userId: "123456789012345678",
      warningCount: 2,
      warningThreshold: 3
    })).toEqual({
      allowedUserId: "123456789012345678",
      content: "<@123456789012345678> this is warning 2/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });

    expect(createDiscordWarningMessage({
      authorName: " @everyone \u0000 Viewer ",
      userId: "not-a-snowflake",
      warningCount: 1,
      warningThreshold: 3
    })).toEqual({
      allowedUserId: null,
      content: "everyone Viewer this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });
  });
});

describe("DiscordChatWarningDeliveryService", () => {
  it("sends a warning through the Discord channel message endpoint", async () => {
    const fetchFn = vi.fn(async () => ({
      json: async () => ({ id: "provider-warning-message-1" }),
      ok: true,
      status: 200
    }));
    const service = new DiscordChatWarningDeliveryService({
      env: {
        DISCORD_BOT_TOKEN: "discord-bot-token"
      },
      fetchFn
    });

    await expect(service.sendWarning({
      authorName: "Viewer",
      channelId: "234567890123456789",
      userId: "123456789012345678",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toEqual({
      ok: true,
      providerAction: true,
      providerMessageId: "provider-warning-message-1",
      providerMessageSent: true,
      providerMessage: "<@123456789012345678> this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/234567890123456789/messages",
      expect.objectContaining({
        body: JSON.stringify({
          allowed_mentions: {
            parse: [],
            users: ["123456789012345678"]
          },
          content: "<@123456789012345678> this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
        }),
        headers: {
          Authorization: "Bot discord-bot-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      })
    );
  });

  it("fails closed without token or channel context", async () => {
    const missingTokenService = new DiscordChatWarningDeliveryService({
      env: {},
      fetchFn: vi.fn()
    });

    await expect(missingTokenService.sendWarning({
      authorName: "Viewer",
      channelId: "234567890123456789",
      userId: "123456789012345678",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "discord_warning_unconfigured"
    });

    const missingChannelService = new DiscordChatWarningDeliveryService({
      env: {
        DISCORD_BOT_TOKEN: "discord-bot-token"
      },
      fetchFn: vi.fn()
    });

    await expect(missingChannelService.sendWarning({
      authorName: "Viewer",
      channelId: null,
      userId: "123456789012345678",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "discord_warning_missing_context"
    });
  });

  it("returns sanitized provider failures without leaking the token", async () => {
    const service = new DiscordChatWarningDeliveryService({
      env: {
        DISCORD_BOT_TOKEN: "secret-discord-token"
      },
      fetchFn: vi.fn(async () => ({
        json: async () => ({ message: "forbidden" }),
        ok: false,
        status: 403
      }))
    });

    const result = await service.sendWarning({
      authorName: "Viewer",
      channelId: "234567890123456789",
      userId: "123456789012345678",
      warningCount: 1,
      warningThreshold: 3
    });

    expect(result).toMatchObject({
      ok: false,
      providerAction: true,
      providerMessageId: "discord-http-403",
      providerMessageSent: false,
      reason: "discord_warning_provider_rejected"
    });
    expect(JSON.stringify(result)).not.toContain("secret-discord-token");
  });
});
