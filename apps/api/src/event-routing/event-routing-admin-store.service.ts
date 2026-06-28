import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  EventRoutingAdminActor,
  EventRoutingAdminApprovalRecord,
  EventRoutingApprovalQueueStatus,
  EventRoutingAdminRepository,
  EventRoutingAdminRuleRecord,
  EventRoutingAdminUpsertInput
} from "./event-routing-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type EventRoutingRuleRow = {
  id: string;
  eventKind: EventRoutingAdminRuleRecord["eventKind"];
  sourcePlatform: EventRoutingAdminRuleRecord["sourcePlatform"];
  destination: EventRoutingAdminRuleRecord["destination"];
  enabled: number | boolean;
  liveOnly: number | boolean;
  offlineOnly: number | boolean;
  approvalRequired: number | boolean;
  perUserCooldownSeconds?: number | null;
  globalCooldownSeconds?: number | null;
  oncePerStream: number | boolean;
  templateKey?: string | null;
  themeKey?: string | null;
  soundKey?: string | null;
  notificationPriority: EventRoutingAdminRuleRecord["notificationPriority"];
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type EventRoutingApprovalRow = {
  id: string;
  eventHistoryId: string;
  routingRuleId?: string | null;
  destination: EventRoutingAdminApprovalRecord["destination"];
  status: EventRoutingApprovalQueueStatus;
  reviewerUserId?: string | null;
  reviewedAt?: Date | string | null;
  reviewNote?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  sourcePlatform: EventRoutingAdminApprovalRecord["event"]["sourcePlatform"];
  eventKind: EventRoutingAdminApprovalRecord["event"]["eventKind"];
  sourceEventId?: string | null;
  routingOutcome: "queued_for_approval";
  actorUserId?: string | null;
  actorExternalId?: string | null;
  actorDisplayName?: string | null;
  userId?: string | null;
  streamSessionId?: string | null;
  streamScheduleEntryId?: string | null;
  sessionId?: string | null;
  isTest: number | boolean;
  isSimulated: number | boolean;
  isRealMoney: number | boolean;
  testResettable: number | boolean;
  redactedPayload: unknown;
  occurredAt: Date | string;
  historyCreatedAt: Date | string;
  notificationPriority?: EventRoutingAdminApprovalRecord["rule"]["notificationPriority"] | null;
  ruleSourcePlatform?: EventRoutingAdminApprovalRecord["rule"]["sourcePlatform"] | null;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapRule = (row: EventRoutingRuleRow): EventRoutingAdminRuleRecord => ({
  id: row.id,
  eventKind: row.eventKind,
  sourcePlatform: row.sourcePlatform,
  destination: row.destination,
  enabled: Boolean(row.enabled),
  liveOnly: Boolean(row.liveOnly),
  offlineOnly: Boolean(row.offlineOnly),
  approvalRequired: Boolean(row.approvalRequired),
  perUserCooldownSeconds: row.perUserCooldownSeconds ?? null,
  globalCooldownSeconds: row.globalCooldownSeconds ?? null,
  oncePerStream: Boolean(row.oncePerStream),
  templateKey: row.templateKey ?? null,
  themeKey: row.themeKey ?? null,
  soundKey: row.soundKey ?? null,
  notificationPriority: row.notificationPriority,
  createdByUserId: row.createdByUserId ?? null,
  updatedByUserId: row.updatedByUserId ?? null,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

const parseRedactedPayload = (value: unknown): Record<string, unknown> => {
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

const selectRuleFields = `
  id,
  event_kind AS eventKind,
  source_platform AS sourcePlatform,
  destination,
  enabled,
  live_only AS liveOnly,
  offline_only AS offlineOnly,
  approval_required AS approvalRequired,
  per_user_cooldown_seconds AS perUserCooldownSeconds,
  global_cooldown_seconds AS globalCooldownSeconds,
  once_per_stream AS oncePerStream,
  template_key AS templateKey,
  theme_key AS themeKey,
  sound_key AS soundKey,
  notification_priority AS notificationPriority,
  created_by_user_id AS createdByUserId,
  updated_by_user_id AS updatedByUserId,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const selectApprovalFields = `
  q.id,
  q.event_history_id AS eventHistoryId,
  q.routing_rule_id AS routingRuleId,
  q.destination,
  q.status,
  q.reviewer_user_id AS reviewerUserId,
  q.reviewed_at AS reviewedAt,
  q.review_note AS reviewNote,
  q.created_at AS createdAt,
  q.updated_at AS updatedAt,
  h.source_platform AS sourcePlatform,
  h.event_kind AS eventKind,
  h.source_event_id AS sourceEventId,
  h.routing_outcome AS routingOutcome,
  h.actor_user_id AS actorUserId,
  h.actor_external_id AS actorExternalId,
  h.actor_display_name AS actorDisplayName,
  h.user_id AS userId,
  h.stream_session_id AS streamSessionId,
  h.stream_schedule_entry_id AS streamScheduleEntryId,
  h.session_id AS sessionId,
  h.is_test AS isTest,
  h.is_simulated AS isSimulated,
  h.is_real_money AS isRealMoney,
  h.test_resettable AS testResettable,
  h.redacted_payload AS redactedPayload,
  h.occurred_at AS occurredAt,
  h.created_at AS historyCreatedAt,
  r.notification_priority AS notificationPriority,
  r.source_platform AS ruleSourcePlatform
`;

const mapApproval = (row: EventRoutingApprovalRow): EventRoutingAdminApprovalRecord => {
  const createdAt = toIsoString(row.createdAt);

  return {
    id: row.id,
    eventHistoryId: row.eventHistoryId,
    routingRuleId: row.routingRuleId ?? null,
    destination: row.destination,
    status: row.status,
    reviewerUserId: row.reviewerUserId ?? null,
    reviewedAt: row.reviewedAt ? toIsoString(row.reviewedAt) : null,
    reviewNote: row.reviewNote ?? null,
    createdAt,
    updatedAt: toIsoString(row.updatedAt),
    event: {
      id: row.eventHistoryId,
      sourcePlatform: row.sourcePlatform,
      eventKind: row.eventKind,
      sourceEventId: row.sourceEventId ?? null,
      routingOutcome: "queued_for_approval",
      actorUserId: row.actorUserId ?? null,
      actorExternalId: row.actorExternalId ?? null,
      actorDisplayName: row.actorDisplayName ?? null,
      userId: row.userId ?? null,
      streamSessionId: row.streamSessionId ?? null,
      streamScheduleEntryId: row.streamScheduleEntryId ?? null,
      sessionId: row.sessionId ?? null,
      isTest: Boolean(row.isTest),
      isSimulated: Boolean(row.isSimulated),
      isRealMoney: Boolean(row.isRealMoney),
      testResettable: Boolean(row.testResettable),
      redactedPayload: parseRedactedPayload(row.redactedPayload),
      occurredAt: toIsoString(row.occurredAt),
      createdAt: toIsoString(row.historyCreatedAt)
    },
    rule: {
      notificationPriority: row.notificationPriority ?? "normal",
      sourcePlatform: row.ruleSourcePlatform ?? null
    },
    label: "",
    description: "",
    safety: {
      overlayEligible: false,
      internalOnly: false,
      moneyGated: false,
      providerGated: false,
      approvalRecommended: false,
      optOutSupported: false,
      cooldownRecommended: false,
      simulatedOnly: false
    },
    playback: null
  };
};

const readApproval = async (
  executor: QueryExecutor,
  id: string,
  status?: EventRoutingApprovalQueueStatus
): Promise<EventRoutingAdminApprovalRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectApprovalFields}
      FROM event_approval_queue q
      INNER JOIN event_history h ON h.id = q.event_history_id
      LEFT JOIN event_routing_rules r ON r.id = q.routing_rule_id
      WHERE q.id = ?
        ${status ? "AND q.status = ?" : ""}
        AND h.is_real_money = false
        AND (h.is_test = true OR h.is_simulated = true)
        AND h.test_resettable = true
      LIMIT 1
    `,
    status ? [id, status] : [id]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapApproval(rows[0] as EventRoutingApprovalRow)
    : null;
};

const readRule = async (
  executor: QueryExecutor,
  eventKind: EventRoutingAdminRuleRecord["eventKind"],
  sourcePlatform: EventRoutingAdminRuleRecord["sourcePlatform"]
): Promise<EventRoutingAdminRuleRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectRuleFields}
      FROM event_routing_rules
      WHERE event_kind = ?
        AND source_platform = ?
      LIMIT 1
    `,
    [eventKind, sourcePlatform]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapRule(rows[0] as EventRoutingRuleRow)
    : null;
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<EventRoutingAdminActor | null> => {
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

export const createEventRoutingAdminRepository = (
  pool: DatabasePool
): EventRoutingAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listRules() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectRuleFields}
        FROM event_routing_rules
        ORDER BY event_kind, source_platform
      `
    );

    return Array.isArray(rows)
      ? (rows as EventRoutingRuleRow[]).map(mapRule)
      : [];
  },

  async listPendingApprovals(limit) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectApprovalFields}
        FROM event_approval_queue q
        INNER JOIN event_history h ON h.id = q.event_history_id
        LEFT JOIN event_routing_rules r ON r.id = q.routing_rule_id
        WHERE q.status = 'pending'
          AND h.routing_outcome = 'queued_for_approval'
          AND h.is_real_money = false
          AND (h.is_test = true OR h.is_simulated = true)
          AND h.test_resettable = true
        ORDER BY q.created_at ASC
        LIMIT ?
      `,
      [limit]
    );

    return Array.isArray(rows)
      ? (rows as EventRoutingApprovalRow[]).map(mapApproval)
      : [];
  },

  async getPendingApproval(id) {
    return await readApproval(pool, id, "pending");
  },

  async getRule(eventKind, sourcePlatform) {
    return await readRule(pool, eventKind, sourcePlatform);
  },

  async upsertRule(input: EventRoutingAdminUpsertInput) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO event_routing_rules
          (
            id,
            event_kind,
            source_platform,
            destination,
            enabled,
            live_only,
            offline_only,
            approval_required,
            per_user_cooldown_seconds,
            global_cooldown_seconds,
            once_per_stream,
            template_key,
            theme_key,
            sound_key,
            notification_priority,
            created_by_user_id,
            updated_by_user_id
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          destination = VALUES(destination),
          enabled = VALUES(enabled),
          live_only = VALUES(live_only),
          offline_only = VALUES(offline_only),
          approval_required = VALUES(approval_required),
          per_user_cooldown_seconds = VALUES(per_user_cooldown_seconds),
          global_cooldown_seconds = VALUES(global_cooldown_seconds),
          once_per_stream = VALUES(once_per_stream),
          template_key = VALUES(template_key),
          theme_key = VALUES(theme_key),
          sound_key = VALUES(sound_key),
          notification_priority = VALUES(notification_priority),
          updated_by_user_id = VALUES(updated_by_user_id),
          updated_at = NOW()
      `,
      [
        id,
        input.eventKind,
        input.sourcePlatform,
        input.destination,
        input.enabled,
        input.liveOnly,
        input.offlineOnly,
        input.approvalRequired,
        input.perUserCooldownSeconds,
        input.globalCooldownSeconds,
        input.oncePerStream,
        input.templateKey,
        input.themeKey,
        input.soundKey,
        input.notificationPriority,
        input.actorUserId,
        input.actorUserId
      ]
    );

    const rule = await readRule(pool, input.eventKind, input.sourcePlatform);

    if (!rule) {
      throw new Error("event_routing_admin_mutation_reread_failed");
    }

    return rule;
  },

  async reviewApproval(input) {
    await pool.execute(
      `
        UPDATE event_approval_queue
        SET
          status = ?,
          reviewer_user_id = ?,
          reviewed_at = NOW(),
          review_note = ?,
          updated_at = NOW()
        WHERE id = ?
          AND status = 'pending'
      `,
      [
        input.status,
        input.reviewerUserId,
        input.reviewNote,
        input.id
      ]
    );

    const approval = await readApproval(pool, input.id);

    return approval
      ? {
        ...approval,
        playback: input.playback
      }
      : null;
  }
});
