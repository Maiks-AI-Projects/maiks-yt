import { describe, expect, it } from "vitest";

import {
  getProviderIntegrationStatusSnapshot,
  type ProviderIntegrationEnvironment,
  type ProviderIntegrationRuntimeState
} from "./provider-status.rules.js";
import { validateTwitchChatReplyReadiness } from "./twitch-chat-reply-readiness.service.js";
import type { TwitchChatReplyReadinessStatus } from "./twitch-chat-reply-readiness.types.js";

const getProvider = (
  env: ProviderIntegrationEnvironment,
  id: "twitch" | "youtube" | "discord"
) => getProviderIntegrationStatusSnapshot(env, new Date("2026-06-29T10:00:00.000Z"))
  .providers.find((provider) => provider.id === id);

const providerKeys = (value: object): readonly string[] => Object.keys(value).sort();

const configuredEnv = {
  DISCORD_BOT_TOKEN: "secret-discord-token-value",
  DISCORD_GUILD_ID: "987654321098765432",
  TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
  TWITCH_CLIENT_ID: "twitch-client",
  TWITCH_CLIENT_SECRET: "secret-twitch-value",
  YOUTUBE_CLIENT_ID: "youtube-client",
  YOUTUBE_CLIENT_SECRET: "secret-youtube-value"
} as const;

type TwitchRuntimeStatus = NonNullable<ProviderIntegrationRuntimeState["twitchChatIntake"]>;
type YouTubeRuntimeStatus = NonNullable<ProviderIntegrationRuntimeState["youtubeLiveChatIntake"]>;
type DiscordRuntimeStatus = NonNullable<ProviderIntegrationRuntimeState["discordChatIntake"]>;

const createTwitchRuntimeStatus = (
  overrides: Partial<TwitchRuntimeStatus> = {}
): TwitchRuntimeStatus => ({
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
  state: "stopped",
  ...overrides
} as TwitchRuntimeStatus);

const createYouTubeRuntimeStatus = (
  overrides: Partial<YouTubeRuntimeStatus> = {}
): YouTubeRuntimeStatus => ({
  activeLiveChatId: null,
  channelId: "UC1234567890123456789012",
  channelName: "MaiksMC",
  connectedAt: null,
  lastError: null,
  lastMessageAt: null,
  nextPollAt: null,
  recentMessages: [],
  state: "stopped",
  ...overrides
} as YouTubeRuntimeStatus);

const createDiscordRuntimeStatus = (
  overrides: Partial<DiscordRuntimeStatus> = {}
): DiscordRuntimeStatus => ({
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
  state: "stopped",
  ...overrides
} as DiscordRuntimeStatus);

const availableTwitchChatReplies = {
  issue: null,
  state: "available"
} as const satisfies TwitchChatReplyReadinessStatus;

const getConfiguredSnapshot = (
  runtimeState: ProviderIntegrationRuntimeState,
  twitchChatReplies: TwitchChatReplyReadinessStatus = availableTwitchChatReplies
) =>
  getProviderIntegrationStatusSnapshot(
    configuredEnv,
    new Date("2026-07-04T10:00:00.000Z"),
    runtimeState,
    { twitchChatReplies }
  );

