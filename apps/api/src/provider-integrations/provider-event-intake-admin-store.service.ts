import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { EventKind } from "@maiks-yt/domain/events";

import type {
  ProviderEventIntakeAdminActor,
  NormalizedProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminRepository,
  ProviderEventIntakeAdminRow,
  ProviderEventIntakeHealthRow,
  ProviderEventIntakeReviewCandidate,
  ProviderEventIntakeReviewHistory
} from "./provider-event-intake-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | number | boolean | null;

type IntakeRow = Omit<ProviderEventIntakeAdminRow, "redactedPayloadPreview" | "occurredAt" | "receivedAt"> & {
  redactedPayloadPreview: unknown;
  occurredAt: Date | string | null;
  receivedAt: Date | string;
};

type MutationResult = {
  affectedRows?: number;
};

const booleanToSql = (value: boolean): 0 | 1 => value ? 1 : 0;

const parsePayloadPreview = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const toIsoString = (value: Date | string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

const mapRow = (row: IntakeRow): ProviderEventIntakeAdminRow => ({
  ...row,
  occurredAt: toIsoString(row.occurredAt),
  receivedAt: toIsoString(row.receivedAt) ?? new Date(0).toISOString(),
  redactedPayloadPreview: parsePayloadPreview(row.redactedPayloadPreview)
});

const mapHealthRow = (
  row: Omit<ProviderEventIntakeHealthRow, "lastReceivedAt" | "rowCount"> & {
    lastReceivedAt: Date | string | null;
    rowCount: number | string;
  }
): ProviderEventIntakeHealthRow => ({
  ...row,
  lastReceivedAt: toIsoString(row.lastReceivedAt),
  rowCount: Number(row.rowCount)
});

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<ProviderEventIntakeAdminActor | null> => {
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

const buildWhere = (filters: NormalizedProviderEventIntakeAdminFilters): {
  clauses: string[];
  values: SqlValue[];
} => {
  const clauses: string[] = [];
  const values: SqlValue[] = [];

  if (filters.provider !== "any") {
    clauses.push("provider = ?");
    values.push(filters.provider);
  }

  if (filters.processingStatus !== "any") {
    clauses.push("processing_status = ?");
    values.push(filters.processingStatus);
  }

  for (const [key, column] of [
    ["catalogKnown", "catalog_known"],
    ["moneyShaped", "money_shaped"],
    ["moderationShaped", "moderation_shaped"],
    ["authOrTokenShaped", "auth_or_token_shaped"],
    ["highVolume", "high_volume"]
  ] as const) {
    const value = filters[key];
    if (value !== null) {
      clauses.push(`${column} = ?`);
      values.push(booleanToSql(value));
    }
  }

  return { clauses, values };
};

export const createProviderEventIntakeAdminRepository = (
  pool: QueryExecutor
): ProviderEventIntakeAdminRepository => ({
  async findReviewCandidate(id) {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          provider,
          mechanism,
          provider_event_name AS providerEventName,
          internal_trigger AS internalTrigger,
          category,
          source_event_id AS sourceEventId,
          provider_channel_id AS providerChannelId,
          provider_message_id AS providerMessageId,
          actor_external_id AS actorExternalId,
          actor_display_name AS actorDisplayName,
          catalog_known AS catalogKnown,
          money_shaped AS moneyShaped,
          moderation_shaped AS moderationShaped,
          auth_or_token_shaped AS authOrTokenShaped,
          high_volume AS highVolume,
          overlay_eligible_by_default AS overlayEligibleByDefault,
          processing_status AS processingStatus,
          event_history_id AS eventHistoryId,
          redacted_payload AS redactedPayloadPreview,
          occurred_at AS occurredAt,
          received_at AS receivedAt
        FROM provider_event_intake_logs
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return Array.isArray(rows) && rows.length > 0
      ? mapRow(rows[0] as IntakeRow) as ProviderEventIntakeReviewCandidate
      : null;
  },
  async listHealthRows() {
    const [rows] = await pool.execute(
      `
        SELECT
          summary.provider,
          summary.mechanism,
          summary.rowCount,
          summary.lastReceivedAt,
          (
            SELECT latest.provider_event_name
            FROM provider_event_intake_logs latest
            WHERE latest.provider = summary.provider
              AND latest.mechanism = summary.mechanism
            ORDER BY latest.received_at DESC, latest.id DESC
            LIMIT 1
          ) AS lastProviderEventName
        FROM (
          SELECT
            provider,
            mechanism,
            COUNT(*) AS rowCount,
            MAX(received_at) AS lastReceivedAt
          FROM provider_event_intake_logs
          GROUP BY provider, mechanism
        ) summary
        ORDER BY summary.provider, summary.mechanism
      `
    );

    return Array.isArray(rows)
      ? (rows as Array<Parameters<typeof mapHealthRow>[0]>).map(mapHealthRow)
      : [];
  },
  async listRecent(filters) {
    const where = buildWhere(filters);
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          provider,
          mechanism,
          provider_event_name AS providerEventName,
          internal_trigger AS internalTrigger,
          category,
          source_event_id AS sourceEventId,
          provider_channel_id AS providerChannelId,
          provider_message_id AS providerMessageId,
          actor_external_id AS actorExternalId,
          actor_display_name AS actorDisplayName,
          catalog_known AS catalogKnown,
          money_shaped AS moneyShaped,
          moderation_shaped AS moderationShaped,
          auth_or_token_shaped AS authOrTokenShaped,
          high_volume AS highVolume,
          overlay_eligible_by_default AS overlayEligibleByDefault,
          processing_status AS processingStatus,
          event_history_id AS eventHistoryId,
          redacted_payload AS redactedPayloadPreview,
          occurred_at AS occurredAt,
          received_at AS receivedAt
        FROM provider_event_intake_logs
        ${where.clauses.length > 0 ? `WHERE ${where.clauses.join(" AND ")}` : ""}
        ORDER BY received_at DESC, id DESC
        LIMIT ?
      `,
      [...where.values, filters.limit]
    );

    return Array.isArray(rows)
      ? (rows as IntakeRow[]).map(mapRow)
      : [];
  },
  async markIgnored(input) {
    const [result] = await pool.execute(
      `
        UPDATE provider_event_intake_logs
        SET processing_status = 'ignored'
        WHERE id = ?
          AND event_history_id IS NULL
          AND processing_status IN ('stored', 'failed')
        LIMIT 1
      `,
      [input.id]
    );

    return Number((result as MutationResult).affectedRows ?? 0) > 0;
  },
  async mapToEventHistory(input: {
    row: ProviderEventIntakeReviewCandidate;
    eventKind: EventKind;
    reviewedByUserId: string;
  }): Promise<ProviderEventIntakeReviewHistory | null> {
    const eventHistoryId = randomUUID();
    const createdAt = new Date();
    const [markResult] = await pool.execute(
      `
        UPDATE provider_event_intake_logs
        SET processing_status = 'normalized'
        WHERE id = ?
          AND event_history_id IS NULL
          AND processing_status IN ('stored', 'failed')
        LIMIT 1
      `,
      [input.row.id]
    );

    if (Number((markResult as MutationResult).affectedRows ?? 0) === 0) {
      return null;
    }

    try {
      await pool.execute(
        `
          INSERT INTO event_history
            (
              id,
              source_platform,
              event_kind,
              source_event_id,
              routing_rule_id,
              routing_outcome,
              destination,
              actor_user_id,
              actor_external_id,
              actor_display_name,
              user_id,
              stream_session_id,
              stream_schedule_entry_id,
              session_id,
              is_test,
              is_simulated,
              is_real_money,
              test_resettable,
              redacted_payload,
              occurred_at,
              created_at
            )
          VALUES (?, ?, ?, ?, null, 'stored_internal', 'internal_audit', null, ?, ?, null, null, null, ?, false, false, false, false, ?, ?, ?)
        `,
        [
          eventHistoryId,
          input.row.provider,
          input.eventKind,
          input.row.sourceEventId ?? input.row.id,
          input.row.actorExternalId,
          input.row.actorDisplayName,
          `provider-intake:${input.row.id}`,
          JSON.stringify({
            ...input.row.redactedPayloadPreview,
            providerIntakeId: input.row.id,
            providerEventName: input.row.providerEventName,
            providerMechanism: input.row.mechanism,
            providerInternalTrigger: input.row.internalTrigger,
            providerReview: "internal_audit",
            reviewedByUserId: input.reviewedByUserId
          }),
          input.row.occurredAt ? new Date(input.row.occurredAt) : new Date(input.row.receivedAt),
          createdAt
        ]
      );

      const [mapResult] = await pool.execute(
        `
          UPDATE provider_event_intake_logs
          SET
            processing_status = 'mapped_to_event_history',
            event_history_id = ?
          WHERE id = ?
            AND processing_status = 'normalized'
          LIMIT 1
        `,
        [eventHistoryId, input.row.id]
      );

      if (Number((mapResult as MutationResult).affectedRows ?? 0) === 0) {
        await pool.execute(
          `
            UPDATE provider_event_intake_logs
            SET processing_status = 'failed'
            WHERE id = ?
            LIMIT 1
          `,
          [input.row.id]
        );
        return null;
      }

      return {
        createdAt: createdAt.toISOString(),
        destination: "internal_audit",
        eventKind: input.eventKind,
        id: eventHistoryId,
        publicPlayback: false,
        routingOutcome: "stored_internal",
        sourcePlatform: input.row.provider
      };
    } catch (error) {
      await pool.execute(
        `
          UPDATE provider_event_intake_logs
          SET processing_status = 'failed'
          WHERE id = ?
            AND processing_status = 'normalized'
          LIMIT 1
        `,
        [input.row.id]
      );
      throw error;
    }
  },
  resolveActor: (authUserId) => resolveActor(pool, authUserId)
});
