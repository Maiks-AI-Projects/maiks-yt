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
        state: "gated"
      })
    ]));
    expect(snapshot.providers[1]?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "youtube-data-api-client",
        state: "available"
      }),
      expect.objectContaining({
        key: "youtube-oauth-consent",
        state: "not_enabled"
      })
    ]));
    expect(snapshot.providers[2]?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "discord-rest-client",
        state: "available"
      }),
      expect.objectContaining({
        key: "discord-gateway-library",
        state: "gated"
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
        state: "gated"
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
});
