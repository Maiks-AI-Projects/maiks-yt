import { describe, expect, it } from "vitest";

import type {
  ProviderIntegrationStatus,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";
import { parseProviderIntegrationsStatusResponse } from "./provider-integrations-status.service";
import {
  getProviderWorkspaceRuntimeView,
  getProviderIntegrationInitialLoadPaths,
  getYouTubeChannelOptionViews,
  getSelectedYouTubeChannelToken,
  providerIntegrationRequestPaths,
  resolveYouTubeChannelId
} from "./provider-integrations-workspace.rules";

const providerWithRuntime = {
  id: "discord",
  label: "Discord",
  readiness: "ready",
  capabilities: [{
    key: "discord_chat_intake",
    label: "Discord chat intake",
    state: "available"
  }],
  runtime: {
    state: "stopped",
    accountSummary: "2 configured channels",
    connectedAt: "2026-08-27T08:00:00.000Z",
    lastActivityAt: "2026-08-27T08:29:00.000Z",
    nextRetryAt: "2026-08-27T08:31:00.000Z"
  },
  guidance: "Start intake when this provider should capture live activity.",
  recentMessages: [{
    id: "raw-message-id",
    authorName: "private-user-name",
    channelName: "private-channel-name",
    message: "private message body"
  }],
  guildId: "987654321098765432",
  channelIds: ["123456789012345678"]
} as ProviderIntegrationStatus & Record<string, unknown>;

const youtubeChannels: readonly YouTubeSavedChannel[] = [{
  id: "UC1234567890123456789012",
  title: "MaiksMC",
  customUrl: null,
  thumbnailUrl: null,
  selectedForLiveChat: true,
  discoveredAt: "2026-08-27T08:00:00.000Z",
  lastSeenAt: "2026-08-27T08:00:00.000Z",
  selectedAt: "2026-08-27T08:00:00.000Z",
  updatedAt: null
}];

describe("provider integrations workspace projection", () => {
  it("limits initial load to sanitized status and credential summary requests", () => {
    const paths = getProviderIntegrationInitialLoadPaths();

    expect(paths).toEqual([
      "/admin/provider-integrations/status",
      "/admin/provider-integrations/youtube/credential"
    ]);
    expect(paths).not.toContain(providerIntegrationRequestPaths.youtubeChannelSelection);
    expect(paths).not.toContain(providerIntegrationRequestPaths.twitchEventSubSubscriptions);
    expect(paths).not.toContain(providerIntegrationRequestPaths.youtubePubSubSubscription);
  });

  it("selects only bounded capability runtime telemetry", () => {
    const view = getProviderWorkspaceRuntimeView(providerWithRuntime);
    const serialized = JSON.stringify(view);

    expect(view).toEqual({
      provider: "discord",
      connectionState: "stopped",
      accountSummary: "2 configured channels",
      connectedAt: "2026-08-27T08:00:00.000Z",
      lastActivityAt: "2026-08-27T08:29:00.000Z",
      nextRetryAt: "2026-08-27T08:31:00.000Z",
      guidance: "Start intake when this provider should capture live activity."
    });
    expect(serialized).not.toContain("private message body");
    expect(serialized).not.toContain("private-user-name");
    expect(serialized).not.toContain("private-channel-name");
    expect(serialized).not.toContain("raw-message-id");
    expect(serialized).not.toContain("987654321098765432");
    expect(serialized).not.toContain("123456789012345678");
  });

  it("fails closed when the provider runtime capability is absent", () => {
    expect(getProviderWorkspaceRuntimeView({
      ...providerWithRuntime,
      capabilities: [],
      runtime: {
        state: "unconfigured",
        accountSummary: null,
        connectedAt: null,
        lastActivityAt: null,
        nextRetryAt: null
      },
      guidance: null
    })).toEqual({
      provider: "discord",
      connectionState: "unconfigured",
      accountSummary: null,
      connectedAt: null,
      nextRetryAt: null,
      lastActivityAt: null,
      guidance: null
    });
  });

  it("renders channel titles through opaque option tokens and resolves ids only for controls", () => {
    const options = getYouTubeChannelOptionViews(youtubeChannels);

    expect(options).toEqual([{ token: "channel-1", title: "MaiksMC" }]);
    expect(getSelectedYouTubeChannelToken(youtubeChannels, youtubeChannels[0]?.id ?? null)).toBe("channel-1");
    expect(resolveYouTubeChannelId(youtubeChannels, "channel-1")).toBe(youtubeChannels[0]?.id);
    expect(resolveYouTubeChannelId(youtubeChannels, "invalid-token")).toBeUndefined();
    expect(JSON.stringify(options)).not.toContain("UC1234567890123456789012");
  });
});

describe("provider integrations status parser", () => {
  const validPayload = {
    ok: true,
    generatedAt: "2026-08-27T08:00:00.000Z",
    providers: [
      {
        id: "twitch",
        label: "Twitch",
        readiness: "ready",
        capabilities: [
          { key: "twitch_api_access", label: "Twitch API access", state: "available" },
          { key: "twitch_chat_intake", label: "Twitch chat intake", state: "available" },
          { key: "twitch_chat_replies", label: "Twitch chat replies", state: "available" },
          { key: "twitch_eventsub_intake", label: "Twitch event intake", state: "needs_setup" }
        ],
        runtime: {
          state: "connected",
          accountSummary: "maiksmc",
          connectedAt: "2026-08-27T08:00:00.000Z",
          lastActivityAt: "2026-08-27T08:01:00.000Z",
          nextRetryAt: null
        },
        guidance: null
      },
      {
        id: "youtube",
        label: "YouTube",
        readiness: "needs_setup",
        capabilities: [
          { key: "youtube_data_access", label: "YouTube data access", state: "needs_setup" },
          { key: "youtube_owner_consent", label: "YouTube owner consent", state: "needs_setup" },
          { key: "youtube_live_chat_intake", label: "YouTube live chat intake", state: "needs_setup" }
        ],
        runtime: {
          state: "unconfigured",
          accountSummary: null,
          connectedAt: null,
          lastActivityAt: null,
          nextRetryAt: null
        },
        guidance: "Finish YouTube owner-consent setup before starting live-chat polling."
      },
      {
        id: "discord",
        label: "Discord",
        readiness: "needs_attention",
        capabilities: [
          { key: "discord_bot_access", label: "Discord bot access", state: "available" },
          { key: "discord_guild_target", label: "Discord guild target", state: "available" },
          { key: "discord_webhook_intake", label: "Discord webhook intake", state: "needs_setup" },
          { key: "discord_chat_intake", label: "Discord chat intake", state: "needs_attention" }
        ],
        runtime: {
          state: "retrying",
          accountSummary: "2 configured channels",
          connectedAt: null,
          lastActivityAt: "2026-08-27T07:59:00.000Z",
          nextRetryAt: "2026-08-27T08:02:00.000Z"
        },
        guidance: "Wait for the scheduled retry. Review the provider connection if retries continue."
      }
    ]
  };

  const withDiscordRuntime = (runtime: Record<string, unknown>) => ({
    ...validPayload,
    providers: [
      validPayload.providers[0],
      validPayload.providers[1],
      {
        ...validPayload.providers[2],
        runtime: {
          ...validPayload.providers[2]!.runtime,
          ...runtime
        }
      }
    ]
  });

  it("accepts the exact success contract", () => {
    expect(validPayload.providers[2]!.runtime).toMatchObject({
      state: "retrying",
      nextRetryAt: "2026-08-27T08:02:00.000Z"
    });
    expect(parseProviderIntegrationsStatusResponse(validPayload)).toEqual(validPayload);
  });

  it.each([
    ["retrying with null retry time", withDiscordRuntime({
      state: "retrying",
      nextRetryAt: null
    })],
    ["retrying with equal retry time", withDiscordRuntime({
      state: "retrying",
      nextRetryAt: validPayload.generatedAt
    })],
    ["retrying with past retry time", withDiscordRuntime({
      state: "retrying",
      nextRetryAt: "2026-08-27T07:59:59.000Z"
    })],
    ["non-retrying with future retry time", withDiscordRuntime({
      state: "stopped",
      nextRetryAt: "2026-08-27T08:02:00.000Z"
    })]
  ])("rejects %s relative to generatedAt", (_case, payload) => {
    expect(parseProviderIntegrationsStatusResponse(payload)).toBeNull();
  });

  it("accepts connecting as an explicit finite runtime state", () => {
    const payload = {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          runtime: {
            state: "connecting",
            accountSummary: "maiksmc",
            connectedAt: null,
            lastActivityAt: null,
            nextRetryAt: null
          }
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    };

    expect(parseProviderIntegrationsStatusResponse(payload)).toEqual(payload);
  });

  it("accepts the producer's 80-character multi-channel Twitch summary", () => {
    const channelA = "a".repeat(25);
    const channelB = "b".repeat(25);
    const channelC = "c".repeat(24);
    const payload = structuredClone(validPayload);
    payload.providers[0]!.runtime.accountSummary = `${channelA} + ${channelB} + ${channelC}`;

    expect(payload.providers[0]!.runtime.accountSummary).toHaveLength(80);
    expect(parseProviderIntegrationsStatusResponse(payload)).toEqual(payload);
  });

  it.each([
    ["not_authenticated"],
    ["provider_integrations_unavailable"],
    ["provider_integrations_user_unlinked"],
    ["provider_integrations_forbidden"]
  ])("accepts the finite failure reason %s", (reason) => {
    expect(parseProviderIntegrationsStatusResponse({ ok: false, reason })).toEqual({ ok: false, reason });
  });

  it.each([
    ["arbitrary reason", { ok: false, reason: "database_exploded" }],
    ["missing failure reason", { ok: false }],
    ["wrong failure reason type", { ok: false, reason: 503 }],
    ["extra failure field", { ok: false, reason: "provider_integrations_unavailable", error: "raw" }]
  ])("rejects a failure payload with %s", (_case, payload) => {
    expect(parseProviderIntegrationsStatusResponse(payload)).toBeNull();
  });

  it.each([
    ["malformed", null],
    ["wrong ok type", { ...validPayload, ok: "true" }],
    ["missing field", { ok: true, providers: validPayload.providers }],
    ["extra top-level field", { ...validPayload, readOnly: true }],
    ["legacy diagnostic provider", {
      ...validPayload,
      providers: [
        {
          id: "twitch",
          label: "Twitch",
          state: "configured",
          sdk: "@twurple/chat",
          readOnly: true,
          env: [],
          issues: [],
          capabilities: []
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["extra provider field", {
      ...validPayload,
      providers: [
        { ...validPayload.providers[0], issues: [] },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["wrong provider order", {
      ...validPayload,
      providers: [
        validPayload.providers[1],
        validPayload.providers[0],
        validPayload.providers[2]
      ]
    }],
    ["extra runtime field", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0]!,
          runtime: {
            ...validPayload.providers[0]!.runtime,
            lastError: "raw error"
          }
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["wrong capability key", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: [
            { key: "twitch-chat-library", label: "Twitch chat library", state: "available" }
          ]
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["missing capability", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: validPayload.providers[0]!.capabilities.slice(0, -1)
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["duplicate capability", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: [
            validPayload.providers[0]!.capabilities[0],
            validPayload.providers[0]!.capabilities[0],
            validPayload.providers[0]!.capabilities[2]
          ]
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["reordered capabilities", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: [
            validPayload.providers[0]!.capabilities[1],
            validPayload.providers[0]!.capabilities[0],
            validPayload.providers[0]!.capabilities[2]
          ]
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["cross-provider capability", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: [
            validPayload.providers[1]!.capabilities[0],
            validPayload.providers[0]!.capabilities[1],
            validPayload.providers[0]!.capabilities[2]
          ]
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["extra capability", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: [
            ...validPayload.providers[0]!.capabilities,
            validPayload.providers[1]!.capabilities[0]
          ]
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }],
    ["secret-like relabelled capability", {
      ...validPayload,
      providers: [
        {
          ...validPayload.providers[0],
          capabilities: [
            {
              ...validPayload.providers[0]!.capabilities[0],
              label: "Authorization: Bearer super-secret-token"
            },
            validPayload.providers[0]!.capabilities[1],
            validPayload.providers[0]!.capabilities[2]
          ]
        },
        validPayload.providers[1],
        validPayload.providers[2]
      ]
    }]
  ])("fails closed for %s", (_case, payload) => {
    expect(parseProviderIntegrationsStatusResponse(payload)).toBeNull();
  });
});
