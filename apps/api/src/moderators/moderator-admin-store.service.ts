import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  ModeratorAdminGrantCreateInput,
  ModeratorAdminRankPath,
  ModeratorAdminRankPathInput,
  ModeratorAdminRepository,
  ModeratorAdminRole,
  ModeratorAdminRoleInput
} from "./moderator-admin.types.js";
import {
  grantSnapshot,
  mapAuditLog,
  mapGrant,
  selectAuditFields,
  selectGrantFields,
  toSqlTimestamp,
  type ModeratorAuditLogRow,
  type ModeratorGrantRow,
  type QueryExecutor,
  type SqlValue
} from "./moderator-admin-store-mappers.service.js";
import {
  insertAuditLog,
  listRankPaths,
  listRoles,
  listUsers,
  readGrant,
  readGrantByUserRole,
  readRankPath,
  readRankPathByKey,
  readRole,
  readRoleByKey,
  readUser,
  resolveActor
} from "./moderator-admin-store-queries.service.js";

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
