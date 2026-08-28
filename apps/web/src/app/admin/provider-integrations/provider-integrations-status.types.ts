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

export type ChatControlState = "stopped" | "connecting" | "waiting" | "connected" | "unconfigured";
export type ChatControlGuidance = "configuration_needed" | "ready_to_start" | "running" | "waiting_for_live_chat";

export type ChatControlStatus = {
  state: ChatControlState;
  connectedAt: string | null;
  lastActivityAt: string | null;
  guidance: ChatControlGuidance;
};

export type TwitchChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: ChatControlStatus;
  }
  | {
    ok: false;
    reason: string;
  };

export type DiscordChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: ChatControlStatus;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeLiveChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: ChatControlStatus;
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeCredentialSummary = {
  state: "connected" | "disconnected" | "needs_attention";
};

export type YouTubeCredentialResponse =
  | {
    ok: true;
    credential: YouTubeCredentialSummary | null;
    action: "connect" | "reconnect" | "none";
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeConsentResponse =
  | {
    ok: true;
    credential: YouTubeCredentialSummary | null;
    action: "connect" | "reconnect" | "none";
    connectPath: "/admin/provider-integrations/youtube/connect";
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeSavedChannel = {
  channelRef: string;
  title: string;
  selectedForLiveChat: boolean;
};

export type YouTubeChannelSelectionResponse =
  | {
    ok: true;
    channels: readonly YouTubeSavedChannel[];
    selectedChannelRef: string | null;
  }
  | {
    ok: false;
    reason: string;
  };

export type TwitchEventSubDefaultSubscriptionStatus = {
  type: string;
  state: "enabled" | "pending" | "missing" | "problem";
};

export type TwitchEventSubSubscriptionListResponse =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterLogins: readonly string[];
    defaults: readonly TwitchEventSubDefaultSubscriptionStatus[];
    readOnly: true;
    subscriptionCount: number;
    subscriptionState: "loaded";
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
    results: readonly {
      type: string;
      state: "already_enabled" | "already_pending" | "created" | "create_failed";
    }[];
    subscriptionState: "loaded";
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubePubSubSubscriptionResponse =
  | {
    ok: true;
    readOnly: true;
    state: "ready";
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubePubSubSubscriptionRequestResponse =
  | {
    ok: true;
    mode: "subscribe" | "unsubscribe";
    readOnly: true;
    state: "requested";
  }
  | {
    ok: false;
    reason: string;
  };

export type YouTubeActivitiesPollResponse =
  | {
    ok: true;
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
