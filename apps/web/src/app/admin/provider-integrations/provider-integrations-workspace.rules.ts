import type {
  ProviderIntegrationStatus,
  ProviderRuntimeConnectionState,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";

export type ProviderWorkspaceId = ProviderIntegrationStatus["id"];

export type ProviderWorkspaceRuntimeView = {
  provider: ProviderWorkspaceId;
  connectionState: ProviderRuntimeConnectionState | null;
  accountSummary: string | null;
  connectedAt: string | null;
  lastDisconnectAt: string | null;
  lastMessageAt: string | null;
  reconnectCount: number | null;
  nextRetryAt: string | null;
  reconnectSuppressed: boolean | null;
  lastError: string | null;
  autoStartEnabled: boolean | null;
};

export type YouTubeChannelOptionView = {
  token: string;
  title: string;
};

export const providerIntegrationRequestPaths = {
  status: "/admin/provider-integrations/status",
  youtubeCredential: "/admin/provider-integrations/youtube/credential",
  youtubeChannelSelection: "/admin/provider-integrations/youtube/channel-selection",
  twitchEventSubSubscriptions: "/admin/provider-integrations/twitch-eventsub/subscriptions",
  youtubePubSubSubscription: "/admin/provider-integrations/youtube-pubsub/subscription"
} as const;

export type ProviderIntegrationInitialLoadOperation = "status" | "youtubeCredential";

export const providerIntegrationInitialLoadOperations = [
  "status",
  "youtubeCredential"
] as const satisfies readonly ProviderIntegrationInitialLoadOperation[];

export const getProviderIntegrationInitialLoadPaths = (): readonly string[] =>
  providerIntegrationInitialLoadOperations.map((operation) => providerIntegrationRequestPaths[operation]);

const runtimeCapabilityKeys: Record<ProviderWorkspaceId, string> = {
  twitch: "twitch-chat-runtime",
  youtube: "youtube-live-chat-runtime",
  discord: "discord-chat-runtime"
};

export const getProviderWorkspaceRuntimeView = (
  provider: ProviderIntegrationStatus
): ProviderWorkspaceRuntimeView => {
  const runtime = provider.capabilities.find(
    (capability) => capability.key === runtimeCapabilityKeys[provider.id]
  )?.runtime;

  return {
    provider: provider.id,
    connectionState: runtime?.connectionState ?? null,
    accountSummary: runtime?.accountSummary ?? null,
    connectedAt: runtime?.connectedAt ?? null,
    lastDisconnectAt: runtime?.lastDisconnectAt ?? null,
    lastMessageAt: runtime?.lastMessageAt ?? null,
    reconnectCount: runtime?.reconnectCount ?? null,
    nextRetryAt: runtime?.nextRetryAt ?? null,
    reconnectSuppressed: runtime?.reconnectSuppressed ?? null,
    lastError: runtime?.lastError ?? null,
    autoStartEnabled: runtime?.autoStartEnabled ?? null
  };
};

export const getProviderWorkspaceRuntimeViews = (
  providers: readonly ProviderIntegrationStatus[]
): ReadonlyMap<ProviderWorkspaceId, ProviderWorkspaceRuntimeView> =>
  new Map(providers.map((provider) => [provider.id, getProviderWorkspaceRuntimeView(provider)]));

export const getYouTubeChannelOptionViews = (
  channels: readonly YouTubeSavedChannel[]
): readonly YouTubeChannelOptionView[] =>
  channels.map((channel, index) => ({
    token: `channel-${index + 1}`,
    title: channel.title
  }));

export const getSelectedYouTubeChannelToken = (
  channels: readonly YouTubeSavedChannel[],
  selectedChannelId: string | null
): string => {
  const index = channels.findIndex((channel) => channel.id === selectedChannelId);
  return index >= 0 ? `channel-${index + 1}` : "";
};

export const resolveYouTubeChannelId = (
  channels: readonly YouTubeSavedChannel[],
  token: string
): string | null | undefined => {
  if (token === "") {
    return null;
  }

  const match = /^channel-(\d+)$/.exec(token);
  if (!match) {
    return undefined;
  }

  const index = Number(match[1]) - 1;
  return channels[index]?.id;
};
