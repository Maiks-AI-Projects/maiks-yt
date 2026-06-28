import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import { isModeratorRoleGrantable } from "@maiks-yt/domain/community";
import type {
  ModeratorGrantAvailability,
  ModeratorGrantScopeKind,
  ModeratorTrustLevel,
  RoleGrantAuditAction
} from "@maiks-yt/domain/community";

import type {
  ModeratorAdminActor,
  ModeratorAdminAuditLog,
  ModeratorAdminGrant,
  ModeratorAdminGrantCreateInput,
  ModeratorAdminRepository,
  ModeratorAdminRole,
  ModeratorAdminUser
} from "./moderator-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | boolean | null;

type ModeratorUserRow = {
  id: string;
  displayName: string;
  profileVisibility: string;
  avatarUrl?: string | null;
  authEmail?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ModeratorRoleRow = {
  id: string;
  key: string;
  name: string;
  permissions: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ModeratorGrantRow = {
  id: string;
  userId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  rolePermissions: unknown;
  trustLevel: ModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId?: string | null;
  availability: ModeratorGrantAvailability;
  assignedByUserId?: string | null;
  expiresAt?: Date | string | null;
  revokedAt?: Date | string | null;
  revokedByUserId?: string | null;
  revocationReason?: string | null;
  assignedAt: Date | string;
};

type ModeratorAuditLogRow = {
  id: string;
  targetUserId: string;
  targetDisplayName?: string | null;
  roleId: string;
  roleKey?: string | null;
  roleName?: string | null;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  action: RoleGrantAuditAction;
  previousValue: unknown;
  nextValue: unknown;
  reason?: string | null;
  createdAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : toIsoString(value);

const toSqlTimestamp = (value: string | null | undefined): string | null =>
  value ? new Date(value).toISOString().slice(0, 19).replace("T", " ") : null;

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

const parseRecord = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "string"
    ? (() => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    })()
    : value;

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
};

const mapUser = (row: ModeratorUserRow): ModeratorAdminUser => ({
  id: row.id,
  displayName: row.displayName,
  profileVisibility: row.profileVisibility,
  avatarUrl: row.avatarUrl ?? null,
  authEmail: row.authEmail ?? null,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

const mapRole = (row: ModeratorRoleRow): ModeratorAdminRole => {
  const role = {
    id: row.id,
    key: row.key,
    name: row.name,
    permissions: parseStringArray(row.permissions),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  };

  return {
    ...role,
    grantable: isModeratorRoleGrantable(role)
  };
};

const getGrantStatus = (
  row: Pick<ModeratorGrantRow, "expiresAt" | "revokedAt">
): ModeratorAdminGrant["status"] => {
  if (row.revokedAt) {
    return "revoked";
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
};

const mapGrant = (row: ModeratorGrantRow): ModeratorAdminGrant => ({
  id: row.id,
  userId: row.userId,
  roleId: row.roleId,
  roleKey: row.roleKey,
  roleName: row.roleName,
  rolePermissions: parseStringArray(row.rolePermissions),
  trustLevel: row.trustLevel,
  scopeKind: row.scopeKind,
  scopeId: row.scopeId ?? null,
  availability: row.availability,
  assignedByUserId: row.assignedByUserId ?? null,
  expiresAt: toNullableIsoString(row.expiresAt),
  revokedAt: toNullableIsoString(row.revokedAt),
  revokedByUserId: row.revokedByUserId ?? null,
  revocationReason: row.revocationReason ?? null,
  assignedAt: toIsoString(row.assignedAt),
  status: getGrantStatus(row)
});

const mapAuditLog = (row: ModeratorAuditLogRow): ModeratorAdminAuditLog => ({
  id: row.id,
  targetUserId: row.targetUserId,
  targetDisplayName: row.targetDisplayName ?? null,
  roleId: row.roleId,
  roleKey: row.roleKey ?? null,
  roleName: row.roleName ?? null,
  actorUserId: row.actorUserId ?? null,
  actorDisplayName: row.actorDisplayName ?? null,
  action: row.action,
  previousValue: parseRecord(row.previousValue),
  nextValue: parseRecord(row.nextValue),
  reason: row.reason ?? null,
  createdAt: toIsoString(row.createdAt)
});

const selectGrantFields = `
  user_roles.id,
  user_roles.user_id AS userId,
  user_roles.role_id AS roleId,
  roles.key AS roleKey,
  roles.name AS roleName,
  roles.permissions AS rolePermissions,
  user_roles.trust_level AS trustLevel,
  user_roles.scope_kind AS scopeKind,
  user_roles.scope_id AS scopeId,
  user_roles.availability,
  user_roles.assigned_by_user_id AS assignedByUserId,
  user_roles.expires_at AS expiresAt,
  user_roles.revoked_at AS revokedAt,
  user_roles.revoked_by_user_id AS revokedByUserId,
  user_roles.revocation_reason AS revocationReason,
  user_roles.assigned_at AS assignedAt
`;

const selectAuditFields = `
  logs.id,
  logs.target_user_id AS targetUserId,
  target_users.display_name AS targetDisplayName,
  logs.role_id AS roleId,
  roles.key AS roleKey,
  roles.name AS roleName,
  logs.actor_user_id AS actorUserId,
  actor_users.display_name AS actorDisplayName,
  logs.action,
  logs.previous_value AS previousValue,
  logs.next_value AS nextValue,
  logs.reason,
  logs.created_at AS createdAt
`;

const grantSnapshot = (grant: ModeratorAdminGrant): Record<string, unknown> => ({
  id: grant.id,
  userId: grant.userId,
  roleId: grant.roleId,
  roleKey: grant.roleKey,
  trustLevel: grant.trustLevel,
  scopeKind: grant.scopeKind,
  scopeId: grant.scopeId,
  availability: grant.availability,
  assignedByUserId: grant.assignedByUserId,
  expiresAt: grant.expiresAt,
  revokedAt: grant.revokedAt,
  revokedByUserId: grant.revokedByUserId,
  revocationReason: grant.revocationReason,
  assignedAt: grant.assignedAt,
  status: grant.status
});

const readGrant = async (
  executor: QueryExecutor,
  id: string
): Promise<ModeratorAdminGrant | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectGrantFields}
      FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.id = ?
      LIMIT 1
    `,
    [id]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapGrant(rows[0] as ModeratorGrantRow)
    : null;
};

const readAuditLog = async (
  executor: QueryExecutor,
  id: string
): Promise<ModeratorAdminAuditLog> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectAuditFields}
      FROM role_grant_audit_logs logs
      LEFT JOIN users target_users ON target_users.id = logs.target_user_id
      LEFT JOIN users actor_users ON actor_users.id = logs.actor_user_id
      LEFT JOIN roles ON roles.id = logs.role_id
      WHERE logs.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("moderator_admin_audit_reread_failed");
  }

  return mapAuditLog(rows[0] as ModeratorAuditLogRow);
};

const insertAuditLog = async (
  executor: QueryExecutor,
  input: {
    targetUserId: string;
    roleId: string;
    actorUserId: string;
    action: RoleGrantAuditAction;
    previousValue: Record<string, unknown> | null;
    nextValue: Record<string, unknown> | null;
    reason: string | null;
  }
): Promise<ModeratorAdminAuditLog> => {
  const id = randomUUID();

  await executor.execute(
    `
      INSERT INTO role_grant_audit_logs
        (id, target_user_id, role_id, actor_user_id, action, previous_value, next_value, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.targetUserId,
      input.roleId,
      input.actorUserId,
      input.action,
      input.previousValue === null ? null : JSON.stringify(input.previousValue),
      input.nextValue === null ? null : JSON.stringify(input.nextValue),
      input.reason
    ]
  );

  return await readAuditLog(executor, id);
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<ModeratorAdminActor | null> => {
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

const listUsers = async (executor: QueryExecutor): Promise<readonly ModeratorAdminUser[]> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id,
        users.display_name AS displayName,
        users.profile_visibility AS profileVisibility,
        users.avatar_url AS avatarUrl,
        auth_users.email AS authEmail,
        users.created_at AS createdAt,
        users.updated_at AS updatedAt
      FROM users
      LEFT JOIN auth_user_links ON auth_user_links.user_id = users.id
      LEFT JOIN auth_users ON auth_users.id = auth_user_links.auth_user_id
      WHERE users.deleted_at IS NULL
      ORDER BY users.display_name, users.created_at DESC
    `
  );

  return Array.isArray(rows) ? (rows as ModeratorUserRow[]).map(mapUser) : [];
};

const listRoles = async (executor: QueryExecutor): Promise<readonly ModeratorAdminRole[]> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        \`key\`,
        name,
        permissions,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM roles
      ORDER BY \`key\`
    `
  );

  return Array.isArray(rows) ? (rows as ModeratorRoleRow[]).map(mapRole) : [];
};

const readRole = async (
  executor: QueryExecutor,
  roleId: string
): Promise<ModeratorAdminRole | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        \`key\`,
        name,
        permissions,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM roles
      WHERE id = ?
      LIMIT 1
    `,
    [roleId]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapRole(rows[0] as ModeratorRoleRow)
    : null;
};

