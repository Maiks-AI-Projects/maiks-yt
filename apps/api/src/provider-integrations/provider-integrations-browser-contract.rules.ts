import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  DiscordChatIntakeStatus,
  TwitchChatIntakeStatus,
  TwitchEventSubDefaultSubscriptionStatus,
  TwitchEventSubEnsureDefaultsResult,
  TwitchEventSubSubscriptionListResult,
  YouTubeActivitiesPollResult,
  YouTubeChannelDiscoveryResult,
  YouTubeLiveChatIntakeStatus,
  YouTubePubSubSubscriptionRequestResult,
  YouTubePubSubSubscriptionStatusResult
} from "@maiks-yt/integrations";

import type { ProviderRuntimeCredentialSummary } from "./youtube-owner-consent.types.js";
import type { YouTubePersistedChannel } from "./youtube-channel-discovery.types.js";

const developmentBetterAuthSecret = "development-only-better-auth-secret-change-before-production";
const youtubeChannelRefPrefix = "youtube-channel:v1:";

export const youtubeOwnerConsentConnectPath = "/admin/provider-integrations/youtube/connect" as const;

type BrowserContractEnvironment = Record<string, string | undefined>;

export type ProviderChatControlState =
  | "stopped"
  | "connecting"
  | "waiting"
  | "connected"
  | "unconfigured";

export type ProviderChatControlGuidance =
  | "configuration_needed"
  | "ready_to_start"
  | "running"
  | "waiting_for_live_chat";

export type ProviderChatControlStatusDto = {
  state: ProviderChatControlState;
  connectedAt: string | null;
  lastActivityAt: string | null;
  guidance: ProviderChatControlGuidance;
};

export type ProviderChatControlSuccessDto = {
  ok: true;
  readOnly: true;
  status: ProviderChatControlStatusDto;
};

export type YouTubeCredentialStatusDto = {
  state: "connected" | "disconnected" | "needs_attention";
};

export type YouTubeOwnerConsentBrowserResult =
  | {
    ok: true;
    credential: YouTubeCredentialStatusDto | null;
    action: "connect" | "reconnect" | "none";
    connectPath?: typeof youtubeOwnerConsentConnectPath;
  }
  | {
    ok: false;
    reason:
      | "provider_integrations_user_unlinked"
      | "provider_integrations_forbidden"
      | "youtube_oauth_client_missing"
      | "youtube_oauth_redirect_missing"
      | "youtube_oauth_state_secret_missing"
      | "youtube_oauth_state_invalid"
      | "youtube_oauth_exchange_failed"
      | "youtube_oauth_refresh_token_missing";
  };

export type YouTubeBrowserChannel = {
  channelRef: string | null;
  title: string;
  selectedForLiveChat: boolean;
};

export type YouTubeChannelBrowserResult =
  | {
    ok: true;
    channels: readonly YouTubeBrowserChannel[];
    selectedChannelRef: string | null;
  }
  | {
    ok: false;
    reason:
      | "provider_integrations_user_unlinked"
      | "provider_integrations_forbidden"
      | "youtube_oauth_client_missing"
      | "youtube_oauth_redirect_missing"
      | "youtube_channel_credential_missing"
      | "youtube_channel_scope_missing"
      | "youtube_channel_not_found"
      | "youtube_channel_ref_unavailable"
      | "youtube_channel_discovery_failed";
  };

export type TwitchEventSubDefaultBrowserStatus = {
  type: TwitchEventSubDefaultSubscriptionStatus["desired"]["type"];
  state: TwitchEventSubDefaultSubscriptionStatus["state"];
};

export type TwitchEventSubListBrowserResult =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterLogins: readonly string[];
    defaults: readonly TwitchEventSubDefaultBrowserStatus[];
    readOnly: true;
    subscriptionCount: number;
    subscriptionState: "loaded";
  }
  | {
    ok: false;
    reason:
      | "twitch_eventsub_user_unlinked"
      | "twitch_eventsub_forbidden"
      | "twitch_eventsub_config_missing"
      | "twitch_eventsub_broadcaster_not_configured"
      | "twitch_eventsub_broadcaster_not_found"
      | "twitch_eventsub_api_unavailable";
  };

