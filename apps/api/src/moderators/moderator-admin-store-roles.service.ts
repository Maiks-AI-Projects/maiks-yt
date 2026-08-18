import { randomUUID } from "node:crypto";

import type { ModeratorAdminRankPath, ModeratorAdminRankPathInput, ModeratorAdminRole, ModeratorAdminRoleInput } from "./moderator-admin.types.js";
import type { QueryExecutor } from "./moderator-admin-store-mappers.service.js";
import { readRankPath, readRankPathByKey, readRole, readRoleByKey } from "./moderator-admin-store-queries.service.js";

export const createRankPath = async (
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

export const updateRankPath = async (
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

export const deleteRankPath = async (
  executor: QueryExecutor,
  rankPathId: string
): Promise<"deleted" | "not-found" | "in-use"> => {
  if (!await readRankPath(executor, rankPathId)) {
    return "not-found";
  }

  const [roleRows] = await executor.execute(
    "SELECT COUNT(*) AS count FROM roles WHERE rank_path_id = ?",
    [rankPathId]
  );
  const roleCount = Array.isArray(roleRows)
    ? Number((roleRows[0] as { count?: number | string } | undefined)?.count ?? 0)
    : 0;

  if (roleCount > 0) {
    return "in-use";
  }

  await executor.execute("DELETE FROM role_rank_paths WHERE id = ?", [rankPathId]);
  return "deleted";
};

export const ensureRoleRankPathExists = async (
  executor: QueryExecutor,
  input: ModeratorAdminRoleInput
): Promise<boolean> =>
  input.rankPathId === null || await readRankPath(executor, input.rankPathId) !== null;

export const createRole = async (
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

export const updateRole = async (
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

export const deleteRole = async (
  executor: QueryExecutor,
  roleId: string
): Promise<"deleted" | "not-found" | "protected" | "in-use"> => {
  const role = await readRole(executor, roleId);

  if (!role) {
    return "not-found";
  }
  if (role.isOwnerRank || role.isSystem) {
    return "protected";
  }

  const [usageRows] = await executor.execute(
    `
      SELECT
        (SELECT COUNT(*) FROM user_roles WHERE role_id = ?) AS grantCount,
        (SELECT COUNT(*) FROM role_grant_audit_logs WHERE role_id = ?) AS auditCount,
        (SELECT COUNT(*) FROM roles WHERE next_role_id = ?) AS promotionCount
    `,
    [roleId, roleId, roleId]
  );
  const usage = Array.isArray(usageRows)
    ? usageRows[0] as { grantCount?: number | string; auditCount?: number | string; promotionCount?: number | string } | undefined
    : undefined;

  if (Number(usage?.grantCount ?? 0) > 0
    || Number(usage?.auditCount ?? 0) > 0
    || Number(usage?.promotionCount ?? 0) > 0) {
    return "in-use";
  }

  await executor.execute("DELETE FROM roles WHERE id = ?", [roleId]);
  return "deleted";
};
