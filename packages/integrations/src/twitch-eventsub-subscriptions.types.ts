export type TwitchEventSubDefaultSubscriptionType =
  | "stream.online"
  | "stream.offline"
  | "channel.update";

export type TwitchEventSubSubscriptionStatus =
  | "enabled"
  | "webhook_callback_verification_pending"
  | "webhook_callback_verification_failed"
  | "notification_failures_exceeded"
  | "authorization_revoked"
  | "moderator_removed"
  | "user_removed"
  | "version_removed"
  | "beta_maintenance"
  | "websocket_disconnected"
  | "websocket_failed_ping_pong"
  | "websocket_received_inbound_traffic"
  | "websocket_connection_unused"
  | "websocket_internal_error"
  | "websocket_network_timeout"
  | "websocket_network_error"
  | "unknown";

export type TwitchEventSubDesiredSubscription = {
  type: TwitchEventSubDefaultSubscriptionType;
  version: "1" | "2";
};

export type TwitchEventSubSubscriptionSummary = {
  callbackMatches: boolean;
  condition: Record<string, string>;
  cost: number;
  createdAt: string | null;
  id: string;
  status: TwitchEventSubSubscriptionStatus;
  type: string;
  version: string;
};

export type TwitchEventSubDefaultSubscriptionStatus = {
  desired: TwitchEventSubDesiredSubscription;
  existing: TwitchEventSubSubscriptionSummary | null;
  state: "enabled" | "pending" | "missing" | "problem";
};

export type TwitchEventSubSubscriptionListResult =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterUserId: string;
    callbackUrl: string;
    defaults: readonly TwitchEventSubDefaultSubscriptionStatus[];
    readOnly: true;
    subscriptions: readonly TwitchEventSubSubscriptionSummary[];
  }
  | {
    ok: false;
    reason:
      | "twitch_eventsub_config_missing"
      | "twitch_eventsub_broadcaster_not_found"
      | "twitch_eventsub_api_unavailable";
  };

export type TwitchEventSubEnsureSubscriptionResult = {
  desired: TwitchEventSubDesiredSubscription;
  existing: TwitchEventSubSubscriptionSummary | null;
  created: TwitchEventSubSubscriptionSummary | null;
  state: "already_enabled" | "already_pending" | "created" | "create_failed";
};

export type TwitchEventSubEnsureDefaultsResult =
  | {
    ok: true;
    broadcasterLogin: string;
    broadcasterUserId: string;
    callbackUrl: string;
    results: readonly TwitchEventSubEnsureSubscriptionResult[];
  }
  | {
    ok: false;
    reason:
      | "twitch_eventsub_config_missing"
      | "twitch_eventsub_broadcaster_not_found"
      | "twitch_eventsub_api_unavailable";
  };

export type TwitchEventSubSubscriptionConfig = {
  broadcasterLogin: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  secret: string;
};

export type TwitchEventSubHelixUser = {
  id: string;
  login: string;
};

export type TwitchEventSubHelixSubscription = {
  condition?: Record<string, unknown>;
  cost?: number;
  created_at?: string;
  id?: string;
  status?: string;
  transport?: {
    callback?: string;
    method?: string;
  };
  type?: string;
  version?: string;
};

export type TwitchEventSubHelixTransport = {
  createSubscription(input: {
    accessToken: string;
    callbackUrl: string;
    clientId: string;
    condition: Record<string, string>;
    secret: string;
    type: string;
    version: string;
  }): Promise<TwitchEventSubHelixSubscription | null>;
  getAppAccessToken(input: {
    clientId: string;
    clientSecret: string;
  }): Promise<string | null>;
  getUserByLogin(input: {
    accessToken: string;
    clientId: string;
    login: string;
  }): Promise<TwitchEventSubHelixUser | null>;
  listSubscriptions(input: {
    accessToken: string;
    clientId: string;
  }): Promise<readonly TwitchEventSubHelixSubscription[] | null>;
};
