import {
  canManageStreamSchedule,
  isValidStreamScheduleCancellationInput,
  isValidStreamScheduleInput,
  isValidStreamScheduleUpdateInput,
  normalizeStreamScheduleInput,
  normalizeStreamScheduleUpdateInput
} from "@maiks-yt/domain/schedule";
import type { StreamScheduleInput } from "@maiks-yt/domain/schedule";

import type {
  StreamScheduleAdminListResult,
  StreamScheduleListResult,
  StreamScheduleMutationResult,
  StreamScheduleRepository
} from "./stream-schedule.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeStreamSchedulePermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

export class StreamScheduleService {
  public constructor(private readonly repository: StreamScheduleRepository) {}

  public async listPublicStreams(input: { now?: Date } = {}) {
    return {
      ok: true,
      streams: await this.repository.listPublicStreams({ now: input.now ?? new Date() })
    };
  }

  public async listAdminStreams(input: { authUserId: string }): Promise<StreamScheduleAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      streams: await this.repository.listAdminStreams()
    };
  }

  public async createStream(input: StreamScheduleInput & {
    authUserId: string;
  }): Promise<StreamScheduleMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const stream = normalizeStreamScheduleInput({
      ...input,
      status: input.status ?? "planned"
    });

    if (!isValidStreamScheduleInput(stream)) {
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    return {
      ok: true,
      stream: await this.repository.createStream({
        ...stream,
        actorUserId: actor.domainUserId
      })
    };
  }

  public async updateStream(input: {
    authUserId: string;
    id: string;
    stream: Parameters<StreamScheduleRepository["updateStream"]>[1];
  }): Promise<StreamScheduleMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const stream = normalizeStreamScheduleUpdateInput(input.stream);
    const existingStream = await this.repository.getStream(input.id);

    if (!isValidStreamScheduleUpdateInput(stream)) {
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    if (!existingStream) {
      return {
        ok: false,
        reason: "stream_schedule_not_found"
      };
    }

    if (!isValidStreamScheduleInput(toFullStreamScheduleInput(existingStream, stream))) {
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    const result = await this.repository.updateStream(input.id, stream);

    return result === "not-found"
      ? {
        ok: false,
        reason: "stream_schedule_not_found"
      }
      : {
        ok: true,
        stream: result
      };
  }

  public async cancelStream(input: {
    authUserId: string;
    id: string;
    cancellation: Parameters<StreamScheduleRepository["cancelStream"]>[1];
  }): Promise<StreamScheduleMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const cancellation = {
      cancellationReasonCode: input.cancellation.cancellationReasonCode,
      cancellationReason: input.cancellation.cancellationReason.trim()
    };

    if (!isValidStreamScheduleCancellationInput(cancellation)) {
      return {
        ok: false,
        reason: "stream_schedule_invalid_input"
      };
    }

    const result = await this.repository.cancelStream(input.id, cancellation);

    return result === "not-found"
      ? {
        ok: false,
        reason: "stream_schedule_not_found"
      }
      : {
        ok: true,
        stream: result
      };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "stream_schedule_admin_user_unlinked" | "stream_schedule_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "stream_schedule_admin_user_unlinked"
      };
    }

    if (!canManageStreamSchedule(normalizeStreamSchedulePermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "stream_schedule_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}

const toFullStreamScheduleInput = (
  existingStream: StreamScheduleListResult["streams"][number],
  update: Parameters<StreamScheduleRepository["updateStream"]>[1]
): StreamScheduleInput => ({
  title: update.title ?? existingStream.title,
  description: update.description === undefined ? existingStream.description : update.description,
  startsAt: update.startsAt ?? existingStream.startsAt,
  endsAt: update.endsAt === undefined ? existingStream.endsAt : update.endsAt,
  channelKey: update.channelKey ?? existingStream.channelKey,
  topicKey: update.topicKey === undefined ? existingStream.topicKey : update.topicKey,
  themeKey: update.themeKey === undefined ? existingStream.themeKey : update.themeKey,
  visibility: update.visibility ?? existingStream.visibility,
  status: update.status ?? existingStream.status,
  cancellationReasonCode: update.cancellationReasonCode === undefined
    ? existingStream.cancellationReasonCode
    : update.cancellationReasonCode,
  cancellationReason: update.cancellationReason === undefined
    ? existingStream.cancellationReason
    : update.cancellationReason
});
