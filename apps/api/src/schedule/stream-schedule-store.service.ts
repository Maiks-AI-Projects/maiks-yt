import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  StreamScheduleCancellationInput,
  StreamScheduleCancellationReasonCode,
  StreamScheduleChannelOption,
  StreamScheduleChannelProvider,
  StreamScheduleChannelTarget,
  StreamScheduleEntry,
  StreamScheduleGameLink,
  StreamScheduleGameLinkRelationship,
  StreamScheduleGameOption,
  StreamScheduleProjectOption,
  StreamScheduleInput,
  StreamScheduleStatus,
  StreamScheduleUpdateInput,
  StreamScheduleVisibility
} from "@maiks-yt/domain/schedule";

import type {
  StreamScheduleAdminActor,
  StreamScheduleRepository
} from "./stream-schedule.types.js";
import { enqueueStreamProviderDeliveries } from "./stream-provider-delivery-store.service.js";

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
  projectId?: string | null;
  focusLabel?: string | null;
  focusNote?: string | null;
  focusProjectId?: string | null;
  focusProjectSlug?: string | null;
  focusProjectTitle?: string | null;
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
  cancellationReasonCode?: StreamScheduleCancellationReasonCode | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StreamScheduleGameLinkRow = {
  id: string;
  gameId: string;
  scheduleEntryId: string;
  slug: string;
  title: string;
  platformLabel?: string | null;
  ownershipStatus: StreamScheduleGameLink["ownershipStatus"];
  interestStatus: StreamScheduleGameLink["interestStatus"];
  relationship: StreamScheduleGameLinkRelationship;
  publicNote?: string | null;
  sortOrder: number;
};

type StreamScheduleGameOptionRow = StreamScheduleGameOption;

type StreamScheduleChannelTargetRow = {
  scheduleEntryId: string;
  channelRef: string;
  provider: StreamScheduleChannelProvider;
  providerChannelId: string;
  displayName: string;
  handle?: string | null;
};

