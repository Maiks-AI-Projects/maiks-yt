import type { DatabasePool } from "@maiks-yt/database";

import type {
  LiveHelperDashboardActor,
  LiveHelperDashboardRepository,
  LiveHelperEventHistorySummary,
  LiveHelperGrantRecord,
  LiveHelperNotificationSummary,
  LiveHelperPendingApprovalSummary
} from "./live-helper.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type CountRow = {
  count?: number | string | bigint | null;
  openWarningCount?: number | string | bigint | null;
  openCriticalCount?: number | string | bigint | null;
};

type PendingApprovalRow = {
  id: string;
  eventHistoryId: string;
  eventKind: LiveHelperPendingApprovalSummary["eventKind"];
  sourcePlatform: LiveHelperPendingApprovalSummary["sourcePlatform"];
  destination: LiveHelperPendingApprovalSummary["destination"];
  notificationPriority?: LiveHelperPendingApprovalSummary["notificationPriority"] | null;
  actorDisplayName?: string | null;
  createdAt: Date | string;
  occurredAt: Date | string;
};

type NotificationRow = {
  id: string;
  title: string;
  severity: LiveHelperNotificationSummary["severity"];
  source: LiveHelperNotificationSummary["source"];
  status: LiveHelperNotificationSummary["status"];
  actionUrl?: string | null;
  createdAt: Date | string;
};

type ActiveGrantRow = {
  id: string;
  userId: string;
  displayName: string;
  roleKey: string;
  roleName: string;
  rolePermissions: unknown;
  trustLevel: LiveHelperGrantRecord["trustLevel"];
  scopeKind: LiveHelperGrantRecord["scopeKind"];
  scopeId?: string | null;
  availability: LiveHelperGrantRecord["availability"];
  assignedAt: Date | string;
  expiresAt?: Date | string | null;
};

type EventHistoryRow = {
  id: string;
  eventKind: LiveHelperEventHistorySummary["eventKind"];
  sourcePlatform: LiveHelperEventHistorySummary["sourcePlatform"];
  routingOutcome: LiveHelperEventHistorySummary["routingOutcome"];
  destination?: LiveHelperEventHistorySummary["destination"];
  actorDisplayName?: string | null;
  isTest: number | boolean;
  isSimulated: number | boolean;
  occurredAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : toIsoString(value);

const toCount = (value: CountRow[keyof CountRow]): number => {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10) || 0;
  }

  return 0;
};

