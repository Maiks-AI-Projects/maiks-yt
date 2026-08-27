import type { DatabasePool } from "@maiks-yt/database";

import type {
  AdminOverviewActiveGrantRecord,
  AdminOverviewActivityRepository,
  AdminOverviewActor
} from "./admin-overview-activity.types.js";

type CountRow = {
  openWarningCount?: number | string | bigint | null;
  openCriticalCount?: number | string | bigint | null;
};

type ActiveGrantRow = {
  roleKey: string;
  rolePermissions: unknown;
  trustLevel: AdminOverviewActiveGrantRecord["trustLevel"];
};

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
  pool: Pick<DatabasePool, "execute">,
  authUserId: string
): Promise<AdminOverviewActor | null> => {
  const [rows] = await pool.execute(
    `
      SELECT roles.permissions AS rolePermissions
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

  return {
    rolePermissionValues: (rows as Array<{ rolePermissions: unknown }>).map(
      (row) => row.rolePermissions
    )
  };
};

export const createAdminOverviewActivityRepository = (
  pool: DatabasePool
): AdminOverviewActivityRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
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

  async listActiveHelperGrants() {
    const [rows] = await pool.execute(
      `
        SELECT
          roles.\`key\` AS roleKey,
          roles.permissions AS rolePermissions,
          user_roles.trust_level AS trustLevel
        FROM user_roles
        INNER JOIN users ON users.id = user_roles.user_id
        INNER JOIN roles ON roles.id = user_roles.role_id
        WHERE users.deleted_at IS NULL
          AND user_roles.revoked_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
          AND user_roles.trust_level <> 'owner'
          AND roles.\`key\` NOT IN ('owner', 'admin')
        ORDER BY user_roles.assigned_at DESC
      `
    );

    return Array.isArray(rows)
      ? (rows as ActiveGrantRow[]).map((row) => ({
        roleKey: row.roleKey,
        rolePermissions: parseStringArray(row.rolePermissions),
        trustLevel: row.trustLevel
      }))
      : [];
  }
});
