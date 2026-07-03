import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { RoleGrantAuditAction } from "@maiks-yt/domain/community";

import type {
  ModeratorAdminActor,
  ModeratorAdminAuditLog,
  ModeratorAdminGrant,
  ModeratorAdminGrantCreateInput,
  ModeratorAdminRankPath,
  ModeratorAdminRankPathInput,
  ModeratorAdminRepository,
  ModeratorAdminRole,
  ModeratorAdminRoleInput,
  ModeratorAdminUser
} from "./moderator-admin.types.js";
import {
  grantSnapshot,
  mapAuditLog,
  mapGrant,
  mapRankPath,
  mapRole,
  mapUser,
  selectAuditFields,
  selectGrantFields,
  toSqlTimestamp,
  type ModeratorAuditLogRow,
  type ModeratorGrantRow,
  type ModeratorRankPathRow,
  type ModeratorRoleRow,
  type ModeratorUserRow,
  type QueryExecutor,
  type SqlValue
} from "./moderator-admin-store-mappers.service.js";

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
        roles.id,
        roles.\`key\`,
        roles.name,
        roles.permissions,
        roles.rank_path_id AS rankPathId,
        role_rank_paths.\`key\` AS rankPathKey,
        role_rank_paths.name AS rankPathName,
        roles.rank_level AS rankLevel,
        roles.display_label AS displayLabel,
        roles.next_role_id AS nextRoleId,
        roles.discord_role_id AS discordRoleId,
        roles.is_owner_rank AS isOwnerRank,
        roles.is_system AS isSystem,
        roles.created_at AS createdAt,
        roles.updated_at AS updatedAt
      FROM roles
      LEFT JOIN role_rank_paths ON role_rank_paths.id = roles.rank_path_id
      ORDER BY role_rank_paths.sort_order, roles.rank_level, roles.\`key\`
    `
  );

  return Array.isArray(rows) ? (rows as ModeratorRoleRow[]).map(mapRole) : [];
};

const listRankPaths = async (executor: QueryExecutor): Promise<readonly ModeratorAdminRankPath[]> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        \`key\`,
        name,
        description,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM role_rank_paths
      ORDER BY sort_order, \`key\`
    `
  );

  return Array.isArray(rows) ? (rows as ModeratorRankPathRow[]).map(mapRankPath) : [];
};

const readRole = async (
  executor: QueryExecutor,
  roleId: string
): Promise<ModeratorAdminRole | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        roles.id,
        roles.\`key\`,
        roles.name,
        roles.permissions,
        roles.rank_path_id AS rankPathId,
        role_rank_paths.\`key\` AS rankPathKey,
        role_rank_paths.name AS rankPathName,
        roles.rank_level AS rankLevel,
        roles.display_label AS displayLabel,
        roles.next_role_id AS nextRoleId,
        roles.discord_role_id AS discordRoleId,
        roles.is_owner_rank AS isOwnerRank,
        roles.is_system AS isSystem,
        roles.created_at AS createdAt,
        roles.updated_at AS updatedAt
      FROM roles
      LEFT JOIN role_rank_paths ON role_rank_paths.id = roles.rank_path_id
      WHERE roles.id = ?
      LIMIT 1
    `,
    [roleId]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapRole(rows[0] as ModeratorRoleRow)
    : null;
};

const readRoleByKey = async (
  executor: QueryExecutor,
  key: string
): Promise<ModeratorAdminRole | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        roles.id,
        roles.\`key\`,
        roles.name,
        roles.permissions,
        roles.rank_path_id AS rankPathId,
        role_rank_paths.\`key\` AS rankPathKey,
        role_rank_paths.name AS rankPathName,
        roles.rank_level AS rankLevel,
        roles.display_label AS displayLabel,
        roles.next_role_id AS nextRoleId,
        roles.discord_role_id AS discordRoleId,
        roles.is_owner_rank AS isOwnerRank,
        roles.is_system AS isSystem,
        roles.created_at AS createdAt,
        roles.updated_at AS updatedAt
      FROM roles
      LEFT JOIN role_rank_paths ON role_rank_paths.id = roles.rank_path_id
      WHERE roles.\`key\` = ?
      LIMIT 1
    `,
    [key]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapRole(rows[0] as ModeratorRoleRow)
    : null;
};

const readRankPath = async (
  executor: QueryExecutor,
  rankPathId: string
): Promise<ModeratorAdminRankPath | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        \`key\`,
        name,
        description,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM role_rank_paths
      WHERE id = ?
      LIMIT 1
    `,
    [rankPathId]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapRankPath(rows[0] as ModeratorRankPathRow)
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

const readRankPathByKey = async (
  executor: QueryExecutor,
  key: string
): Promise<ModeratorAdminRankPath | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        \`key\`,
        name,
        description,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM role_rank_paths
      WHERE \`key\` = ?
      LIMIT 1
    `,
    [key]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapRankPath(rows[0] as ModeratorRankPathRow)
    : null;
};