describe("provider integration status", () => {
  it("returns the exact finite owner operator contract", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({}, new Date("2026-06-29T10:00:00.000Z"));

    expect(providerKeys(snapshot)).toEqual(["generatedAt", "ok", "providers"]);
    expect(snapshot).toMatchObject({
      ok: true,
      generatedAt: "2026-06-29T10:00:00.000Z"
    });
    expect(snapshot.providers.map((provider) => [provider.id, provider.label, provider.readiness])).toEqual([
      ["twitch", "Twitch", "needs_setup"],
      ["youtube", "YouTube", "needs_setup"],
      ["discord", "Discord", "needs_setup"]
    ]);
    for (const provider of snapshot.providers) {
      expect(providerKeys(provider)).toEqual(["capabilities", "guidance", "id", "label", "readiness", "runtime"]);
      expect(providerKeys(provider.runtime)).toEqual([
        "accountSummary",
        "connectedAt",
        "lastActivityAt",
        "nextRetryAt",
        "state"
      ]);
      expect(provider.runtime.state).toBe("unconfigured");
      for (const capability of provider.capabilities) {
        expect(providerKeys(capability)).toEqual(["key", "label", "state"]);
      }
    }
  });

  it("omits diagnostic and implementation fields from configured providers", () => {
    const env = {
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
      TWITCH_CLIENT_SECRET: "super-secret-twitch",
      YOUTUBE_API_KEY: "super-secret-youtube",
      DISCORD_BOT_TOKEN: "super-secret-discord",
      DISCORD_APPLICATION_ID: "discord-app"
    };
    const snapshot = getProviderIntegrationStatusSnapshot(env, new Date("2026-06-29T10:00:00.000Z"), {}, {
      twitchChatReplies: availableTwitchChatReplies
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.providers.map((provider) => [provider.id, provider.readiness, provider.runtime.state])).toEqual([
      ["twitch", "needs_setup", "unconfigured"],
      ["youtube", "needs_setup", "unconfigured"],
      ["discord", "needs_setup", "unconfigured"]
    ]);
    expect(serialized).not.toContain("super-secret-twitch");
    expect(serialized).not.toContain("secret-twitch-access-token");
    expect(serialized).not.toContain("super-secret-youtube");
    expect(serialized).not.toContain("super-secret-discord");
    expect(serialized).not.toContain("TWITCH_CLIENT_SECRET");
    expect(serialized).not.toContain("YOUTUBE_API_KEY");
    expect(serialized).not.toContain("DISCORD_BOT_TOKEN");
    expect(serialized).not.toContain("sdk");
    expect(serialized).not.toContain("readOnly");
    expect(serialized).not.toContain("env");
    expect(serialized).not.toContain("issues");
    expect(serialized).not.toContain("boundaries");
    expect(serialized).not.toContain("library");
  });

  it("reports invalid placeholders with finite guidance instead of raw issue text", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CLIENT_ID: "placeholder",
      TWITCH_CLIENT_SECRET: "real-secret",
      YOUTUBE_CLIENT_ID: "youtube-client",
      DISCORD_BOT_TOKEN: "replace-me"
    }, new Date("2026-06-29T10:00:00.000Z"));
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");
    const youtube = snapshot.providers.find((provider) => provider.id === "youtube");
    const discord = snapshot.providers.find((provider) => provider.id === "discord");
    const serialized = JSON.stringify(snapshot);

    expect(twitch?.readiness).toBe("needs_attention");
    expect(youtube?.readiness).toBe("needs_attention");
    expect(discord?.readiness).toBe("needs_attention");
    expect(twitch?.guidance).toBe("Review the provider setup; one or more configured values are unusable.");
    expect(serialized).not.toContain("TWITCH_CLIENT_ID");
    expect(serialized).not.toContain("YOUTUBE_CLIENT_ID");
    expect(serialized).not.toContain("DISCORD_BOT_TOKEN");
    expect(serialized).not.toContain("real-secret");
    expect(serialized).not.toContain("youtube-client");
    expect(serialized).not.toContain("replace-me");
    expect(serialized).not.toContain("must be configured together");
  });

  it("keeps library/config availability distinct from runtime connection", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
      TWITCH_CLIENT_SECRET: "super-secret-twitch"
    }, new Date("2026-06-29T10:00:00.000Z"), {}, {
      twitchChatReplies: availableTwitchChatReplies
    });
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");

    expect(twitch?.capabilities).toEqual(expect.arrayContaining([
      {
        key: "twitch_api_access",
        label: "Twitch API access",
        state: "available"
      },
      {
        key: "twitch_chat_intake",
        label: "Twitch chat intake",
        state: "needs_setup"
      },
      {
        key: "twitch_chat_replies",
        label: "Twitch chat replies",
        state: "available"
      }
    ]));
    expect(twitch?.runtime.state).toBe("unconfigured");
    expect(twitch?.readiness).toBe("needs_setup");
  });

  it("reports connected and stopped runtimes through finite fields", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      DISCORD_BOT_TOKEN: "super-secret-discord-bot",
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
      TWITCH_CLIENT_SECRET: "super-secret-twitch",
      YOUTUBE_CLIENT_ID: "youtube-client",
      YOUTUBE_CLIENT_SECRET: "super-secret-youtube"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      discordChatIntake: {
        channelIds: ["123456789012345678"],
        connectedAt: null,
        disconnectsInWindow: 0,
        guildId: "987654321098765432",
        lastError: null,
        lastDisconnectAt: "2026-07-04T09:59:00.000Z",
        lastMessageAt: null,
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "stopped"
      },
      twitchChatIntake: {
        channelName: "maiksmc",
        channelNames: ["maiksmc"],
        connectedAt: "2026-07-04T09:00:00.000Z",
        disconnectsInWindow: 0,
        lastError: null,
        lastDisconnectAt: null,
        lastMessageAt: "2026-07-04T09:58:00.000Z",
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "connected"
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
        state: "waiting"
      }
    }, { twitchChatReplies: availableTwitchChatReplies });
    const serialized = JSON.stringify(snapshot);
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");
    const youtube = snapshot.providers.find((provider) => provider.id === "youtube");
    const discord = snapshot.providers.find((provider) => provider.id === "discord");

    expect(twitch?.runtime).toEqual({
      state: "connected",
      accountSummary: "maiksmc",
      connectedAt: "2026-07-04T09:00:00.000Z",
      lastActivityAt: "2026-07-04T09:58:00.000Z",
      nextRetryAt: null
    });
    expect(twitch?.readiness).toBe("ready");
    expect(youtube?.runtime).toMatchObject({
      state: "waiting",
      accountSummary: "MaiksMC"
    });
    expect(youtube?.readiness).toBe("ready");
    expect(discord?.runtime).toMatchObject({
      state: "stopped",
      accountSummary: "1 configured channels",
      lastActivityAt: "2026-07-04T09:59:00.000Z"
    });
    expect(discord?.guidance).toBe("Start intake when this provider should capture live activity.");
    expect(serialized).not.toContain("123456789012345678");
    expect(serialized).not.toContain("987654321098765432");
    expect(serialized).not.toContain("UC1234567890123456789012");
    expect(serialized).not.toContain("disconnectsInWindow");
    expect(serialized).not.toContain("reconnectSuppressed");
    expect(serialized).not.toContain("lastError");
  });

  it("preserves first connection as connecting without attention or retry guidance", () => {
    const snapshot = getConfiguredSnapshot({
      twitchChatIntake: createTwitchRuntimeStatus({ state: "connecting" }),
      youtubeLiveChatIntake: createYouTubeRuntimeStatus({ state: "connecting" }),
      discordChatIntake: createDiscordRuntimeStatus({ state: "connecting" })
    });

    expect(snapshot.providers.map((provider) => [
      provider.id,
      provider.runtime.state,
      provider.readiness,
      provider.guidance,
      provider.runtime.nextRetryAt
    ])).toEqual([
      ["twitch", "connecting", "ready", null, null],
      ["youtube", "connecting", "ready", null, null],
      ["discord", "connecting", "ready", null, null]
    ]);
  });

  it("derives retrying only from scheduled future retry metadata", () => {
    const nextRetryAt = "2026-07-04T10:00:05.000Z";
    const snapshot = getConfiguredSnapshot({
      twitchChatIntake: createTwitchRuntimeStatus({
        lastError: "secret Twitch retry error",
        nextReconnectAt: nextRetryAt,
        state: "stopped"
      }),
      youtubeLiveChatIntake: createYouTubeRuntimeStatus({
        lastError: "secret YouTube retry error",
        nextPollAt: nextRetryAt,
        state: "waiting"
      }),
      discordChatIntake: createDiscordRuntimeStatus({
        lastError: "secret Discord retry error",
        nextReconnectAt: nextRetryAt,
        state: "stopped"
      })
    });
    const serialized = JSON.stringify(snapshot);

    for (const provider of snapshot.providers) {
      expect(provider.runtime.state).toBe("retrying");
      expect(provider.runtime.nextRetryAt).toBe(nextRetryAt);
      expect(provider.readiness).toBe("needs_attention");
      expect(provider.guidance).toBe("Wait for the scheduled retry. Review the provider connection if retries continue.");
      expect(provider.guidance).not.toContain("Start intake");
    }
    expect(serialized).not.toContain("secret Twitch retry error");
    expect(serialized).not.toContain("secret YouTube retry error");
    expect(serialized).not.toContain("secret Discord retry error");
    expect(serialized).not.toContain("lastError");
  });

  it("keeps ordinary stopped runtimes ready with start guidance", () => {
    const snapshot = getConfiguredSnapshot({
      twitchChatIntake: createTwitchRuntimeStatus(),
      youtubeLiveChatIntake: createYouTubeRuntimeStatus(),
      discordChatIntake: createDiscordRuntimeStatus()
    });

    for (const provider of snapshot.providers) {
      expect(provider.runtime.state).toBe("stopped");
      expect(provider.runtime.nextRetryAt).toBeNull();
      expect(provider.readiness).toBe("ready");
      expect(provider.guidance).toBe("Start intake when this provider should capture live activity.");
    }
  });

  it("keeps normal YouTube waiting separate from retrying", () => {
    const youtube = getConfiguredSnapshot({
      youtubeLiveChatIntake: createYouTubeRuntimeStatus({
        lastError: null,
        nextPollAt: "2026-07-04T10:01:00.000Z",
        state: "waiting"
      })
    }).providers.find((provider) => provider.id === "youtube");

    expect(youtube?.runtime.state).toBe("waiting");
    expect(youtube?.runtime.nextRetryAt).toBeNull();
    expect(youtube?.readiness).toBe("ready");
    expect(youtube?.guidance).toBeNull();
  });

  it("keeps connected runtimes ready without operator guidance", () => {
    const snapshot = getConfiguredSnapshot({
      twitchChatIntake: createTwitchRuntimeStatus({ state: "connected" }),
      youtubeLiveChatIntake: createYouTubeRuntimeStatus({ state: "connected" }),
      discordChatIntake: createDiscordRuntimeStatus({ state: "connected" })
    });

    for (const provider of snapshot.providers) {
      expect(provider.runtime.state).toBe("connected");
      expect(provider.runtime.nextRetryAt).toBeNull();
      expect(provider.readiness).toBe("ready");
      expect(provider.guidance).toBeNull();
    }
  });

  it("keeps unconfigured runtimes in setup state", () => {
    const snapshot = getConfiguredSnapshot({
      twitchChatIntakeState: "unconfigured",
      youtubeLiveChatIntakeState: "unconfigured",
      discordChatIntakeState: "unconfigured"
    });

    for (const provider of snapshot.providers) {
      expect(provider.runtime.state).toBe("unconfigured");
      expect(provider.runtime.nextRetryAt).toBeNull();
      expect(provider.readiness).toBe("needs_setup");
      expect(provider.guidance).not.toContain("retry");
    }
  });

  it("rejects malformed and non-future retry timestamps without changing source state", () => {
    const snapshot = getConfiguredSnapshot({
      twitchChatIntake: createTwitchRuntimeStatus({
        nextReconnectAt: "not-a-timestamp",
        state: "stopped"
      }),
      youtubeLiveChatIntake: createYouTubeRuntimeStatus({
        lastError: "retry failed",
        nextPollAt: "2026-07-04T09:59:59.000Z",
        state: "waiting"
      }),
      discordChatIntake: createDiscordRuntimeStatus({
        nextReconnectAt: "2026-07-04T10:00:00.000Z",
        state: "stopped"
      })
    });

    expect(snapshot.providers.map((provider) => [
      provider.id,
      provider.runtime.state,
      provider.runtime.nextRetryAt,
      provider.readiness
    ])).toEqual([
      ["twitch", "stopped", null, "ready"],
      ["youtube", "waiting", null, "ready"],
      ["discord", "stopped", null, "ready"]
    ]);
  });

  it("bounds and sanitizes account summaries", () => {
    const longName = `${"A".repeat(120)} token`;
    const snapshot = getProviderIntegrationStatusSnapshot({
      DISCORD_BOT_TOKEN: "super-secret-discord-bot",
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
      TWITCH_CLIENT_SECRET: "secret-twitch-value",
      YOUTUBE_CLIENT_ID: "youtube-client",
      YOUTUBE_CLIENT_SECRET: "super-secret-youtube"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      discordChatIntake: {
        channelIds: Array.from({ length: 1200 }, (_, index) => String(1000 + index)),
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
        channelName: "MaiksMC",
        channelNames: ["maiksmc", "maiksplays", "third_channel", "fourth_channel"],
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
        channelName: longName,
        connectedAt: null,
        lastError: null,
        lastMessageAt: null,
        nextPollAt: null,
        recentMessages: [],
        state: "stopped"
      }
    }, { twitchChatReplies: availableTwitchChatReplies });
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");
    const youtube = snapshot.providers.find((provider) => provider.id === "youtube");
    const discord = snapshot.providers.find((provider) => provider.id === "discord");

    expect(twitch?.runtime.accountSummary).toBe("maiksmc + maiksplays + third_channel + 1 more");
    expect(youtube?.runtime.accountSummary).toBeNull();
    expect(discord?.runtime.accountSummary).toBe("999 configured channels");
  });

  it("keeps maximum-length multi-channel Twitch summaries within the browser contract", () => {
    const exactBoundaryChannelNames = [
      "a".repeat(25),
      "b".repeat(25),
      "c".repeat(24)
    ];
    const getTwitchWithChannels = (channelNames: readonly string[]) => getProviderIntegrationStatusSnapshot({
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
      TWITCH_CLIENT_SECRET: "secret-twitch-value"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      twitchChatIntake: {
        channelName: channelNames[0]!,
        channelNames,
        connectedAt: "2026-07-04T09:00:00.000Z",
        disconnectsInWindow: 0,
        lastError: null,
        lastDisconnectAt: null,
        lastMessageAt: null,
        nextReconnectAt: null,
        recentMessages: [],
        reconnectSuppressed: false,
        state: "connected"
      }
    }, { twitchChatReplies: availableTwitchChatReplies }).providers[0];
    const exactBoundaryTwitch = getTwitchWithChannels(exactBoundaryChannelNames);
    const overflowTwitch = getTwitchWithChannels([
      "a".repeat(25),
      "b".repeat(25),
      "c".repeat(25),
      "d".repeat(25)
    ]);

    expect(exactBoundaryTwitch?.runtime.accountSummary).toBe(
      exactBoundaryChannelNames.join(" + ")
    );
    expect(exactBoundaryTwitch?.runtime.accountSummary).toHaveLength(80);
    expect(overflowTwitch?.runtime.accountSummary).toBe(
      `${"a".repeat(25)} + ${"b".repeat(25)} + 2 more`
    );
    expect(overflowTwitch?.runtime.accountSummary?.length).toBeLessThanOrEqual(80);
  });

  it("supports explicit disabled provider state", () => {
    const twitch = getProvider({
      TWITCH_INTEGRATION_DISABLED: "true",
      TWITCH_CLIENT_ID: "placeholder"
    }, "twitch");

    expect(twitch?.readiness).toBe("disabled");
    expect(twitch?.capabilities.every((capability) => capability.state === "disabled")).toBe(true);
    expect(twitch?.guidance).toBe("Enable this provider only when production intake should resume.");
  });

  it("reports missing Twitch chat reply configuration without treating refresh material as proof", () => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CHAT_BOT_REFRESH_TOKEN: "secret-refresh-token",
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "secret-twitch-value"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      twitchChatIntake: createTwitchRuntimeStatus({ state: "connected" })
    });
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");

    expect(twitch?.capabilities.find((capability) => capability.key === "twitch_chat_replies")).toEqual({
      key: "twitch_chat_replies",
      label: "Twitch chat replies",
      state: "needs_setup"
    });
    expect(twitch?.readiness).toBe("needs_setup");
    expect(twitch?.guidance).toBe("Add Twitch bot access-token and client setup before command replies are enabled.");
    expect(JSON.stringify(snapshot)).not.toContain("secret-refresh-token");
  });

  it.each([
    [
      "invalid access token",
      { issue: "invalid_access_token", state: "needs_attention" },
      { issue: "invalid_access_token", state: "needs_attention" },
      "Reconnect the Twitch bot access token; validation says it is invalid or expired."
    ],
    [
      "missing chat reply scope",
      { issue: "missing_scope", state: "needs_attention" },
      { issue: "missing_scope", state: "needs_attention" },
      "Reconnect Twitch bot consent with chat:read and chat:edit before command replies are enabled."
    ],
    [
      "unproven validation",
      { issue: "validation_unavailable", state: "needs_attention" },
      { issue: "validation_unavailable", state: "needs_attention" },
      "Twitch bot token validation could not be proven right now; retry before relying on command replies."
    ]
  ] as const)("reports Twitch chat replies as %s", (_case, readiness, expected, guidance) => {
    const snapshot = getProviderIntegrationStatusSnapshot({
      TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-access-token",
      TWITCH_CLIENT_ID: "twitch-client",
      TWITCH_CLIENT_SECRET: "secret-twitch-value"
    }, new Date("2026-07-04T10:00:00.000Z"), {
      twitchChatIntake: createTwitchRuntimeStatus({ state: "connected" })
    }, { twitchChatReplies: readiness });
    const twitch = snapshot.providers.find((provider) => provider.id === "twitch");

    expect(twitch?.capabilities.find((capability) => capability.key === "twitch_chat_replies")).toEqual({
      key: "twitch_chat_replies",
      label: "Twitch chat replies",
      state: expected.state
    });
    expect(twitch?.readiness).toBe("needs_attention");
    expect(twitch?.guidance).toBe(guidance);
    expect(JSON.stringify(snapshot)).not.toContain("secret-twitch-access-token");
  });
});