export type TwitchEventSubEnsureBrowserResult =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterLogins: readonly string[];
    results: readonly {
      type: TwitchEventSubDefaultSubscriptionStatus["desired"]["type"];
      state: "already_enabled" | "already_pending" | "created" | "create_failed";
    }[];
    subscriptionState: "loaded";
  }
  | Extract<TwitchEventSubListBrowserResult, { ok: false }>;

export type YouTubePubSubBrowserResult =
  | {
    ok: true;
    readOnly: true;
    state: "ready";
  }
  | {
    ok: false;
    reason:
      | "youtube_pubsub_user_unlinked"
      | "youtube_pubsub_forbidden"
      | "youtube_pubsub_channel_missing"
      | "youtube_pubsub_config_missing"
      | "youtube_pubsub_hub_unavailable";
  };

export type YouTubePubSubRequestBrowserResult =
  | {
    ok: true;
    mode: "subscribe" | "unsubscribe";
    readOnly: true;
    state: "requested";
  }
  | Extract<YouTubePubSubBrowserResult, { ok: false }>;

export type YouTubeActivitiesPollBrowserResult =
  | {
    ok: true;
    fetched: number;
    inserted: number;
    polledAt: string;
    readOnly: true;
  }
  | {
    ok: false;
    reason:
      | "youtube_activities_user_unlinked"
      | "youtube_activities_forbidden"
      | "youtube_activities_context_missing"
      | "youtube_activities_poll_failed"
      | "youtube_activities_write_failed";
  };

export const getYouTubeChannelSelectionRefSecret = (
  environment: BrowserContractEnvironment = process.env
): string | null => {
  const configuredSecret = environment.BETTER_AUTH_SECRET?.trim();

  if (configuredSecret) {
    return `maiks-yt:youtube-channel-selection:v1:${configuredSecret}`;
  }

  return environment.NODE_ENV === "production"
    ? null
    : `maiks-yt:youtube-channel-selection:v1:${developmentBetterAuthSecret}`;
};

const updateDelimited = (hmac: ReturnType<typeof createHmac>, value: string): void => {
  hmac.update(String(Buffer.byteLength(value, "utf8")), "utf8");
  hmac.update(":", "utf8");
  hmac.update(value, "utf8");
  hmac.update("|", "utf8");
};

export const createYouTubeChannelSelectionRef = ({
  authUserId,
  channelId,
  domainUserId,
  secret
}: {
  authUserId: string;
  channelId: string;
  domainUserId: string;
  secret: string;
}): string => {
  const hmac = createHmac("sha256", secret);

  updateDelimited(hmac, authUserId);
  updateDelimited(hmac, domainUserId);
  updateDelimited(hmac, channelId);

  return `${youtubeChannelRefPrefix}${hmac.digest("base64url")}`;
};

const timingSafeStringEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const resolveYouTubeChannelSelectionRef = ({
  authUserId,
  channels,
  domainUserId,
  channelRef,
  secret
}: {
  authUserId: string;
  channels: readonly Pick<YouTubePersistedChannel, "id">[];
  domainUserId: string;
  channelRef: string;
  secret: string;
}): string | null => {
  let resolvedChannelId: string | null = null;

  for (const channel of channels) {
    const expectedRef = createYouTubeChannelSelectionRef({
      authUserId,
      channelId: channel.id,
      domainUserId,
      secret
    });

    if (timingSafeStringEqual(channelRef, expectedRef)) {
      resolvedChannelId = channel.id;
    }
  }

  return resolvedChannelId;
};

const getChatGuidance = (state: ProviderChatControlState): ProviderChatControlGuidance => {
  if (state === "unconfigured") return "configuration_needed";
  if (state === "connected" || state === "connecting") return "running";
  if (state === "waiting") return "waiting_for_live_chat";
  return "ready_to_start";
};

export const projectTwitchChatControlStatus = (
  status: TwitchChatIntakeStatus
): ProviderChatControlSuccessDto => ({
  ok: true,
  readOnly: true,
  status: {
    connectedAt: status.connectedAt,
    guidance: getChatGuidance(status.state),
    lastActivityAt: status.lastMessageAt,
    state: status.state
  }
});

