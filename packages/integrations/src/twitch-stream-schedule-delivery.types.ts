export const twitchScheduleDeliveryScope = "channel:manage:schedule";
export const twitchChannelMetadataDeliveryScope = "channel:manage:broadcast";

export type TwitchStreamScheduleDeliveryOperation = "schedule-segment" | "channel-metadata";

export type TwitchStreamScheduleDeliveryContext = {
  accessToken: string;
  broadcasterId: string;
  clientId: string;
  scopes: readonly string[];
};

export type TwitchStreamScheduleDeliveryInput = {
  context: TwitchStreamScheduleDeliveryContext | null;
  currentProviderState: {
    providerCategoryId: string | null;
    providerResourceId: string | null;
    providerStreamId: string | null;
  };
  operation: TwitchStreamScheduleDeliveryOperation;
  providerChannelId: string;
  schedule: {
    endsAt: string | null;
    startsAt: string;
    title: string;
  };
};

export type TwitchStreamScheduleDeliveryReceipt = {
  providerCategoryId: string | null;
  providerResourceId: string | null;
  providerStreamId: string | null;
};

export type TwitchStreamScheduleDeliveryResult =
  | {
    ok: true;
    providerActionId: string;
    receipt: TwitchStreamScheduleDeliveryReceipt;
  }
  | {
    ok: false;
    outcome: "unsupported" | "degraded" | "failed";
    reason: string;
    message: string;
    retryAfterSeconds?: number | null;
  };

export type TwitchHelixScheduleSegment = {
  category_id?: unknown;
  id?: unknown;
};

export type TwitchHelixTransportResponse<Payload> =
  | {
    ok: true;
    payload: Payload;
    retryAfterSeconds?: null;
    status: number;
  }
  | {
    ok: false;
    retryAfterSeconds?: number | null;
    status: number | null;
  };

export type TwitchStreamScheduleDeliveryTransport = {
  createScheduleSegment(input: {
    accessToken: string;
    broadcasterId: string;
    categoryId: string | null;
    clientId: string;
    durationMinutes: number;
    startsAt: string;
    timezone: string;
    title: string;
  }): Promise<TwitchHelixTransportResponse<unknown>>;
  updateChannelInformation(input: {
    accessToken: string;
    broadcasterId: string;
    categoryId: string | null;
    clientId: string;
    title: string;
  }): Promise<TwitchHelixTransportResponse<null>>;
  updateScheduleSegment(input: {
    accessToken: string;
    broadcasterId: string;
    categoryId: string | null;
    clientId: string;
    durationMinutes: number;
    segmentId: string;
    startsAt: string;
    timezone: string;
    title: string;
  }): Promise<TwitchHelixTransportResponse<unknown>>;
};
