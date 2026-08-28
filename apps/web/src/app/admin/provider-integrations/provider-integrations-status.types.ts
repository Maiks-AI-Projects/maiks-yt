export type ProviderIntegrationReadiness = "ready" | "needs_setup" | "needs_attention" | "disabled";
export type ProviderCapabilityState = "available" | "needs_setup" | "needs_attention" | "disabled";

export type ProviderRuntimeConnectionState =
  | "connected"
  | "connecting"
  | "waiting"
  | "retrying"
  | "stopped"
  | "unconfigured";

export type ProviderRuntimeStatus = {
  state: ProviderRuntimeConnectionState;
  accountSummary: string | null;
  connectedAt: string | null;
  lastActivityAt: string | null;
  nextRetryAt: string | null;
};

export type ProviderCapabilityKey =
  | "twitch_api_access"
  | "twitch_chat_intake"
  | "twitch_chat_replies"
  | "twitch_eventsub_intake"
  | "youtube_data_access"
  | "youtube_owner_consent"
  | "youtube_live_chat_intake"
  | "discord_bot_access"
  | "discord_guild_target"
  | "discord_webhook_intake"
  | "discord_chat_intake";

export type ProviderCapabilityStatus = {
  key: ProviderCapabilityKey;
  label: string;
  state: ProviderCapabilityState;
};

export type ProviderIntegrationStatus = {
  id: "twitch" | "youtube" | "discord";
  label: string;
  readiness: ProviderIntegrationReadiness;
  capabilities: readonly ProviderCapabilityStatus[];
  runtime: ProviderRuntimeStatus;
  guidance: string | null;
};

export type ProviderIntegrationStatusFailureReason =
  | "not_authenticated"
  | "provider_integrations_unavailable"
  | "provider_integrations_user_unlinked"
  | "provider_integrations_forbidden";

export type ProviderIntegrationsStatusResponse =
  | {
    ok: true;
    generatedAt: string;
    providers: readonly ProviderIntegrationStatus[];
  }
  | {
    ok: false;
    reason: ProviderIntegrationStatusFailureReason;
  };

export type TwitchChatProjectedMessage = {
  id: string;
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
  source: "twitch";
  visibleOnOverlayByDefault: false;
};

export type DiscordChatProjectedMessage = {
  id: string;
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
  source: "discord";
  visibleOnOverlayByDefault: false;
};

export type TwitchChatIntakeStatus = {
  channelName: string | null;
  channelNames: readonly string[];
  connectedAt: string | null;
  lastError: string | null;
  lastMessageAt: string | null;
  recentMessages: readonly TwitchChatProjectedMessage[];
  state: "stopped" | "connecting" | "connected" | "unconfigured";
};

export type DiscordChatIntakeStatus = {
  channelIds: readonly string[];
  connectedAt: string | null;
  disconnectsInWindow: number;
  guildId: string | null;
  lastError: string | null;
  lastDisconnectAt: string | null;
  lastMessageAt: string | null;
  nextReconnectAt: string | null;
  recentMessages: readonly DiscordChatProjectedMessage[];
  reconnectSuppressed: boolean;
  state: "stopped" | "connecting" | "connected" | "unconfigured";
};

export type YouTubeLiveChatIntakeStatus = {
  activeLiveChatId: string | null;
  channelId: string | null;
  channelName: string | null;
  connectedAt: string | null;
  lastError: string | null;
  lastMessageAt: string | null;
  nextPollAt: string | null;
  recentMessages: readonly {
    id: string;
    authorName: string;
    createdAt: string;
    message: string;
  }[];
  state: "stopped" | "connecting" | "waiting" | "connected" | "unconfigured";
};

export type TwitchChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: TwitchChatIntakeStatus;
  }
  | {
    ok: false;
    reason: string;
  };

export type DiscordChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: DiscordChatIntakeStatus;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeLiveChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: YouTubeLiveChatIntakeStatus;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeCredentialSummary = {
  provider: "youtube";
  purpose: "youtube_live_chat";
  status: "active" | "revoked" | "error";
  displayName: string | null;
  scopes: readonly string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type YouTubeConsentResponse =
  | {
    ok: true;
    credential: YouTubeCredentialSummary | null;
    redirectUri: string;
    requiredScope: string;
    consentUrl?: string;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeSavedChannel = {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
  selectedForLiveChat: boolean;
  discoveredAt: string;
  lastSeenAt: string;
  selectedAt: string | null;
  updatedAt: string | null;
};

export type YouTubeChannelSelectionResponse =
  | {
    ok: true;
    channels: readonly YouTubeSavedChannel[];
    selectedChannelId: string | null;
  }
  | {
    ok: false;
    reason: string;
  };

export type TwitchEventSubSubscriptionSummary = {
  callbackMatches: boolean;
  condition: Record<string, string>;
  createdAt: string | null;
  id: string;
  status: string;
  type: string;
  version: string;
};

export type TwitchEventSubDefaultSubscriptionStatus = {
  desired: {
    type: string;
    version: string;
  };
  existing: TwitchEventSubSubscriptionSummary | null;
  state: "enabled" | "pending" | "missing" | "problem";
};

export type TwitchEventSubSubscriptionListResponse =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterLogins: readonly string[];
    broadcasterUserId: string;
    callbackUrl: string;
    defaults: readonly TwitchEventSubDefaultSubscriptionStatus[];
    readOnly: true;
    subscriptions: readonly TwitchEventSubSubscriptionSummary[];
  }
  | {
    ok: false;
    reason: string;
  };

export type TwitchEventSubEnsureDefaultsResponse =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterLogins: readonly string[];
    broadcasterUserId: string;
    callbackUrl: string;
    results: readonly {
      desired: {
        type: string;
        version: string;
      };
      state: "already_enabled" | "already_pending" | "created" | "create_failed";
    }[];
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubePubSubSubscriptionResponse =
  | {
    ok: true;
    callbackUrl: string;
    channelId: string;
    hubUrl: string;
    readOnly: true;
    state: "ready";
    topicUrl: string;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubePubSubSubscriptionRequestResponse =
  | {
    ok: true;
    callbackUrl: string;
    channelId: string;
    hubUrl: string;
    mode: "subscribe" | "unsubscribe";
    readOnly: true;
    state: "requested";
    topicUrl: string;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeActivitiesPollResponse =
  | {
    ok: true;
    channelId: string;
    events: readonly {
      catalogKnown?: boolean;
      inserted: boolean;
      providerEventName: string;
      providerMessageId: string | null;
      sourceEventId: string;
    }[];
    fetched: number;
    inserted: number;
    polledAt: string;
    readOnly: true;
  }
  | {
    ok: false;
    reason: string;
  };

export type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";
