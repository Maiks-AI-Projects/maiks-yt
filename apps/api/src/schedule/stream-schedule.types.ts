import type {
  PublicStreamScheduleEntry,
  StreamScheduleCancellationInput,
  StreamScheduleChannelOption,
  StreamScheduleEntry,
  StreamScheduleGameLinkInput,
  StreamScheduleGameOption,
  StreamScheduleInput,
  StreamScheduleProjectOption,
  StreamScheduleUpdateInput
} from "@maiks-yt/domain/schedule";
import type {
  StreamProviderDeliveryProcessorResult
} from "./stream-provider-delivery-processor.service.js";
import type {
  StreamProviderDeliveryStatus
} from "@maiks-yt/domain/schedule";

export type StreamScheduleAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type StreamScheduleListResult = {
  ok: true;
  streams: readonly PublicStreamScheduleEntry[];
};

export type StreamScheduleAdminListResult =
  | {
    ok: true;
    streams: readonly StreamScheduleEntry[];
    providerDeliveries: readonly StreamScheduleProviderDeliveryStatusProjection[];
    projectOptions: readonly StreamScheduleProjectOption[];
    gameOptions: readonly StreamScheduleGameOption[];
    channelOptions: readonly StreamScheduleChannelOption[];
  }
  | {
    ok: false;
    reason: "stream_schedule_admin_user_unlinked" | "stream_schedule_admin_forbidden";
  };

export type StreamScheduleMutationResult =
  | {
    ok: true;
    stream: StreamScheduleEntry;
    replayed?: boolean;
  }
  | {
    ok: false;
    reason:
      | "stream_schedule_admin_user_unlinked"
      | "stream_schedule_admin_forbidden"
      | "stream_schedule_invalid_input"
      | "stream_schedule_not_found";
  };

export type StreamScheduleProviderDeliveryStatusProjection = {
  scheduleEntryId: string;
  channelRef: string;
  provider: "twitch" | "youtube";
  status: StreamProviderDeliveryStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  operatorActionAvailable: boolean;
};

export type StreamScheduleProviderDeliveryProcessResult =
  | {
    ok: true;
    result: StreamProviderDeliveryProcessorResult;
  }
  | {
    ok: false;
    reason: "stream_schedule_admin_user_unlinked" | "stream_schedule_admin_forbidden";
  };

export interface StreamScheduleRepository {
  resolveActor(authUserId: string): Promise<StreamScheduleAdminActor | null>;
  getStream(id: string): Promise<StreamScheduleEntry | null>;
  listPublicStreams(input: { now: Date }): Promise<readonly StreamScheduleEntry[]>;
  listAdminStreams(): Promise<readonly StreamScheduleEntry[]>;
  listProviderDeliveryStatuses(): Promise<readonly StreamScheduleProviderDeliveryStatusProjection[]>;
  listProjectOptions(): Promise<readonly StreamScheduleProjectOption[]>;
  listGameOptions(): Promise<readonly StreamScheduleGameOption[]>;
  listChannelOptions(ownerUserId: string): Promise<readonly StreamScheduleChannelOption[]>;
  createStream(input: StreamScheduleInput & {
    actorUserId: string;
    creationRequestId: string;
  }): Promise<{ stream: StreamScheduleEntry; created: boolean } | "invalid-channel">;
  updateStream(id: string, input: StreamScheduleUpdateInput, actorUserId: string): Promise<StreamScheduleEntry | "not-found" | "invalid-channel">;
  cancelStream(id: string, input: StreamScheduleCancellationInput): Promise<StreamScheduleEntry | "not-found">;
  replaceGameLinks(input: {
    streamId: string;
    links: readonly StreamScheduleGameLinkInput[];
    actorUserId: string;
  }): Promise<StreamScheduleEntry | "not-found" | "invalid-game">;
}