const parseStringArray = (value: unknown): string[] => {
  const parsed = typeof value === "string"
    ? (() => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return [];
      }
    })()
    : value;

  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === "string")
    : [];
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<LiveHelperDashboardActor | null> => {
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

const mapPendingApproval = (row: PendingApprovalRow): Omit<LiveHelperPendingApprovalSummary, "label"> => ({
  id: row.id,
  eventHistoryId: row.eventHistoryId,
  eventKind: row.eventKind,
  sourcePlatform: row.sourcePlatform,
  destination: row.destination,
  notificationPriority: row.notificationPriority ?? "normal",
  actorDisplayName: row.actorDisplayName ?? null,
  createdAt: toIsoString(row.createdAt),
  occurredAt: toIsoString(row.occurredAt)
});

const mapNotification = (row: NotificationRow): LiveHelperNotificationSummary => ({
  id: row.id,
  title: row.title,
  severity: row.severity,
  source: row.source,
  status: row.status,
  actionUrl: row.actionUrl ?? null,
  createdAt: toIsoString(row.createdAt)
});

const mapGrant = (row: ActiveGrantRow): LiveHelperGrantRecord => ({
  id: row.id,
  userId: row.userId,
  displayName: row.displayName,
  roleKey: row.roleKey,
  roleName: row.roleName,
  rolePermissions: parseStringArray(row.rolePermissions),
  trustLevel: row.trustLevel,
  scopeKind: row.scopeKind,
  scopeId: row.scopeId ?? null,
  availability: row.availability,
  assignedAt: toIsoString(row.assignedAt),
  expiresAt: toNullableIsoString(row.expiresAt)
});

const mapEventHistory = (row: EventHistoryRow): Omit<LiveHelperEventHistorySummary, "label"> => ({
  id: row.id,
  eventKind: row.eventKind,
  sourcePlatform: row.sourcePlatform,
  routingOutcome: row.routingOutcome,
  destination: row.destination ?? null,
  actorDisplayName: row.actorDisplayName ?? null,
  isTest: Boolean(row.isTest),
  isSimulated: Boolean(row.isSimulated),
  occurredAt: toIsoString(row.occurredAt)
});

export const createLiveHelperDashboardRepository = (
  pool: DatabasePool
): LiveHelperDashboardRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async countPendingApprovals() {
    const [rows] = await pool.execute(
      `
        SELECT COUNT(*) AS count
        FROM event_approval_queue q
        INNER JOIN event_history h ON h.id = q.event_history_id
        WHERE q.status = 'pending'
          AND h.routing_outcome = 'queued_for_approval'
          AND h.is_real_money = false
          AND (h.is_test = true OR h.is_simulated = true)
          AND h.test_resettable = true
      `
    );
    const row = Array.isArray(rows) ? rows[0] as CountRow | undefined : undefined;

    return toCount(row?.count);
  },

  async listPendingApprovals(limit) {
    const [rows] = await pool.execute(
      `
        SELECT
          q.id,
          q.event_history_id AS eventHistoryId,
          h.event_kind AS eventKind,
          h.source_platform AS sourcePlatform,
          q.destination,
          r.notification_priority AS notificationPriority,
          h.actor_display_name AS actorDisplayName,
          q.created_at AS createdAt,
          h.occurred_at AS occurredAt
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
      ? (rows as PendingApprovalRow[]).map(mapPendingApproval)
      : [];
  },

  async countOpenWarningCriticalNotifications() {
    const [rows] = await pool.execute(
      `
        SELECT
          SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) AS openWarningCount,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS openCriticalCount
        FROM system_notifications
        WHERE status <> 'archived'
          AND severity IN ('warning', 'critical')
      `
    );
    const row = Array.isArray(rows) ? rows[0] as CountRow | undefined : undefined;

    return {
      openWarningCount: toCount(row?.openWarningCount),
      openCriticalCount: toCount(row?.openCriticalCount)
    };
  },

  async listRecentWarningCriticalNotifications(limit) {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          title,
          severity,
          source,
          status,
          action_url AS actionUrl,
          created_at AS createdAt
        FROM system_notifications
        WHERE status <> 'archived'
          AND severity IN ('warning', 'critical')
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [limit]
    );

    return Array.isArray(rows)
      ? (rows as NotificationRow[]).map(mapNotification)
      : [];
  },

  async listActiveHelperGrants(limit) {
    const [rows] = await pool.execute(
      `
        SELECT
          user_roles.id,
          user_roles.user_id AS userId,
          users.display_name AS displayName,
          roles.\`key\` AS roleKey,
          roles.name AS roleName,
          roles.permissions AS rolePermissions,
          user_roles.trust_level AS trustLevel,
          user_roles.scope_kind AS scopeKind,
          user_roles.scope_id AS scopeId,
          user_roles.availability,
          user_roles.assigned_at AS assignedAt,
          user_roles.expires_at AS expiresAt
        FROM user_roles
        INNER JOIN users ON users.id = user_roles.user_id
        INNER JOIN roles ON roles.id = user_roles.role_id
        WHERE users.deleted_at IS NULL
          AND user_roles.revoked_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
          AND user_roles.trust_level <> 'owner'
          AND roles.\`key\` NOT IN ('owner', 'admin')
        ORDER BY user_roles.assigned_at DESC
        LIMIT ?
      `,
      [limit]
    );

    return Array.isArray(rows)
      ? (rows as ActiveGrantRow[]).map(mapGrant)
      : [];
  },

  async listRecentSimulatedEventHistory(limit) {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          event_kind AS eventKind,
          source_platform AS sourcePlatform,
          routing_outcome AS routingOutcome,
          destination,
          actor_display_name AS actorDisplayName,
          is_test AS isTest,
          is_simulated AS isSimulated,
          occurred_at AS occurredAt
        FROM event_history
        WHERE is_real_money = false
          AND (is_test = true OR is_simulated = true)
          AND test_resettable = true
        ORDER BY occurred_at DESC
        LIMIT ?
      `,
      [limit]
    );

    return Array.isArray(rows)
      ? (rows as EventHistoryRow[]).map(mapEventHistory)
      : [];
  }
});
