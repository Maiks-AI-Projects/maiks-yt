import { describe, expect, it, vi } from "vitest";

import { ProviderChatBotDeliveryService } from "./provider-chat-bot-delivery.service.js";

describe("ProviderChatBotDeliveryService", () => {
  it("sends Twitch bot replies through the injected writable chat client", async () => {
    const connect = vi.fn(async () => undefined);
    const quit = vi.fn(async () => undefined);
    const say = vi.fn(async () => undefined);
    const createTwitchClient = vi.fn(() => ({
      connect,
      quit,
      say
    }));
    const service = new ProviderChatBotDeliveryService({
      createTwitchClient,
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "twitch-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      }
    });

    await expect(service.send({
      channelName: "#MaiksMC",
      message: "Maiks.yt: https://maiks.yt/",
      provider: "twitch"
    })).resolves.toMatchObject({
      ok: true,
      authorKind: "bot",
      providerAction: true,
      providerMessageSent: true,
      providerMessage: "Maiks.yt: https://maiks.yt/",
      visibleOnOverlayByDefault: false
    });

    expect(createTwitchClient).toHaveBeenCalledWith({
      accessToken: "twitch-access-token",
      channelName: "maiksmc",
      clientId: "twitch-client-id"
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith("maiksmc", "Maiks.yt: https://maiks.yt/");
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("fails closed for missing provider configuration or context", async () => {
    const unconfiguredService = new ProviderChatBotDeliveryService({
      env: {}
    });

    await expect(unconfiguredService.send({
      channelName: "maiksmc",
      message: "Maiks.yt: https://maiks.yt/",
      provider: "twitch"
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "provider_chat_bot_unconfigured",
      visibleOnOverlayByDefault: false
    });

    const configuredService = new ProviderChatBotDeliveryService({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      }
    });

    await expect(configuredService.send({
      channelName: "",
      message: "Maiks.yt: https://maiks.yt/",
      provider: "twitch"
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "provider_chat_bot_context_missing"
    });
  });

  it("posts Discord bot replies without allowing mentions", async () => {
    const fetchFn = vi.fn(async () => ({
      json: async () => ({ id: "discord-message-1" }),
      ok: true,
      status: 200
    }));
    const service = new ProviderChatBotDeliveryService({
      env: {
        DISCORD_BOT_TOKEN: "discord-bot-token"
      },
      fetchFn
    });

    await expect(service.send({
      channelId: "123456789012345678",
      message: "Creator links: https://maiks.yt/links",
      provider: "discord"
    })).resolves.toMatchObject({
      ok: true,
      providerMessageId: "discord-message-1",
      providerMessageSent: true
    });

    expect(fetchFn).toHaveBeenCalledWith("https://discord.com/api/v10/channels/123456789012345678/messages", {
      body: JSON.stringify({
        allowed_mentions: {
          parse: []
        },
        content: "Creator links: https://maiks.yt/links"
      }),
      headers: {
        Authorization: "Bot discord-bot-token",
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  });
});
