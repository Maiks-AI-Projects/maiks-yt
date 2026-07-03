import { isModeratorRoleGrantable } from "@maiks-yt/domain/community";
import type { ModeratorGrantAvailability, ModeratorGrantScopeKind, ModeratorTrustLevel, RoleGrantAuditAction } from "@maiks-yt/domain/community";
import type { DatabasePool } from "@maiks-yt/database";
import type { ModeratorAdminAuditLog, ModeratorAdminGrant, ModeratorAdminRankPath, ModeratorAdminRole, ModeratorAdminUser } from "./moderator-admin.types.js";

export type QueryExecutor = Pick<DatabasePool, "execute">;
export type SqlValue = string | number | boolean | null;

export type ModeratorUserRow = {
  id: string;
  displayName: string;
  profileVisibility: string;
  avatarUrl?: string | null;
  authEmail?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ModeratorRoleRow = {
  id: string;
  key: string;
  name: string;
  permissions: unknown;
  rankPathId?: string | null;
  rankPathKey?: string | null;
  rankPathName?: string | null;
  rankLevel?: number | null;
  displayLabel?: string | null;
  nextRoleId?: string | null;
  discordRoleId?: string | null;
  isOwnerRank?: number | boolean;
  isSystem?: number | boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ModeratorRankPathRow = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ModeratorGrantRow = {
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

export type ModeratorAuditLogRow = {
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

export const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const toNullableIsoString = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : toIsoString(value);

export const toSqlTimestamp = (value: string | null | undefined): string | null =>
  value ? new Date(value).toISOString().slice(0, 19).replace("T", " ") : null;

export const parseStringArray = (value: unknown): string[] => {
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

export const parseRecord = (value: unknown): Record<string, unknown> | null => {
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

export const mapUser = (row: ModeratorUserRow): ModeratorAdminUser => ({
  id: row.id,
  displayName: row.displayName,
  profileVisibility: row.profileVisibility,
  avatarUrl: row.avatarUrl ?? null,
  authEmail: row.authEmail ?? null,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

export const mapRole = (row: ModeratorRoleRow): ModeratorAdminRole => {
  const role = {
    id: row.id,
    key: row.key,
    name: row.name,
    permissions: parseStringArray(row.permissions),
    rankPathId: row.rankPathId ?? null,
    rankPathKey: row.rankPathKey ?? null,
    rankPathName: row.rankPathName ?? null,
    rankLevel: row.rankLevel ?? null,
    displayLabel: row.displayLabel ?? null,
    nextRoleId: row.nextRoleId ?? null,
    discordRoleId: row.discordRoleId ?? null,
    isOwnerRank: Boolean(row.isOwnerRank),
    isSystem: Boolean(row.isSystem),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  };

  return {
    ...role,
    grantable: isModeratorRoleGrantable(role)
  };
};

export const mapRankPath = (row: ModeratorRankPathRow): ModeratorAdminRankPath => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description ?? null,
  sortOrder: row.sortOrder,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

export const getGrantStatus = (
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

export const mapGrant = (row: ModeratorGrantRow): ModeratorAdminGrant => ({
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

export const mapAuditLog = (row: ModeratorAuditLogRow): ModeratorAdminAuditLog => ({
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

export const selectGrantFields = `
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

export const selectAuditFields = `
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

export const grantSnapshot = (grant: ModeratorAdminGrant): Record<string, unknown> => ({
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

