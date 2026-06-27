import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { NotificationRecord } from "@maiks-yt/domain/notifications";

import type {
  NotificationAdminActor,
  NotificationAdminRepository,
  NotificationCreateRecordInput,
  NotificationListOptions,
  NotificationStatusUpdateInput
} from "./notification-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  severity: NotificationRecord["severity"];
  source: NotificationRecord["source"];
  status: NotificationRecord["status"];
  actionUrl?: string | null;
  createdByUserId?: string | null;
  readAt?: Date | string | null;
  archivedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CountRow = {
  unreadCount?: number | string | bigint | null;
  criticalUnreadCount?: number | string | bigint | null;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value?: Date | string | null): string | null =>
  value ? toIsoString(value) : null;

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

const mapNotification = (row: NotificationRow): NotificationRecord => ({
  id: row.id,
  title: row.title,
  body: row.body,
  severity: row.severity,
  source: row.source,
  status: row.status,
  actionUrl: row.actionUrl ?? null,
  createdByUserId: row.createdByUserId ?? null,
  readAt: toNullableIsoString(row.readAt),
  archivedAt: toNullableIsoString(row.archivedAt),
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

const selectNotificationFields = `
  id,
  title,
  body,
  severity,
  source,
  status,
  action_url AS actionUrl,
  created_by_user_id AS createdByUserId,
  read_at AS readAt,
  archived_at AS archivedAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const readNotification = async (
  executor: QueryExecutor,
  id: string
): Promise<NotificationRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectNotificationFields}
      FROM system_notifications
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapNotification(rows[0] as NotificationRow)
    : null;
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<NotificationAdminActor | null> => {
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

export const createNotificationAdminRepository = (
  pool: DatabasePool
): NotificationAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listNotifications(options: NotificationListOptions) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectNotificationFields}
        FROM system_notifications
        WHERE (? = TRUE OR status <> 'archived')
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [options.includeArchived, options.limit]
    );

    return Array.isArray(rows)
      ? (rows as NotificationRow[]).map(mapNotification)
      : [];
  },

  async countUnread() {
    const [rows] = await pool.execute(
      `
        SELECT
          COUNT(*) AS unreadCount,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS criticalUnreadCount
        FROM system_notifications
        WHERE status = 'unread'
      `
    );
    const row = Array.isArray(rows) ? rows[0] as CountRow | undefined : undefined;

    return {
      unreadCount: toCount(row?.unreadCount),
      criticalUnreadCount: toCount(row?.criticalUnreadCount)
    };
  },

  async createNotification(input: NotificationCreateRecordInput) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO system_notifications
          (id, title, body, severity, source, action_url, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.title,
        input.body,
        input.severity,
        input.source,
        input.actionUrl,
        input.createdByUserId
      ]
    );

    const notification = await readNotification(pool, id);

    if (!notification) {
      throw new Error("notification_mutation_reread_failed");
    }

    return notification;
  },

  async updateNotificationStatus(input: NotificationStatusUpdateInput) {
    const [result] = await pool.execute(
      input.status === "read"
        ? `
          UPDATE system_notifications
          SET status = 'read', read_at = COALESCE(read_at, NOW()), archived_at = NULL, updated_at = NOW()
          WHERE id = ?
        `
        : `
          UPDATE system_notifications
          SET status = 'archived', archived_at = COALESCE(archived_at, NOW()), updated_at = NOW()
          WHERE id = ?
        `,
      [input.id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return null;
    }

    const notification = await readNotification(pool, input.id);

    if (!notification) {
      throw new Error("notification_mutation_reread_failed");
    }

    return notification;
  }
});