const createRankPath = async (
  executor: QueryExecutor,
  input: ModeratorAdminRankPathInput
): Promise<ModeratorAdminRankPath | "exists"> => {
  if (await readRankPathByKey(executor, input.key)) {
    return "exists";
  }

  const id = randomUUID();
  await executor.execute(
    `
      INSERT INTO role_rank_paths
        (id, \`key\`, name, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `,
    [id, input.key, input.name, input.description, input.sortOrder]
  );

  const rankPath = await readRankPath(executor, id);

  if (!rankPath) {
    throw new Error("moderator_admin_rank_path_reread_failed");
  }

  return rankPath;
};

const updateRankPath = async (
  executor: QueryExecutor,
  rankPathId: string,
  input: ModeratorAdminRankPathInput
): Promise<ModeratorAdminRankPath | "not-found" | "exists"> => {
  const existing = await readRankPath(executor, rankPathId);

  if (!existing) {
    return "not-found";
  }

  const duplicate = await readRankPathByKey(executor, input.key);
  if (duplicate && duplicate.id !== rankPathId) {
    return "exists";
  }

  await executor.execute(
    `
      UPDATE role_rank_paths
      SET \`key\` = ?,
        name = ?,
        description = ?,
        sort_order = ?
      WHERE id = ?
    `,
    [input.key, input.name, input.description, input.sortOrder, rankPathId]
  );

  const rankPath = await readRankPath(executor, rankPathId);

  if (!rankPath) {
    throw new Error("moderator_admin_rank_path_reread_failed");
  }

  return rankPath;
};

const ensureRoleRankPathExists = async (
  executor: QueryExecutor,
  input: ModeratorAdminRoleInput
): Promise<boolean> =>
  input.rankPathId === null || await readRankPath(executor, input.rankPathId) !== null;

const createRole = async (
  executor: QueryExecutor,
  input: ModeratorAdminRoleInput
): Promise<ModeratorAdminRole | "exists" | "rank-path-not-found"> => {
  if (await readRoleByKey(executor, input.key)) {
    return "exists";
  }

  if (!await ensureRoleRankPathExists(executor, input)) {
    return "rank-path-not-found";
  }

  const id = randomUUID();
  await executor.execute(
    `
      INSERT INTO roles
        (id, \`key\`, name, permissions, rank_path_id, rank_level, display_label, next_role_id, discord_role_id, is_owner_rank, is_system)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.key,
      input.name,
      JSON.stringify(input.permissions),
      input.rankPathId,
      input.rankLevel,
      input.displayLabel,
      input.nextRoleId,
      input.discordRoleId,
      input.isOwnerRank,
      input.isSystem
    ]
  );

  const role = await readRole(executor, id);

  if (!role) {
    throw new Error("moderator_admin_role_reread_failed");
  }

  return role;
};

const updateRole = async (
  executor: QueryExecutor,
  roleId: string,
  input: ModeratorAdminRoleInput
): Promise<ModeratorAdminRole | "not-found" | "exists" | "rank-path-not-found"> => {
  const existing = await readRole(executor, roleId);

  if (!existing) {
    return "not-found";
  }

  const duplicate = await readRoleByKey(executor, input.key);
  if (duplicate && duplicate.id !== roleId) {
    return "exists";
  }

  if (!await ensureRoleRankPathExists(executor, input)) {
    return "rank-path-not-found";
  }

  await executor.execute(
    `
      UPDATE roles
      SET \`key\` = ?,
        name = ?,
        permissions = ?,
        rank_path_id = ?,
        rank_level = ?,
        display_label = ?,
        next_role_id = ?,
        discord_role_id = ?,
        is_owner_rank = ?,
        is_system = ?
      WHERE id = ?
    `,
    [
      input.key,
      input.name,
      JSON.stringify(input.permissions),
      input.rankPathId,
      input.rankLevel,
      input.displayLabel,
      input.nextRoleId,
      input.discordRoleId,
      input.isOwnerRank,
      input.isSystem,
      roleId
    ]
  );

  const role = await readRole(executor, roleId);

  if (!role) {
    throw new Error("moderator_admin_role_reread_failed");
  }

  return role;
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

  async listRankPaths() {
    return await listRankPaths(pool);
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

  async getRankPath(rankPathId) {
    return await readRankPath(pool, rankPathId);
  },

  async getRole(roleId) {
    return await readRole(pool, roleId);
  },

  async getRoleByKey(key) {
    return await readRoleByKey(pool, key);
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
  },

  async createRankPath(input) {
    return await createRankPath(pool, input);
  },

  async updateRankPath(rankPathId, input) {
    return await updateRankPath(pool, rankPathId, input);
  },

  async createRole(input) {
    return await createRole(pool, input);
  },

  async updateRole(roleId, input) {
    return await updateRole(pool, roleId, input);
  }
});