describe("Twitch chat reply readiness validation", () => {
  it("validates the configured access token with the read-only Twitch endpoint and required Twurple chat scopes", async () => {
    const fetchCalls: Array<{ headers: Record<string, string>; method: string; url: string }> = [];
    const result = await validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id",
        TWITCH_CLIENT_SECRET: "secret-client-secret"
      },
      fetchFn: async (url, init) => {
        fetchCalls.push({ headers: init.headers, method: init.method, url });

        return {
          json: async () => ({
            client_id: "twitch-client-id",
            expires_in: 3600,
            login: "maiksmc",
            scopes: ["chat:read", "chat:edit"],
            user_id: "123456789012345678"
          }),
          ok: true,
          status: 200
        };
      }
    });

    expect(result).toEqual({
      issue: null,
      state: "available"
    });
    expect(fetchCalls).toEqual([{
      headers: {
        Authorization: "OAuth secret-access-token"
      },
      method: "GET",
      url: "https://id.twitch.tv/oauth2/validate"
    }]);
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
    expect(JSON.stringify(result)).not.toContain("123456789012345678");
  });

  it("does not treat a refresh token as proof that chat replies can work", async () => {
    let fetchCalled = false;
    const result = await validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_REFRESH_TOKEN: "secret-refresh-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      },
      fetchFn: async () => {
        fetchCalled = true;
        throw new Error("should not fetch without an access token");
      }
    });

    expect(result).toEqual({
      issue: "missing_configuration",
      state: "needs_setup"
    });
    expect(fetchCalled).toBe(false);
  });

  it("does not fetch when Twitch integration is disabled", async () => {
    let fetchCalled = false;
    const result = await validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id",
        TWITCH_INTEGRATION_DISABLED: "true"
      },
      fetchFn: async () => {
        fetchCalled = true;
        throw new Error("disabled validation should not fetch");
      }
    });

    expect(result).toEqual({
      issue: null,
      state: "disabled"
    });
    expect(fetchCalled).toBe(false);
  });

  it("fails attention-closed for a malformed successful validation payload", async () => {
    const result = await validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      },
      fetchFn: async () => ({
        json: async () => ({
          client_id: "twitch-client-id",
          scopes: ["chat:read", { scope: "chat:edit" }]
        }),
        ok: true,
        status: 200
      })
    });

    expect(result).toEqual({
      issue: "validation_unavailable",
      state: "needs_attention"
    });
  });

  it.each([
    ["invalid access token", 401, { status: 401, message: "invalid access token" }, {
      issue: "invalid_access_token",
      state: "needs_attention"
    }],
    ["missing scope", 200, {
      client_id: "twitch-client-id",
      expires_in: 3600,
      scopes: ["chat:read"]
    }, {
      issue: "missing_scope",
      state: "needs_attention"
    }],
    ["client mismatch", 200, {
      client_id: "other-client-id",
      expires_in: 3600,
      scopes: ["chat:read", "chat:edit"]
    }, {
      issue: "client_mismatch",
      state: "needs_attention"
    }]
  ] as const)("sanitizes %s validation failures", async (_case, status, payload, expected) => {
    const result = await validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      },
      fetchFn: async () => ({
        json: async () => payload,
        ok: status === 200,
        status
      })
    });

    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
    expect(JSON.stringify(result)).not.toContain("invalid access token");
  });

  it("fails attention-closed when validation cannot complete", async () => {
    await expect(validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      },
      fetchFn: async () => {
        throw new Error("network details with secret-access-token");
      },
      timeoutMs: 10
    })).resolves.toEqual({
      issue: "validation_unavailable",
      state: "needs_attention"
    });
  });

  it("bounds token validation with an abortable timeout", async () => {
    const result = await validateTwitchChatReplyReadiness({
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      },
      fetchFn: async (_url, init) => await new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted secret-access-token")));
      }),
      timeoutMs: 1
    });

    expect(result).toEqual({
      issue: "validation_unavailable",
      state: "needs_attention"
    });
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
  });
});
