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
  lastActivityAt: string | null;
  nextRetryAt: string | null;
  guidance: string | null;
};

export type YouTubeChannelOptionView = {
  token: string;
  title: string;
};

export const providerIntegrationRequestPaths = {
  status: "/admin/provider-integrations/status",
  youtubeCredential: "/admin/provider-integrations/youtube/credential",
  youtubeConsentConnect: "/admin/provider-integrations/youtube/connect",
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

export const getProviderWorkspaceRuntimeView = (
  provider: ProviderIntegrationStatus
): ProviderWorkspaceRuntimeView => {
  return {
    provider: provider.id,
    connectionState: provider.runtime.state,
    accountSummary: provider.runtime.accountSummary,
    connectedAt: provider.runtime.connectedAt,
    lastActivityAt: provider.runtime.lastActivityAt,
    nextRetryAt: provider.runtime.nextRetryAt,
    guidance: provider.guidance
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
  selectedChannelRef: string | null
): string => {
  const index = channels.findIndex((channel) => channel.channelRef === selectedChannelRef);
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
  return channels[index]?.channelRef;
};
