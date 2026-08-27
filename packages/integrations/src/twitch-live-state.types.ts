export type TwitchLiveState = "live" | "offline" | "unknown";

export type TwitchLiveStateConfig = {
  clientId: string;
  clientSecret: string;
};

export type TwitchLiveStateBroadcasterIdentity = {
  id: string;
  login: string;
};

export type TwitchLiveStateAppAccessToken = {
  accessToken: string;
  expiresInSeconds: number;
};

export type TwitchLiveStateHelixStream = {
  startedAt: string | null;
  type: string | null;
  userId: string;
};

export type TwitchLiveStateHelixStreamResult =
  | { ok: true; stream: TwitchLiveStateHelixStream | null }
  | { ok: false; reason?: "api_unavailable" | "invalid_response" };

export type TwitchLiveStateHelixTransport = {
  getAppAccessToken(input: {
    clientId: string;
    clientSecret: string;
  }): Promise<TwitchLiveStateAppAccessToken | null>;
  getStreamByUserId(input: {
    accessToken: string;
    clientId: string;
    broadcasterUserId: string;
  }): Promise<TwitchLiveStateHelixStreamResult>;
  getUser(input: {
    accessToken: string;
    broadcasterLogin?: string | null;
    broadcasterUserId?: string | null;
    clientId: string;
  }): Promise<TwitchLiveStateBroadcasterIdentity | null>;
};

export type TwitchLiveStateResolveInput = {
  broadcasterLogin?: string | null;
  broadcasterUserId?: string | null;
  now?: Date;
};

export type TwitchLiveStateResolveResult =
  | {
    ok: true;
    broadcaster: TwitchLiveStateBroadcasterIdentity;
    checkedAt: Date;
    expiresAt: Date;
    source: "eventsub_cache" | "helix";
    state: Exclude<TwitchLiveState, "unknown">;
  }
  | {
    ok: false;
    reason:
      | "twitch_live_state_api_unavailable"
      | "twitch_live_state_broadcaster_not_found"
      | "twitch_live_state_config_missing"
      | "twitch_live_state_identity_missing"
      | "twitch_live_state_newer_observation_stale"
      | "twitch_live_state_response_invalid"
      | "twitch_live_state_stream_broadcaster_mismatch"
      | "twitch_live_state_stream_type_unexpected";
    state: "unknown";
  };

export type TwitchLiveStateObservationInput = {
  broadcasterLogin?: string | null;
  broadcasterUserId?: string | null;
  observedAt: Date | string | null | undefined;
  providerEventName: string;
  receivedAt?: Date | string | null;
};

export type TwitchLiveStateObservationResult =
  | { ok: true; state: Exclude<TwitchLiveState, "unknown">; stored: boolean }
  | { ok: false; reason: "unsupported_event" | "missing_identity" | "invalid_date" };
