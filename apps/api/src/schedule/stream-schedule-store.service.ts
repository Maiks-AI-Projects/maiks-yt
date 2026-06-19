import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  StreamScheduleCancellationInput,
  StreamScheduleCancellationReasonCode,
  StreamScheduleEntry,
  StreamScheduleInput,
  StreamScheduleStatus,
  StreamScheduleUpdateInput,
  StreamScheduleVisibility
} from "@maiks-yt/domain/schedule";

import type {
  StreamScheduleAdminActor,
  StreamScheduleRepository
} from "./stream-schedule.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | number | boolean | Date | null;

type StreamScheduleRow = {
  id: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  channelKey: string;
  topicKey?: string | null;
  themeKey?: string | null;
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
  cancellationReasonCode?: StreamScheduleCancellationReasonCode | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const mapStream = (row: StreamScheduleRow): StreamScheduleEntry => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt?.toISOString() ?? null,
  channelKey: row.channelKey,
  topicKey: row.topicKey ?? null,
  themeKey: row.themeKey ?? null,
  visibility: row.visibility,
  status: row.status,
  cancellationReasonCode: row.cancellationReasonCode ?? null,
  cancellationReason: row.cancellationReason ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const selectStreamFields = `
  id,
  title,
  description,
  starts_at AS startsAt,
  ends_at AS endsAt,
  channel_key AS channelKey,
  topic_key AS topicKey,
  theme_key AS themeKey,
  visibility,
  status,
  cancellation_reason_code AS cancellationReasonCode,
  cancellation_reason AS cancellationReason,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const readStream = async (
  executor: QueryExecutor,
  id: string
): Promise<StreamScheduleEntry | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectStreamFields}
      FROM stream_schedule_entries
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapStream(rows[0] as StreamScheduleRow)
    : null;
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<StreamScheduleAdminActor | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      LEFT JOIN user_roles ON user_roles.user_id = users.id
      LEFT JOIN roles ON roles.id = user_roles.role_id
      WHERE auth_user_links.auth_user_id = ?
        AND users.deleted_at IS NULL
      ORDER BY roles.key
    `,
    [authUserId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const actorRows = rows as Array<{
    domainUserId: string;
    rolePermissions: unknown;
  }>;
  const domainUserId = actorRows[0]?.domainUserId;

  if (!domainUserId) {
    return null;
  }

  return {
    domainUserId,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

const writeValues = (input: StreamScheduleInput) => [
  input.title,
  input.description ?? null,
  new Date(input.startsAt),
  input.endsAt ? new Date(input.endsAt) : null,
  input.channelKey,
  input.topicKey ?? null,
  input.themeKey ?? null,
  input.visibility,
  input.status,
  input.cancellationReasonCode ?? null,
  input.cancellationReason ?? null
];

const toUpdateAssignments = (input: StreamScheduleUpdateInput): {
  assignments: string[];
  values: SqlValue[];
} => {
  const assignments: string[] = [];
  const values: SqlValue[] = [];
  const add = (column: string, value: SqlValue): void => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (input.title !== undefined) add("title", input.title);
  if (input.description !== undefined) add("description", input.description);
  if (input.startsAt !== undefined) add("starts_at", new Date(input.startsAt));
  if (input.endsAt !== undefined) add("ends_at", input.endsAt ? new Date(input.endsAt) : null);
  if (input.channelKey !== undefined) add("channel_key", input.channelKey);
  if (input.topicKey !== undefined) add("topic_key", input.topicKey);
  if (input.themeKey !== undefined) add("theme_key", input.themeKey);
  if (input.visibility !== undefined) add("visibility", input.visibility);
  if (input.status !== undefined) add("status", input.status);
  if (input.cancellationReasonCode !== undefined) add("cancellation_reason_code", input.cancellationReasonCode);
  if (input.cancellationReason !== undefined) add("cancellation_reason", input.cancellationReason);

  return { assignments, values };
};

export const createStreamScheduleRepository = (
  pool: DatabasePool
): StreamScheduleRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async getStream(id) {
    return await readStream(pool, id);
  },

  async listPublicStreams({ now }) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectStreamFields}
        FROM stream_schedule_entries
        WHERE visibility = 'public'
          AND status IN ('planned', 'cancelled')
          AND starts_at >= ?
        ORDER BY starts_at, title
      `,
      [now]
    );

    return Array.isArray(rows)
      ? (rows as StreamScheduleRow[]).map(mapStream)
      : [];
  },

  async listAdminStreams() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectStreamFields}
        FROM stream_schedule_entries
        ORDER BY starts_at DESC, title
      `
    );

    return Array.isArray(rows)
      ? (rows as StreamScheduleRow[]).map(mapStream)
      : [];
  },

  async createStream(input) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO stream_schedule_entries
          (id, title, description, starts_at, ends_at, channel_key, topic_key, theme_key, visibility, status, cancellation_reason_code, cancellation_reason, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, ...writeValues(input), input.actorUserId]
    );

    const stream = await readStream(pool, id);

    if (!stream) {
      throw new Error("stream_schedule_mutation_reread_failed");
    }

    return stream;
  },

  async updateStream(id, input) {
    const { assignments, values } = toUpdateAssignments(input);
    const [result] = await pool.execute(
      `
        UPDATE stream_schedule_entries
        SET ${assignments.join(", ")}, updated_at = NOW()
        WHERE id = ?
      `,
      [...values, id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }

    const stream = await readStream(pool, id);

    if (!stream) {
      throw new Error("stream_schedule_mutation_reread_failed");
    }

    return stream;
  },

  async cancelStream(id, input: StreamScheduleCancellationInput) {
    return await this.updateStream(id, {
      status: "cancelled",
      cancellationReasonCode: input.cancellationReasonCode,
      cancellationReason: input.cancellationReason
    });
  }
});
