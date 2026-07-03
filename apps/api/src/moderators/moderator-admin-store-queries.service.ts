import { randomUUID } from "node:crypto";

import type { RoleGrantAuditAction } from "@maiks-yt/domain/community";
import type { ModeratorAdminActor, ModeratorAdminAuditLog, ModeratorAdminGrant, ModeratorAdminRankPath, ModeratorAdminRole, ModeratorAdminUser } from "./moderator-admin.types.js";
import {
  mapAuditLog,
  mapGrant,
  mapRankPath,
  mapRole,
  mapUser,
  selectAuditFields,
  selectGrantFields,
  type ModeratorAuditLogRow,
  type ModeratorGrantRow,
  type ModeratorRankPathRow,
  type ModeratorRoleRow,
  type ModeratorUserRow,
  type QueryExecutor
} from "./moderator-admin-store-mappers.service.js";

export const readGrant = async (
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

export const readAuditLog = async (
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

export const insertAuditLog = async (
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

export const resolveActor = async (
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

export const listUsers = async (executor: QueryExecutor): Promise<readonly ModeratorAdminUser[]> => {
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

export const listRoles = async (executor: QueryExecutor): Promise<readonly ModeratorAdminRole[]> => {
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

export const listRankPaths = async (executor: QueryExecutor): Promise<readonly ModeratorAdminRankPath[]> => {
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

export const readRole = async (
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

export const readRoleByKey = async (
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

export const readRankPath = async (
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

export const readUser = async (
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

export const readGrantByUserRole = async (
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

export const readRankPathByKey = async (
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
