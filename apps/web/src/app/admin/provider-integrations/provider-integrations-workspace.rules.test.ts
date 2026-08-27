import { describe, expect, it } from "vitest";

import type {
  ProviderIntegrationStatus,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";
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
  state: "configured",
  sdk: "discord.js",
  readOnly: true,
  env: [],
  issues: [],
  capabilities: [{
    key: "discord-chat-runtime",
    label: "Discord chat runtime",
    state: "available",
    detail: "Read-only Discord Gateway chat intake is available and stopped.",
    runtime: {
      connectionState: "stopped",
      accountSummary: "2 configured channels",
      connectedAt: "2026-08-27T08:00:00.000Z",
      lastDisconnectAt: "2026-08-27T08:30:00.000Z",
      lastMessageAt: "2026-08-27T08:29:00.000Z",
      reconnectCount: 4,
      nextRetryAt: "2026-08-27T08:31:00.000Z",
      reconnectSuppressed: true,
      lastError: "Authorization: [redacted] for guildId=[redacted-id]",
      autoStartEnabled: false
    }
  }],
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
      lastDisconnectAt: "2026-08-27T08:30:00.000Z",
      lastMessageAt: "2026-08-27T08:29:00.000Z",
      reconnectCount: 4,
      nextRetryAt: "2026-08-27T08:31:00.000Z",
      reconnectSuppressed: true,
      lastError: "Authorization: [redacted] for guildId=[redacted-id]",
      autoStartEnabled: false
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
      capabilities: []
    })).toEqual({
      provider: "discord",
      connectionState: null,
      accountSummary: null,
      connectedAt: null,
      lastDisconnectAt: null,
      lastMessageAt: null,
      reconnectCount: null,
      nextRetryAt: null,
      reconnectSuppressed: null,
      lastError: null,
      autoStartEnabled: null
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
