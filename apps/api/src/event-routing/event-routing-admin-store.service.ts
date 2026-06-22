import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  EventRoutingAdminActor,
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
  }
});
