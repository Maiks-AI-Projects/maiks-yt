import { describe, expect, it } from "vitest";

import type {
  ProviderIntegrationStatus,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";
import {
  parseDiscordChatIntakeResponse,
  parseProviderIntegrationsStatusResponse,
  parseTwitchChatIntakeResponse,
  parseTwitchEventSubEnsureDefaultsResponse,
  parseTwitchEventSubSubscriptionListResponse,
  parseYouTubeActivitiesPollResponse,
  parseYouTubeChannelSelectionResponse,
  parseYouTubeConsentResponse,
  parseYouTubeCredentialResponse,
  parseYouTubeLiveChatIntakeResponse,
  parseYouTubePubSubSubscriptionRequestResponse,
  parseYouTubePubSubSubscriptionResponse
} from "./provider-integrations-status.service";
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
  channelRef: "youtube-channel:v1:safeOpaqueReference",
  title: "MaiksMC",
  selectedForLiveChat: true
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
    expect(getSelectedYouTubeChannelToken(youtubeChannels, youtubeChannels[0]?.channelRef ?? null)).toBe("channel-1");
    expect(resolveYouTubeChannelId(youtubeChannels, "channel-1")).toBe(youtubeChannels[0]?.channelRef);
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
        guidance: "Finish YouTube owner-consent setup before starting live-chat streaming."
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

describe("provider integrations supporting response parsers", () => {
  it.each([
    ["Twitch", parseTwitchChatIntakeResponse],
    ["Discord", parseDiscordChatIntakeResponse],
    ["YouTube", parseYouTubeLiveChatIntakeResponse]
  ])("rejects %s chat-control diagnostics", (_provider, parse) => {
    expect(parse({
      ok: true,
      readOnly: true,
      status: {
        connectedAt: "2026-08-27T08:00:00.000Z",
        disconnectsInWindow: 2,
        guidance: "running",
        lastActivityAt: "2026-08-27T08:01:00.000Z",
        lastError: "raw provider error",
        recentMessages: [{ id: "provider-message-id", message: "private message body" }],
        reconnectSuppressed: true,
        state: "connected"
      }
    })).toBeNull();
  });

  it.each([
    ["Twitch stopped as running", parseTwitchChatIntakeResponse, "stopped", "running"],
    ["Discord connecting as ready", parseDiscordChatIntakeResponse, "connecting", "ready_to_start"],
    ["YouTube waiting as running", parseYouTubeLiveChatIntakeResponse, "waiting", "running"],
    ["Twitch unconfigured as waiting", parseTwitchChatIntakeResponse, "unconfigured", "waiting_for_live_chat"],
    ["Discord connected as configuration needed", parseDiscordChatIntakeResponse, "connected", "configuration_needed"],
    ["YouTube stopped as waiting", parseYouTubeLiveChatIntakeResponse, "stopped", "waiting_for_live_chat"]
  ])("rejects contradictory chat-control success %s", (_case, parse, state, guidance) => {
    expect(parse({
      ok: true,
      readOnly: true,
      status: {
        connectedAt: null,
        guidance,
        lastActivityAt: null,
        state
      }
    })).toBeNull();
  });

  it.each([
    ["Twitch stopped", parseTwitchChatIntakeResponse, "stopped", "ready_to_start"],
    ["Discord connecting", parseDiscordChatIntakeResponse, "connecting", "running"],
    ["YouTube waiting", parseYouTubeLiveChatIntakeResponse, "waiting", "waiting_for_live_chat"],
    ["Twitch connected", parseTwitchChatIntakeResponse, "connected", "running"],
    ["Discord unconfigured", parseDiscordChatIntakeResponse, "unconfigured", "configuration_needed"]
  ])("accepts deterministic chat-control success %s", (_case, parse, state, guidance) => {
    expect(parse({
      ok: true,
      readOnly: true,
      status: {
        connectedAt: null,
        guidance,
        lastActivityAt: null,
        state
      }
    })).toMatchObject({
      ok: true,
      status: {
        guidance,
        state
      }
    });
  });

  it("accepts only the finite YouTube credential contract", () => {
    expect(parseYouTubeCredentialResponse({
      action: "none",
      credential: { state: "connected" },
      ok: true
    })).toEqual({
      action: "none",
      credential: { state: "connected" },
      ok: true
    });
    expect(parseYouTubeCredentialResponse({
      action: "connect",
      credential: null,
      ok: true
    })).toEqual({
      action: "connect",
      credential: null,
      ok: true
    });
    expect(parseYouTubeCredentialResponse({
      action: "reconnect",
      credential: { state: "needs_attention" },
      ok: true
    })).toEqual({
      action: "reconnect",
      credential: { state: "needs_attention" },
      ok: true
    });
    expect(parseYouTubeConsentResponse({
      action: "connect",
      connectPath: providerIntegrationRequestPaths.youtubeConsentConnect,
      credential: null,
      ok: true
    })).toEqual({
      action: "connect",
      connectPath: providerIntegrationRequestPaths.youtubeConsentConnect,
      credential: null,
      ok: true
    });
    expect(parseYouTubeConsentResponse({
      action: "none",
      credential: {
        lastError: "raw token failure",
        scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
        state: "connected",
        updatedAt: "2026-08-27T08:00:00.000Z"
      },
      ok: true,
      redirectUri: "https://api.maiks.yt/admin/provider-integrations/youtube/callback",
      requiredScope: "https://www.googleapis.com/auth/youtube.readonly"
    })).toBeNull();
    expect(parseYouTubeCredentialResponse({
      action: "connect",
      connectPath: providerIntegrationRequestPaths.youtubeConsentConnect,
      credential: null,
      ok: true
    })).toBeNull();
    expect(parseYouTubeConsentResponse({
      action: "connect",
      credential: null,
      ok: true
    })).toBeNull();
    expect(parseYouTubeConsentResponse({
      action: "connect",
      consentUrl: "https://accounts.google.com/o/oauth2/v2/auth?client_id=raw-client&redirect_uri=https%3A%2F%2Fapi.maiks.yt%2Fadmin%2Fprovider-integrations%2Fyoutube%2Fcallback&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.readonly",
      credential: null,
      ok: true
    })).toBeNull();
    expect(parseYouTubeConsentResponse({
      action: "connect",
      connectPath: "https://accounts.google.com/o/oauth2/v2/auth",
      credential: null,
      ok: true
    })).toBeNull();
  });

  it.each([
    ["credential null with none", parseYouTubeCredentialResponse, { action: "none", credential: null, ok: true }],
    ["credential null with reconnect", parseYouTubeCredentialResponse, { action: "reconnect", credential: null, ok: true }],
    ["active credential with connect", parseYouTubeCredentialResponse, { action: "connect", credential: { state: "connected" }, ok: true }],
    ["active credential with reconnect", parseYouTubeCredentialResponse, { action: "reconnect", credential: { state: "connected" }, ok: true }],
    ["needs-attention credential with none", parseYouTubeCredentialResponse, { action: "none", credential: { state: "needs_attention" }, ok: true }],
    ["needs-attention credential with connect", parseYouTubeCredentialResponse, { action: "connect", credential: { state: "needs_attention" }, ok: true }],
    ["disconnected credential with none", parseYouTubeCredentialResponse, { action: "none", credential: { state: "disconnected" }, ok: true }],
    ["consent null with none", parseYouTubeConsentResponse, { action: "none", connectPath: providerIntegrationRequestPaths.youtubeConsentConnect, credential: null, ok: true }],
    ["consent active with connect", parseYouTubeConsentResponse, { action: "connect", connectPath: providerIntegrationRequestPaths.youtubeConsentConnect, credential: { state: "connected" }, ok: true }],
    ["consent needs-attention with none", parseYouTubeConsentResponse, { action: "none", connectPath: providerIntegrationRequestPaths.youtubeConsentConnect, credential: { state: "needs_attention" }, ok: true }]
  ])("rejects impossible YouTube credential/action success %s", (_case, parse, payload) => {
    expect(parse(payload)).toBeNull();
  });

  it.each([
    ["Twitch", parseTwitchChatIntakeResponse, "discord_chat_forbidden"],
    ["Twitch", parseTwitchChatIntakeResponse, "youtube_live_chat_forbidden"],
    ["Discord", parseDiscordChatIntakeResponse, "twitch_chat_forbidden"],
    ["Discord", parseDiscordChatIntakeResponse, "youtube_live_chat_forbidden"],
    ["YouTube", parseYouTubeLiveChatIntakeResponse, "twitch_chat_forbidden"],
    ["YouTube", parseYouTubeLiveChatIntakeResponse, "discord_chat_forbidden"]
  ])("rejects %s chat-control cross-provider failure reason %s", (_provider, parse, reason) => {
    expect(parse({ ok: false, reason })).toBeNull();
  });

  it("requires opaque YouTube channel references and rejects raw saved-channel fields", () => {
    const valid = {
      channels: [{
        channelRef: "youtube-channel:v1:safeOpaqueReference",
        selectedForLiveChat: true,
        title: "MaiksMC"
      }],
      ok: true,
      selectedChannelRef: "youtube-channel:v1:safeOpaqueReference"
    };

    expect(parseYouTubeChannelSelectionResponse(valid)).toEqual(valid);
    expect(parseYouTubeChannelSelectionResponse({
      channels: [{
        customUrl: "@maiksmc",
        discoveredAt: "2026-08-27T08:00:00.000Z",
        id: "UC1234567890123456789012",
        selectedForLiveChat: true,
        title: "MaiksMC"
      }],
      ok: true,
      selectedChannelId: "UC1234567890123456789012"
    })).toBeNull();
    expect(parseYouTubeChannelSelectionResponse({
      ...valid,
      selectedChannelRef: "youtube-channel:v1:unknown"
    })).toBeNull();
  });

  it("rejects raw Twitch EventSub subscription diagnostics", () => {
    const valid = {
      broadcasterLogin: "maiksmc",
      broadcasterLogins: ["maiksmc"],
      defaults: [{ state: "missing", type: "stream.online" }],
      ok: true,
      readOnly: true,
      subscriptionCount: 0,
      subscriptionState: "loaded"
    };

    expect(parseTwitchEventSubSubscriptionListResponse(valid)).toEqual(valid);
    expect(parseTwitchEventSubSubscriptionListResponse({
      ...valid,
      broadcasterUserId: "617410645",
      callbackUrl: "https://api.maiks.yt/provider-webhooks/twitch/eventsub",
      subscriptions: [{
        condition: { broadcaster_user_id: "617410645" },
        id: "subscription-id",
        status: "webhook_callback_verification_pending",
        version: "1"
      }]
    })).toBeNull();
    expect(parseTwitchEventSubEnsureDefaultsResponse({
      broadcasterLogin: "maiksmc",
      broadcasterLogins: ["maiksmc"],
      ok: true,
      results: [{ state: "created", type: "stream.online" }],
      subscriptionState: "loaded"
    })).toMatchObject({ ok: true, subscriptionState: "loaded" });
  });

  it("rejects raw YouTube PubSub URLs and channel ids", () => {
    expect(parseYouTubePubSubSubscriptionResponse({
      ok: true,
      readOnly: true,
      state: "ready"
    })).toEqual({
      ok: true,
      readOnly: true,
      state: "ready"
    });
    expect(parseYouTubePubSubSubscriptionResponse({
      callbackUrl: "https://api.maiks.yt/provider-webhooks/youtube/pubsub",
      channelId: "UC123",
      hubUrl: "https://pubsubhubbub.appspot.com/subscribe",
      ok: true,
      readOnly: true,
      state: "ready",
      topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123"
    })).toBeNull();
    expect(parseYouTubePubSubSubscriptionRequestResponse({
      mode: "subscribe",
      ok: true,
      readOnly: true,
      state: "requested",
      topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123"
    })).toBeNull();
  });

  it("rejects raw YouTube activity event identifiers and impossible counters", () => {
    expect(parseYouTubeActivitiesPollResponse({
      fetched: 2,
      inserted: 1,
      ok: true,
      polledAt: "2026-08-27T08:00:00.000Z",
      readOnly: true
    })).toMatchObject({ fetched: 2, inserted: 1, ok: true });
    expect(parseYouTubeActivitiesPollResponse({
      channelId: "UC123",
      events: [{
        providerMessageId: "activity-1",
        sourceEventId: "youtube-activity:UC123:activity-1"
      }],
      fetched: 1,
      inserted: 1,
      ok: true,
      polledAt: "2026-08-27T08:00:00.000Z",
      readOnly: true
    })).toBeNull();
    expect(parseYouTubeActivitiesPollResponse({
      fetched: 1,
      inserted: 2,
      ok: true,
      polledAt: "2026-08-27T08:00:00.000Z",
      readOnly: true
    })).toBeNull();
  });
});
