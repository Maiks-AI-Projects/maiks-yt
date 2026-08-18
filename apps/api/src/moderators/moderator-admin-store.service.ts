import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  ModeratorAdminGrantCreateInput,
  ModeratorAdminRepository
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
  readRole,
  readRoleByKey,
  readUser,
  resolveActor
} from "./moderator-admin-store-queries.service.js";
import { createRankPath, createRole, deleteRankPath, deleteRole, updateRankPath, updateRole } from "./moderator-admin-store-roles.service.js";

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
        INNER JOIN auth_user_links ON auth_user_links.user_id = users.id
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

  async deleteRankPath(rankPathId) {
    return await deleteRankPath(pool, rankPathId);
  },

  async deleteRole(roleId) {
    return await deleteRole(pool, roleId);
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