export const projectDiscordChatControlStatus = (
  status: DiscordChatIntakeStatus
): ProviderChatControlSuccessDto => ({
  ok: true,
  readOnly: true,
  status: {
    connectedAt: status.connectedAt,
    guidance: getChatGuidance(status.state),
    lastActivityAt: status.lastMessageAt,
    state: status.state
  }
});

export const projectYouTubeLiveChatControlStatus = (
  status: YouTubeLiveChatIntakeStatus
): ProviderChatControlSuccessDto => ({
  ok: true,
  readOnly: true,
  status: {
    connectedAt: status.connectedAt,
    guidance: getChatGuidance(status.state),
    lastActivityAt: status.lastMessageAt,
    state: status.state
  }
});

export const projectYouTubeCredential = (
  credential: ProviderRuntimeCredentialSummary | null
): Pick<Extract<YouTubeOwnerConsentBrowserResult, { ok: true }>, "action" | "credential"> => {
  if (!credential) {
    return {
      action: "connect",
      credential: null
    };
  }

  if (credential.status === "active") {
    return {
      action: "none",
      credential: { state: "connected" }
    };
  }

  return {
    action: "reconnect",
    credential: { state: "needs_attention" }
  };
};

export const projectYouTubeChannels = ({
  authUserId,
  channels,
  domainUserId,
  secret
}: {
  authUserId: string;
  channels: readonly Pick<YouTubePersistedChannel, "id" | "selectedForLiveChat" | "title">[];
  domainUserId: string;
  secret: string;
}): Extract<YouTubeChannelBrowserResult, { ok: true }> => {
  const projectedChannels = channels.map((channel) => ({
    channelRef: createYouTubeChannelSelectionRef({
      authUserId,
      channelId: channel.id,
      domainUserId,
      secret
    }),
    selectedForLiveChat: channel.selectedForLiveChat,
    title: channel.title
  }));

  return {
    channels: projectedChannels,
    ok: true,
    selectedChannelRef: projectedChannels.find((channel) => channel.selectedForLiveChat)?.channelRef ?? null
  };
};

export const projectDiscoveredYouTubeChannels = (
  result: YouTubeChannelDiscoveryResult
): YouTubeChannelBrowserResult => {
  if (!result.ok) {
    return result;
  }

  return {
    channels: result.channels.map((channel) => ({
      channelRef: null,
      selectedForLiveChat: false,
      title: channel.title
    })),
    ok: true,
    selectedChannelRef: null
  };
};

export const projectTwitchEventSubDefaults = (
  result: TwitchEventSubSubscriptionListResult
): TwitchEventSubListBrowserResult => {
  if (!result.ok) {
    return result;
  }

  return {
    broadcasterLogin: result.broadcasterLogin,
    broadcasterLogins: result.broadcasterLogins,
    defaults: result.defaults.map((entry) => ({
      state: entry.state,
      type: entry.desired.type
    })),
    ok: true,
    readOnly: true,
    subscriptionCount: result.subscriptions.length,
    subscriptionState: "loaded"
  };
};

export const projectTwitchEventSubEnsureDefaults = (
  result: TwitchEventSubEnsureDefaultsResult
): TwitchEventSubEnsureBrowserResult => {
  if (!result.ok) {
    return result;
  }

  return {
    broadcasterLogin: result.broadcasterLogin,
    broadcasterLogins: result.broadcasterLogins,
    ok: true,
    results: result.results.map((entry) => ({
      state: entry.state,
      type: entry.desired.type
    })),
    subscriptionState: "loaded"
  };
};

export const projectYouTubePubSubStatus = (
  result: YouTubePubSubSubscriptionStatusResult
): YouTubePubSubBrowserResult => {
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    readOnly: true,
    state: "ready"
  };
};

export const projectYouTubePubSubRequest = (
  result: YouTubePubSubSubscriptionRequestResult
): YouTubePubSubRequestBrowserResult => {
  if (!result.ok) {
    return result;
  }

  return {
    mode: result.mode,
    ok: true,
    readOnly: true,
    state: "requested"
  };
};

export const projectYouTubeActivitiesPoll = (
  result: Extract<YouTubeActivitiesPollResult, { ok: true }>,
  inserted: number
): Extract<YouTubeActivitiesPollBrowserResult, { ok: true }> => ({
  fetched: result.events.length,
  inserted,
  ok: true,
  polledAt: result.polledAt,
  readOnly: true
});
