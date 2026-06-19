import type {
  StreamScheduleCancellationInput,
  StreamScheduleEntry,
  StreamScheduleInput,
  StreamScheduleUpdateInput
} from "@maiks-yt/domain/schedule";

export type StreamScheduleAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type StreamScheduleListResult = {
  ok: true;
  streams: readonly StreamScheduleEntry[];
};

export type StreamScheduleAdminListResult =
  | StreamScheduleListResult
  | {
    ok: false;
    reason: "stream_schedule_admin_user_unlinked" | "stream_schedule_admin_forbidden";
  };

export type StreamScheduleMutationResult =
  | {
    ok: true;
    stream: StreamScheduleEntry;
  }
  | {
    ok: false;
    reason:
      | "stream_schedule_admin_user_unlinked"
      | "stream_schedule_admin_forbidden"
      | "stream_schedule_invalid_input"
      | "stream_schedule_not_found";
  };

export interface StreamScheduleRepository {
  resolveActor(authUserId: string): Promise<StreamScheduleAdminActor | null>;
  getStream(id: string): Promise<StreamScheduleEntry | null>;
  listPublicStreams(input: { now: Date }): Promise<readonly StreamScheduleEntry[]>;
  listAdminStreams(): Promise<readonly StreamScheduleEntry[]>;
  createStream(input: StreamScheduleInput & { actorUserId: string }): Promise<StreamScheduleEntry>;
  updateStream(id: string, input: StreamScheduleUpdateInput): Promise<StreamScheduleEntry | "not-found">;
  cancelStream(id: string, input: StreamScheduleCancellationInput): Promise<StreamScheduleEntry | "not-found">;
}
