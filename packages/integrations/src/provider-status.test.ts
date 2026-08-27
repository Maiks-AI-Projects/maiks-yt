import { describe, expect, it } from "vitest";

import { getProviderIntegrationStatusSnapshot, type ProviderIntegrationEnvironment } from "./provider-status.rules.js";

const getProvider = (
  env: ProviderIntegrationEnvironment,
  id: "twitch" | "youtube" | "discord"
) => getProviderIntegrationStatusSnapshot(env, new Date("2026-06-29T10:00:00.000Z"))
  .providers.find((provider) => provider.id === id);

describe("provider integration status", () => {
  it("reports missing provider configuration without throwing", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({}, new Date("2026-06-29T10:00:00.000Z"));

    expect(snapshot).toMatchObject({
      ok: true,
      readOnly: true,
      generatedAt: "2026-06-29T10:00:00.000Z"
    });
    expect(snapshot.providers.map((provider) => [provider.id, provider.state])).toEqual([
      ["twitch", "missing"],
      ["youtube", "missing"],
      ["discord", "missing"]
    ]);
  });

  it("reports configured providers and never returns raw secret values", () => {
    const env = {
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "super-secret-twitch",
      YOUTUBE_API_KEY: "super-secret-youtube",
      DISCORD_BOT_TOKEN: "super-secret-discord",
      DISCORD_APPLICATION_ID: "discord-app"
    };
    const snapshot = getProviderIntegrationStatusSnapshot(env, new Date("2026-06-29T10:00:00.000Z"));
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.providers.map((provider) => [provider.id, provider.state])).toEqual([
      ["twitch", "configured"],
      ["youtube", "configured"],
      ["discord", "configured"]
    ]);
    expect(serialized).not.toContain("super-secret-twitch");
    expect(serialized).not.toContain("super-secret-youtube");
    expect(serialized).not.toContain("super-secret-discord");
    expect(serialized).toContain("TWITCH_CLIENT_SECRET");
    expect(serialized).toContain("\"configured\":true");
    expect(snapshot.providers[0]?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "twitch-chat-library",
        state: "available"
      }),
      expect.objectContaining({
        key: "twitch-chat-runtime",
        state: "not_enabled"
      }),
      expect.objectContaining({
        key: "twitch-eventsub",
        state: "missing"
      })
    ]));
    expect(snapshot.providers[1]?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "youtube-data-api-client",
        state: "available"
      }),
      expect.objectContaining({
        key: "youtube-oauth-consent",
        state: "missing"
      })
    ]));
    expect(snapshot.providers[2]?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "discord-rest-client",
        state: "available"
      }),
      expect.objectContaining({
        key: "discord-gateway-library",
        state: "available"
      })
    ]));
  });

  it("reports partial and placeholder values as invalid without leaking values", () => {
    const env = {
      TWITCH_CLIENT_ID: "placeholder",
      TWITCH_CLIENT_SECRET: "real-secret",
      YOUTUBE_CLIENT_ID: "youtube-client",
      DISCORD_BOT_TOKEN: "replace-me"
    };
    const twitch = getProvider(env, "twitch");
    const youtube = getProvider(env, "youtube");
    const discord = getProvider(env, "discord");
    const serialized = JSON.stringify({ twitch, youtube, discord });

    expect(twitch?.state).toBe("invalid");
    expect(twitch?.issues).toContain("TWITCH_CLIENT_ID is empty or looks like a placeholder.");
    expect(youtube?.state).toBe("invalid");
    expect(youtube?.issues).toContain("YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be configured together.");
    expect(discord?.state).toBe("invalid");
    expect(discord?.issues).toContain("DISCORD_BOT_TOKEN is empty or looks like a placeholder.");
    expect(serialized).not.toContain("real-secret");
    expect(serialized).not.toContain("youtube-client");
    expect(serialized).not.toContain("replace-me");
  });

  it("recognizes legacy Google OAuth names for YouTube configuration", () => {
    const youtube = getProvider({
      GOOGLE_CLIENT_ID: "google-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "super-secret-google"
    }, "youtube");
    const serialized = JSON.stringify(youtube);

    expect(youtube?.state).toBe("configured");
    expect(youtube?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "youtube-oauth-client",
        state: "configured"
      })
    ]));
    expect(youtube?.env).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "GOOGLE_CLIENT_ID",
        configured: true
      }),
      expect.objectContaining({
        name: "GOOGLE_CLIENT_SECRET",
        configured: true
      })
    ]));
    expect(serialized).not.toContain("super-secret-google");
  });

  it("reports partial legacy Google OAuth names as invalid without leaking values", () => {
    const youtube = getProvider({
      GOOGLE_CLIENT_ID: "google-client.apps.googleusercontent.com"
    }, "youtube");
    const serialized = JSON.stringify(youtube);

    expect(youtube?.state).toBe("invalid");
    expect(youtube?.issues).toContain("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.");
    expect(serialized).not.toContain("google-client.apps.googleusercontent.com");
  });

  it("surfaces Discord OAuth app aliases separately from bot token readiness", () => {
    const discord = getProvider({
      DISCORD_CLIENT_ID: "discord-client",
      DISCORD_CLIENT_SECRET: "super-secret-discord-oauth"
    }, "discord");
    const serialized = JSON.stringify(discord);

    expect(discord?.state).toBe("missing");
    expect(discord?.env).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "DISCORD_CLIENT_ID",
        configured: true
      }),
      expect.objectContaining({
        name: "DISCORD_CLIENT_SECRET",
        configured: true
      })
    ]));
    expect(serialized).not.toContain("super-secret-discord-oauth");
  });

  it("reports Discord bot and guild readiness separately from Gateway intake", () => {
    const discord = getProvider({
      DISCORD_BOT_TOKEN: "super-secret-discord-bot",
      DISCORD_APPLICATION_ID: "discord-app",
      DISCORD_GUILD_ID: "sensitive-guild-value-123"
    }, "discord");
    const serialized = JSON.stringify(discord);

    expect(discord?.state).toBe("configured");
    expect(discord?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "discord-bot-token",
        state: "configured"
      }),
      expect.objectContaining({
        key: "discord-guild-target",
        state: "configured"
      }),
      expect.objectContaining({
        key: "discord-gateway-library",
        state: "available"
      })
    ]));
    expect(serialized).not.toContain("super-secret-discord-bot");
    expect(serialized).not.toContain("sensitive-guild-value-123");
  });

  it("supports explicit disabled provider state", () => {
    const twitch = getProvider({
      TWITCH_INTEGRATION_DISABLED: "true",
      TWITCH_CLIENT_ID: "placeholder"
    }, "twitch");

    expect(twitch?.state).toBe("disabled");
    expect(twitch?.issues).toEqual([]);
  });

  it("reports connected Twitch chat runtime separately from library availability", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "super-secret-twitch"
    }, new Date("2026-06-29T10:00:00.000Z"), {
      twitchChatIntakeState: "connected"
    });
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");

    expect(twitch?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "twitch-chat-library",
        state: "available"
      }),
      expect.objectContaining({
        key: "twitch-chat-runtime",
        state: "configured"
      })
    ]));
  });

  it("reports configured but stopped runtimes as available and stopped", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      DISCORD_BOT_TOKEN: "super-secret-discord-bot",
      DISCORD_CHAT_AUTO_START: "false",
      TWITCH_CHAT_AUTO_START: "false",
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "super-secret-twitch",
      YOUTUBE_LIVE_CHAT_AUTO_START: "false"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      discordChatIntake: {
        channelIds: ["123456789012345678"],
        connectedAt: null,
        disconnectsInWindow: 0,
        guildId: "987654321098765432",
        lastError: null,
        lastDisconnectAt: null,
        lastMessageAt: null,
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "stopped"
      },
      twitchChatIntake: {
        channelName: "maiksmc",
        channelNames: ["maiksmc"],
        connectedAt: null,
        disconnectsInWindow: 0,
        lastError: null,
        lastDisconnectAt: null,
        lastMessageAt: null,
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "stopped"
      },
      youtubeLiveChatIntake: {
        activeLiveChatId: null,
        channelId: "UC1234567890123456789012",
        channelName: "MaiksMC",
        connectedAt: null,
        lastError: null,
        lastMessageAt: null,
        nextPollAt: null,
        recentMessages: [],
        state: "stopped"
      }
    });
    const serialized = JSON.stringify(snapshot);
    const twitchRuntime = snapshot.providers
      .find((provider) => provider.id === "twitch")
      ?.capabilities.find((capability) => capability.key === "twitch-chat-runtime");
    const youtubeRuntime = snapshot.providers
      .find((provider) => provider.id === "youtube")
      ?.capabilities.find((capability) => capability.key === "youtube-live-chat-runtime");
    const discordRuntime = snapshot.providers
      .find((provider) => provider.id === "discord")
      ?.capabilities.find((capability) => capability.key === "discord-chat-runtime");

    expect(twitchRuntime).toMatchObject({
      state: "available",
      runtime: {
        accountSummary: "maiksmc",
        autoStartEnabled: false,
        connectionState: "stopped"
      }
    });
    expect(youtubeRuntime).toMatchObject({
      state: "available",
      runtime: {
        accountSummary: "MaiksMC",
        autoStartEnabled: false,
        connectionState: "stopped"
      }
    });
    expect(discordRuntime).toMatchObject({
      state: "available",
      runtime: {
        accountSummary: "1 configured channels",
        autoStartEnabled: false,
        connectionState: "stopped"
      }
    });
    expect(serialized).not.toContain("\"state\":\"not_enabled\"");
    expect(serialized).not.toContain("123456789012345678");
    expect(serialized).not.toContain("987654321098765432");
    expect(serialized).not.toContain("UC1234567890123456789012");
  });

  it("redacts reconnect-degraded runtime telemetry before returning status", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      DISCORD_BOT_TOKEN: "secret-discord-token-value",
      DISCORD_GUILD_ID: "987654321098765432",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "unlisted-bot-token-value",
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "secret-twitch-value"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      discordChatIntake: {
        channelIds: ["123456789012345678", "234567890123456789"],
        connectedAt: null,
        disconnectsInWindow: 10,
        guildId: "987654321098765432",
        lastDisconnectAt: "2026-07-04T09:59:00.000Z",
        lastError: "Authorization: Bearer secret-discord-token-value failed for guildId=987654321098765432 payload={raw}",
        lastMessageAt: "2026-07-04T09:58:00.000Z",
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: true,
        state: "stopped"
      },
      twitchChatIntake: {
        channelName: "maiksmc",
        channelNames: ["maiksmc"],
        connectedAt: null,
        disconnectsInWindow: 4,
        lastDisconnectAt: "2026-07-04T09:55:00.000Z",
        lastError: "GET https://example.test/chat/123456?access_token=secret-twitch-value failed with unlisted-bot-token-value broadcasterId=123456",
        lastMessageAt: "2026-07-04T09:50:00.000Z",
        nextReconnectAt: "2026-07-04T10:00:05.000Z",
        recentMessages: [],
        reconnectSuppressed: false,
        state: "connecting"
      }
    });
    const serialized = JSON.stringify(snapshot);
    const discordRuntime = snapshot.providers
      .find((provider) => provider.id === "discord")
      ?.capabilities.find((capability) => capability.key === "discord-chat-runtime")?.runtime;
    const twitchRuntime = snapshot.providers
      .find((provider) => provider.id === "twitch")
      ?.capabilities.find((capability) => capability.key === "twitch-chat-runtime")?.runtime;

    expect(discordRuntime).toMatchObject({
      accountSummary: "2 configured channels",
      connectionState: "stopped",
      lastDisconnectAt: "2026-07-04T09:59:00.000Z",
      lastMessageAt: "2026-07-04T09:58:00.000Z",
      reconnectCount: 10,
      reconnectSuppressed: true
    });
    expect(twitchRuntime).toMatchObject({
      accountSummary: "maiksmc",
      connectionState: "connecting",
      nextRetryAt: "2026-07-04T10:00:05.000Z",
      reconnectCount: 4,
      reconnectSuppressed: false
    });
    expect(discordRuntime?.lastError).toContain("[redacted]");
    expect(discordRuntime?.lastError).toContain("[redacted-id]");
    expect(twitchRuntime?.lastError).toContain("[redacted]");
    expect(serialized).not.toContain("secret-discord-token-value");
    expect(serialized).not.toContain("secret-twitch-value");
    expect(serialized).not.toContain("unlisted-bot-token-value");
    expect(serialized).not.toContain("987654321098765432");
    expect(serialized).not.toContain("123456789012345678");
    expect(serialized).not.toContain("234567890123456789");
    expect(serialized).not.toContain("broadcasterId=123456");
    expect(serialized).not.toContain("/chat/123456");
    expect(serialized).not.toContain("access_token=secret-twitch-value");
    expect(serialized).not.toContain("payload={raw}");
  });

  it("redacts configured secrets before truncating runtime errors", () => {
    const boundarySecret = "boundary-secret-value";
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: boundarySecret
    }, new Date("2026-07-04T10:00:00.000Z"), {
      twitchChatIntake: {
        channelName: "maiksmc",
        channelNames: ["maiksmc"],
        connectedAt: null,
        disconnectsInWindow: 1,
        lastDisconnectAt: "2026-07-04T09:59:00.000Z",
        lastError: `${"x".repeat(168)} ${boundarySecret} after boundary`,
        lastMessageAt: null,
        nextReconnectAt: "2026-07-04T10:00:05.000Z",
        recentMessages: [],
        reconnectSuppressed: false,
        state: "connecting"
      }
    });
    const lastError = snapshot.providers
      .find((provider) => provider.id === "twitch")
      ?.capabilities.find((capability) => capability.key === "twitch-chat-runtime")?.runtime?.lastError;

    expect(lastError).toContain("[redacted]");
    expect(lastError).not.toContain(boundarySecret);
    expect(lastError).not.toContain("boundary");
    expect(lastError).toHaveLength(180);
  });

  it("reports configured Twitch EventSub webhook receiver separately from subscription creation", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "super-secret-twitch",
      TWITCH_EVENTSUB_WEBHOOK_SECRET: "super-secret-eventsub"
    }, new Date("2026-07-04T20:00:00.000Z"));
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");
    const serialized = JSON.stringify(twitch);

    expect(twitch?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "twitch-eventsub",
        state: "configured"
      })
    ]));
    expect(serialized).not.toContain("super-secret-eventsub");
  });

  it("reports connected Discord chat runtime separately from library availability", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      DISCORD_BOT_TOKEN: "super-secret-discord-bot",
      DISCORD_GUILD_ID: "sensitive-guild-value-123"
    }, new Date("2026-07-02T10:00:00.000Z"), {
      discordChatIntakeState: "connected"
    });
    const discord = snapshot.providers.find((provider) => provider.id === "discord");
    const serialized = JSON.stringify(discord);

    expect(discord?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "discord-gateway-library",
        state: "available"
      }),
      expect.objectContaining({
        key: "discord-chat-runtime",
        state: "configured"
      })
    ]));
    expect(serialized).not.toContain("super-secret-discord-bot");
    expect(serialized).not.toContain("sensitive-guild-value-123");
  });
});
