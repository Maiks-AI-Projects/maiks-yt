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

  it("supports explicit disabled provider state", () => {
    const twitch = getProvider({
      TWITCH_INTEGRATION_DISABLED: "true",
      TWITCH_CLIENT_ID: "placeholder"
    }, "twitch");

    expect(twitch?.state).toBe("disabled");
    expect(twitch?.issues).toEqual([]);
  });
});