const mapStream = (
  row: StreamScheduleRow,
  gameLinks: readonly StreamScheduleGameLink[] = [],
  channelTargets: readonly StreamScheduleChannelTarget[] = []
): StreamScheduleEntry => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt?.toISOString() ?? null,
  channelKey: row.channelKey,
  topicKey: row.topicKey ?? null,
  themeKey: row.themeKey ?? null,
  projectId: row.projectId ?? null,
  focusLabel: row.focusLabel ?? null,
  focusNote: row.focusNote ?? null,
  focusProject: row.focusProjectId && row.focusProjectSlug && row.focusProjectTitle
    ? {
      id: row.focusProjectId,
      slug: row.focusProjectSlug,
      title: row.focusProjectTitle
    }
    : null,
  gameLinks,
  channelTargets,
  visibility: row.visibility,
  status: row.status,
  cancellationReasonCode: row.cancellationReasonCode ?? null,
  cancellationReason: row.cancellationReason ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapGameLink = (row: StreamScheduleGameLinkRow): StreamScheduleGameLink => ({
  id: row.id,
  gameId: row.gameId,
  slug: row.slug,
  title: row.title,
  platformLabel: row.platformLabel ?? null,
  ownershipStatus: row.ownershipStatus,
  interestStatus: row.interestStatus,
  relationship: row.relationship,
  publicNote: row.publicNote ?? null,
  sortOrder: row.sortOrder
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
  project_id AS projectId,
  focus_label AS focusLabel,
  focus_note AS focusNote,
  visibility,
  status,
  cancellation_reason_code AS cancellationReasonCode,
  cancellation_reason AS cancellationReason,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const publicStreamFields = `
  stream_schedule_entries.id,
  stream_schedule_entries.title,
  stream_schedule_entries.description,
  stream_schedule_entries.starts_at AS startsAt,
  stream_schedule_entries.ends_at AS endsAt,
  stream_schedule_entries.channel_key AS channelKey,
  stream_schedule_entries.topic_key AS topicKey,
  stream_schedule_entries.theme_key AS themeKey,
  CASE WHEN projects.id IS NOT NULL THEN stream_schedule_entries.project_id ELSE NULL END AS projectId,
  CASE WHEN projects.id IS NOT NULL THEN stream_schedule_entries.focus_label ELSE NULL END AS focusLabel,
  CASE WHEN projects.id IS NOT NULL THEN stream_schedule_entries.focus_note ELSE NULL END AS focusNote,
  stream_schedule_entries.visibility,
  stream_schedule_entries.status,
  stream_schedule_entries.cancellation_reason_code AS cancellationReasonCode,
  stream_schedule_entries.cancellation_reason AS cancellationReason,
  stream_schedule_entries.created_at AS createdAt,
  stream_schedule_entries.updated_at AS updatedAt,
  projects.id AS focusProjectId,
  projects.slug AS focusProjectSlug,
  projects.title AS focusProjectTitle
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

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const linksByStreamId = await readGameLinksForStreams(executor, [id], false);
  const targetsByStreamId = await readChannelTargetsForStreams(executor, [id]);
  return mapStream(rows[0] as StreamScheduleRow, linksByStreamId.get(id) ?? [], targetsByStreamId.get(id) ?? []);
};

const readStreamByCreationRequest = async (
  executor: QueryExecutor,
  actorUserId: string,
  creationRequestId: string
): Promise<StreamScheduleEntry | null> => {
  const [rows] = await executor.execute(
    `
      SELECT id
      FROM stream_schedule_entries
      WHERE created_by_user_id = ? AND creation_request_id = ?
      LIMIT 1
    `,
    [actorUserId, creationRequestId]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return await readStream(executor, String((rows[0] as { id: string }).id));
};

const isDuplicateEntryError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && (error as { code?: unknown }).code === "ER_DUP_ENTRY";

const readChannelTargetsForStreams = async (
  executor: QueryExecutor,
  streamIds: readonly string[]
): Promise<Map<string, StreamScheduleChannelTarget[]>> => {
  const uniqueStreamIds = [...new Set(streamIds)].filter((id) => id.length > 0);
  const targetsByStreamId = new Map<string, StreamScheduleChannelTarget[]>();
  if (uniqueStreamIds.length === 0) return targetsByStreamId;

  const placeholders = uniqueStreamIds.map(() => "?").join(", ");
  const [rows] = await executor.execute(
    `
      SELECT
        schedule_entry_id AS scheduleEntryId,
        channel_ref AS channelRef,
        provider,
        provider_channel_id_snapshot AS providerChannelId,
        display_name_snapshot AS displayName,
        handle_snapshot AS handle
      FROM stream_schedule_channel_targets
      WHERE schedule_entry_id IN (${placeholders})
      ORDER BY schedule_entry_id, sort_order, display_name_snapshot
    `,
    uniqueStreamIds
  );

  if (!Array.isArray(rows)) return targetsByStreamId;
  for (const row of rows as StreamScheduleChannelTargetRow[]) {
    const current = targetsByStreamId.get(row.scheduleEntryId) ?? [];
    current.push({
      channelRef: row.channelRef,
      provider: row.provider,
      providerChannelId: row.providerChannelId,
      displayName: row.displayName,
      handle: row.handle ?? null
    });
    targetsByStreamId.set(row.scheduleEntryId, current);
  }
  return targetsByStreamId;
};

const readGameLinksForStreams = async (
  executor: QueryExecutor,
  streamIds: readonly string[],
  publicOnly: boolean
): Promise<Map<string, StreamScheduleGameLink[]>> => {
  const uniqueStreamIds = [...new Set(streamIds)].filter((id) => id.length > 0);
  const linksByStreamId = new Map<string, StreamScheduleGameLink[]>();

  if (uniqueStreamIds.length === 0) {
    return linksByStreamId;
  }

  const placeholders = uniqueStreamIds.map(() => "?").join(", ");
  const [rows] = await executor.execute(
    `
      SELECT
        game_schedule_links.id,
        game_schedule_links.game_id AS gameId,
        game_schedule_links.schedule_entry_id AS scheduleEntryId,
        game_library_entries.slug,
        game_library_entries.title,
        game_library_entries.platform_label AS platformLabel,
        game_library_entries.ownership_status AS ownershipStatus,
        game_library_entries.interest_status AS interestStatus,
        game_schedule_links.relationship,
        game_schedule_links.public_note AS publicNote,
        game_schedule_links.sort_order AS sortOrder
      FROM game_schedule_links
      INNER JOIN game_library_entries
        ON game_library_entries.id = game_schedule_links.game_id
        ${publicOnly ? "AND game_library_entries.visibility = 'public'" : ""}
      WHERE game_schedule_links.schedule_entry_id IN (${placeholders})
      ORDER BY game_schedule_links.sort_order, game_library_entries.title
    `,
    uniqueStreamIds
  );

  if (!Array.isArray(rows)) {
    return linksByStreamId;
  }

  for (const row of rows as StreamScheduleGameLinkRow[]) {
    const currentLinks = linksByStreamId.get(row.scheduleEntryId) ?? [];
    currentLinks.push(mapGameLink(row));
    linksByStreamId.set(row.scheduleEntryId, currentLinks);
  }

  return linksByStreamId;
};

const mapStreamsWithGameLinks = async (
  executor: QueryExecutor,
  rows: readonly StreamScheduleRow[],
  publicOnly: boolean
): Promise<StreamScheduleEntry[]> => {
  const linksByStreamId = await readGameLinksForStreams(
    executor,
    rows.map((row) => row.id),
    publicOnly
  );
  const targetsByStreamId = await readChannelTargetsForStreams(executor, rows.map((row) => row.id));

  return rows.map((row) => mapStream(
    row,
    linksByStreamId.get(row.id) ?? [],
    targetsByStreamId.get(row.id) ?? []
  ));
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
        AND user_roles.revoked_at IS NULL
        AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
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

const readOwnedChannelOptions = async (
  executor: QueryExecutor,
  ownerUserId: string,
  channelRefs?: readonly string[]
): Promise<StreamScheduleChannelOption[]> => {
  const refs = channelRefs ? [...new Set(channelRefs)] : null;
  if (refs && refs.length === 0) return [];
  const refFilter = refs ? `AND connected.channelRef IN (${refs.map(() => "?").join(", ")})` : "";
  const [rows] = await executor.execute(
    `
      SELECT
        connected.channelRef,
        connected.provider,
        connected.providerChannelId,
        connected.displayName,
        connected.handle
      FROM (
        SELECT
          id AS channelRef,
          provider,
          provider_channel_id AS providerChannelId,
          display_name AS displayName,
          handle
        FROM provider_channel_identities
        WHERE owner_user_id = ?
          AND provider IN ('youtube', 'twitch')

        UNION ALL

        SELECT
          accounts.id AS channelRef,
          'twitch' AS provider,
          accounts.provider_account_id AS providerChannelId,
          accounts.display_name AS displayName,
          accounts.channel_key AS handle
        FROM linked_accounts accounts
        WHERE accounts.user_id = ?
          AND accounts.provider = 'twitch'
          AND NOT EXISTS (
            SELECT 1
            FROM provider_channel_identities identities
            WHERE identities.owner_user_id = accounts.user_id
              AND identities.provider = 'twitch'
              AND identities.provider_channel_id = accounts.provider_account_id
          )
      ) connected
      WHERE 1 = 1
        ${refFilter}
      ORDER BY connected.provider, connected.displayName, connected.channelRef
    `,
    [ownerUserId, ownerUserId, ...(refs ?? [])]
  );
  const options = Array.isArray(rows) ? rows as StreamScheduleChannelOption[] : [];
  return refs
    ? options.slice().sort((left, right) => refs.indexOf(left.channelRef) - refs.indexOf(right.channelRef))
    : options;
};

const replaceChannelTargets = async (
  executor: QueryExecutor,
  streamId: string,
  options: readonly StreamScheduleChannelOption[]
): Promise<void> => {
  await executor.execute("DELETE FROM stream_schedule_channel_targets WHERE schedule_entry_id = ?", [streamId]);
  for (const [index, option] of options.entries()) {
    await executor.execute(
      `
        INSERT INTO stream_schedule_channel_targets
          (id, schedule_entry_id, channel_ref, provider, provider_channel_id_snapshot, display_name_snapshot, handle_snapshot, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [randomUUID(), streamId, option.channelRef, option.provider, option.providerChannelId, option.displayName, option.handle, index]
    );
  }
};