const readUser = async (
  executor: QueryExecutor,
  userId: string
): Promise<ModeratorAdminUser | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id,
        users.display_name AS displayName,
        users.profile_visibility AS profileVisibility,
        users.avatar_url AS avatarUrl,
        auth_users.email AS authEmail,
        users.created_at AS createdAt,
        users.updated_at AS updatedAt
      FROM users
      LEFT JOIN auth_user_links ON auth_user_links.user_id = users.id
      LEFT JOIN auth_users ON auth_users.id = auth_user_links.auth_user_id
      WHERE users.id = ?
        AND users.deleted_at IS NULL
      LIMIT 1
    `,
    [userId]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapUser(rows[0] as ModeratorUserRow)
    : null;
};

const readGrantByUserRole = async (
  executor: QueryExecutor,
  userId: string,
  roleId: string
): Promise<ModeratorAdminGrant | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectGrantFields}
      FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = ?
        AND user_roles.role_id = ?
      LIMIT 1
    `,
    [userId, roleId]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapGrant(rows[0] as ModeratorGrantRow)
    : null;
};

export const createModeratorAdminRepository = (
  pool: DatabasePool
): ModeratorAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listUsers() {
    return await listUsers(pool);
  },

  async listRoles() {
    return await listRoles(pool);
  },

  async listGrants() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectGrantFields}
        FROM user_roles
        INNER JOIN roles ON roles.id = user_roles.role_id
        INNER JOIN users ON users.id = user_roles.user_id
        WHERE users.deleted_at IS NULL
        ORDER BY users.display_name, roles.key
      `
    );

    return Array.isArray(rows) ? (rows as ModeratorGrantRow[]).map(mapGrant) : [];
  },

  async listAuditLogs(limit) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectAuditFields}
        FROM role_grant_audit_logs logs
        LEFT JOIN users target_users ON target_users.id = logs.target_user_id
        LEFT JOIN users actor_users ON actor_users.id = logs.actor_user_id
        LEFT JOIN roles ON roles.id = logs.role_id
        ORDER BY logs.created_at DESC
        LIMIT ?
      `,
      [limit]
    );

    return Array.isArray(rows) ? (rows as ModeratorAuditLogRow[]).map(mapAuditLog) : [];
  },

  async getUser(userId) {
    return await readUser(pool, userId);
  },

  async getRole(roleId) {
    return await readRole(pool, roleId);
  },

  async getGrant(grantId) {
    return await readGrant(pool, grantId);
  },

  async getGrantByUserRole(userId, roleId) {
    return await readGrantByUserRole(pool, userId, roleId);
  },

  async grantRole(input: ModeratorAdminGrantCreateInput & {
    actorUserId: string;
  }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await readGrantByUserRole(connection, input.targetUserId, input.roleId);

      if (existing && existing.status !== "revoked") {
        await connection.rollback();
        return "exists";
      }

      const grantId = existing?.id ?? randomUUID();
      const values: SqlValue[] = [
        input.trustLevel,
        input.scopeKind,
        input.scopeId,
        input.availability,
        input.actorUserId,
        toSqlTimestamp(input.expiresAt)
      ];

      if (existing) {
        await connection.execute(
          `
            UPDATE user_roles
            SET trust_level = ?,
              scope_kind = ?,
              scope_id = ?,
              availability = ?,
              assigned_by_user_id = ?,
              expires_at = ?,
              revoked_at = NULL,
              revoked_by_user_id = NULL,
              revocation_reason = NULL,
              assigned_at = NOW()
            WHERE id = ?
          `,
          [...values, grantId]
        );
      } else {
        await connection.execute(
          `
            INSERT INTO user_roles
              (id, user_id, role_id, trust_level, scope_kind, scope_id, availability, assigned_by_user_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            grantId,
            input.targetUserId,
            input.roleId,
            ...values
          ]
        );
      }

      const grant = await readGrant(connection, grantId);

      if (!grant) {
        throw new Error("moderator_admin_grant_reread_failed");
      }

      const auditLog = await insertAuditLog(connection, {
        targetUserId: grant.userId,
        roleId: grant.roleId,
        actorUserId: input.actorUserId,
        action: "grant",
        previousValue: null,
        nextValue: grantSnapshot(grant),
        reason: input.reason
      });

      await connection.commit();
      return { grant, auditLog };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateGrant(grantId, input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await readGrant(connection, grantId);

      if (!existing || existing.status === "revoked") {
        await connection.rollback();
        return "not-found";
      }

      const fields: string[] = [];
      const values: SqlValue[] = [];

      if (input.trustLevel !== undefined) {
        fields.push("trust_level = ?");
        values.push(input.trustLevel);
      }
      if (input.scopeKind !== undefined) {
        fields.push("scope_kind = ?");
        values.push(input.scopeKind);
      }
      if (input.scopeId !== undefined) {
        fields.push("scope_id = ?");
        values.push(input.scopeId);
      }
      if (input.availability !== undefined) {
        fields.push("availability = ?");
        values.push(input.availability);
      }
      if (input.expiresAt !== undefined) {
        fields.push("expires_at = ?");
        values.push(toSqlTimestamp(input.expiresAt));
      }

      if (fields.length > 0) {
        await connection.execute(
          `UPDATE user_roles SET ${fields.join(", ")} WHERE id = ?`,
          [...values, grantId]
        );
      }

      const grant = await readGrant(connection, grantId);

      if (!grant) {
        throw new Error("moderator_admin_grant_reread_failed");
      }

      const auditLog = await insertAuditLog(connection, {
        targetUserId: grant.userId,
        roleId: grant.roleId,
        actorUserId: input.actorUserId,
        action: "update",
        previousValue: grantSnapshot(existing),
        nextValue: grantSnapshot(grant),
        reason: input.reason ?? null
      });

      await connection.commit();
      return { grant, auditLog };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async revokeGrant(grantId, input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existing = await readGrant(connection, grantId);

      if (!existing || existing.status === "revoked") {
        await connection.rollback();
        return "not-found";
      }

      await connection.execute(
        `
          UPDATE user_roles
          SET revoked_at = NOW(),
            revoked_by_user_id = ?,
            revocation_reason = ?
          WHERE id = ?
        `,
        [input.actorUserId, input.reason, grantId]
      );

      const grant = await readGrant(connection, grantId);

      if (!grant) {
        throw new Error("moderator_admin_grant_reread_failed");
      }

      const auditLog = await insertAuditLog(connection, {
        targetUserId: grant.userId,
        roleId: grant.roleId,
        actorUserId: input.actorUserId,
        action: "revoke",
        previousValue: grantSnapshot(existing),
        nextValue: null,
        reason: input.reason
      });

      await connection.commit();
      return { grant, auditLog };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
});