const writeValues = (input: StreamScheduleInput) => [
  input.title,
  input.description ?? null,
  new Date(input.startsAt),
  input.endsAt ? new Date(input.endsAt) : null,
  input.channelKey,
  input.topicKey ?? null,
  input.themeKey ?? null,
  input.projectId ?? null,
  input.focusLabel ?? null,
  input.focusNote ?? null,
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
  if (input.projectId !== undefined) add("project_id", input.projectId);
  if (input.focusLabel !== undefined) add("focus_label", input.focusLabel);
  if (input.focusNote !== undefined) add("focus_note", input.focusNote);
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
        SELECT ${publicStreamFields}
        FROM stream_schedule_entries
        LEFT JOIN projects
          ON projects.id = stream_schedule_entries.project_id
          AND projects.is_public = 1
          AND projects.status IN ('planning', 'active', 'completed')
        WHERE visibility = 'public'
          AND stream_schedule_entries.status IN ('planned', 'live', 'cancelled')
          AND (
            stream_schedule_entries.status = 'live'
            OR stream_schedule_entries.starts_at >= ?
          )
        ORDER BY stream_schedule_entries.starts_at, stream_schedule_entries.title
      `,
      [now]
    );

    return Array.isArray(rows)
      ? await mapStreamsWithGameLinks(pool, rows as StreamScheduleRow[], true)
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
      ? await mapStreamsWithGameLinks(pool, rows as StreamScheduleRow[], false)
      : [];
  },

  async listProjectOptions() {
    const [rows] = await pool.execute(
      `
        SELECT id, slug, title
        FROM projects
        WHERE is_public = 1
          AND status IN ('planning', 'active', 'completed')
        ORDER BY title, slug
      `
    );

    return Array.isArray(rows)
      ? (rows as StreamScheduleProjectOption[])
      : [];
  },

  async listGameOptions() {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          slug,
          title,
          platform_label AS platformLabel,
          ownership_status AS ownershipStatus,
          interest_status AS interestStatus,
          visibility
        FROM game_library_entries
        ORDER BY sort_order, title
      `
    );

    return Array.isArray(rows)
      ? (rows as StreamScheduleGameOptionRow[])
      : [];
  },

  async listChannelOptions(ownerUserId) {
    return await readOwnedChannelOptions(pool, ownerUserId);
  },

  async createStream(input) {
    const priorAcceptedStream = await readStreamByCreationRequest(
      pool,
      input.actorUserId,
      input.creationRequestId
    );
    if (priorAcceptedStream) return { stream: priorAcceptedStream, created: false };
    const channelOptions = input.channelRefs === undefined
      ? null
      : await readOwnedChannelOptions(pool, input.actorUserId, input.channelRefs);
    if (channelOptions && channelOptions.length !== input.channelRefs?.length) return "invalid-channel";
    const connection = await pool.getConnection();
    const id = randomUUID();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `
          INSERT INTO stream_schedule_entries
            (id, title, description, starts_at, ends_at, channel_key, topic_key, theme_key, project_id, focus_label, focus_note, visibility, status, cancellation_reason_code, cancellation_reason, created_by_user_id, creation_request_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [id, ...writeValues(input), input.actorUserId, input.creationRequestId]
      );
      if (channelOptions) await replaceChannelTargets(connection, id, channelOptions);
      const stream = await readStream(connection, id);
      if (!stream) throw new Error("stream_schedule_mutation_reread_failed");
      await enqueueStreamProviderDeliveries({
        executor: connection,
        scheduleEntryId: id,
        channelTargets: stream.channelTargets ?? [],
        visibility: stream.visibility,
        status: stream.status
      });
      await connection.commit();
      return { stream, created: true };
    } catch (error) {
      await connection.rollback();
      if (isDuplicateEntryError(error)) {
        const acceptedStream = await readStreamByCreationRequest(
          connection,
          input.actorUserId,
          input.creationRequestId
        );
        if (acceptedStream) return { stream: acceptedStream, created: false };
      }
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateStream(id, input, actorUserId) {
    const channelOptions = input.channelRefs === undefined
      ? null
      : await readOwnedChannelOptions(pool, actorUserId, input.channelRefs);
    if (channelOptions && channelOptions.length !== input.channelRefs?.length) return "invalid-channel";
    const connection = await pool.getConnection();
    const { assignments, values } = toUpdateAssignments(input);
    try {
      await connection.beginTransaction();
      const [result] = assignments.length > 0
        ? await connection.execute(
          `
            UPDATE stream_schedule_entries
            SET ${assignments.join(", ")}, updated_at = NOW()
            WHERE id = ?
          `,
          [...values, id]
        )
        : await connection.execute("SELECT id FROM stream_schedule_entries WHERE id = ?", [id]);

      if ((Array.isArray(result) && result.length === 0) || (typeof result === "object"
        && result !== null
        && "affectedRows" in result
        && result.affectedRows === 0)) {
        await connection.rollback();
        return "not-found";
      }

      if (channelOptions) await replaceChannelTargets(connection, id, channelOptions);

      const currentChannelTargets = channelOptions ?? [
        ...(await readChannelTargetsForStreams(connection, [id])).get(id) ?? []
      ];
      const stream = await readStream(connection, id);
      if (!stream) throw new Error("stream_schedule_mutation_reread_failed");
      await enqueueStreamProviderDeliveries({
        executor: connection,
        scheduleEntryId: id,
        channelTargets: currentChannelTargets,
        visibility: stream.visibility,
        status: stream.status
      });
      await connection.commit();
      return stream;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async cancelStream(id, input: StreamScheduleCancellationInput) {
    const result = await this.updateStream(id, {
      status: "cancelled",
      cancellationReasonCode: input.cancellationReasonCode,
      cancellationReason: input.cancellationReason
    }, "");
    if (result === "invalid-channel") throw new Error("stream_schedule_unreachable_channel_validation");
    return result;
  },

  async replaceGameLinks(input) {
    const stream = await readStream(pool, input.streamId);

    if (!stream) {
      return "not-found";
    }

    if (input.links.length > 0) {
      const uniqueGameIds = [...new Set(input.links.map((link) => link.gameId))];
      const placeholders = uniqueGameIds.map(() => "?").join(", ");
      const [rows] = await pool.execute(
        `
          SELECT id
          FROM game_library_entries
          WHERE id IN (${placeholders})
        `,
        uniqueGameIds
      );

      if (!Array.isArray(rows) || rows.length !== uniqueGameIds.length) {
        return "invalid-game";
      }
    }

    await pool.execute(
      "DELETE FROM game_schedule_links WHERE schedule_entry_id = ?",
      [input.streamId]
    );

    for (const link of input.links) {
      await pool.execute(
        `
          INSERT INTO game_schedule_links
            (id, game_id, schedule_entry_id, relationship, public_note, sort_order, created_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          randomUUID(),
          link.gameId,
          input.streamId,
          link.relationship,
          link.publicNote ?? null,
          link.sortOrder ?? 0,
          input.actorUserId
        ]
      );
    }

    const updatedStream = await readStream(pool, input.streamId);

    if (!updatedStream) {
      throw new Error("stream_schedule_game_links_reread_failed");
    }

    return updatedStream;
  }
});
