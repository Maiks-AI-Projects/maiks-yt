import {
  canManageModerators,
  isModeratorRoleGrantable,
  normalizeModeratorGrantReason,
  normalizeModeratorGrantScopeId,
  validateModeratorGrantInput
} from "@maiks-yt/domain/community";
import type {
  ModeratorGrantScopeKind,
  ModeratorGrantInput,
  ModeratorRoleForGrant
} from "@maiks-yt/domain/community";

import type {
  ModeratorAdminActor,
  ModeratorAdminGrant,
  ModeratorAdminGrantCreateInput,
  ModeratorAdminGrantUpdateInput,
  ModeratorAdminListResult,
  ModeratorAdminMutationResult,
  ModeratorAdminRankPathInput,
  ModeratorAdminRankPathMutationResult,
  ModeratorAdminRepository,
  ModeratorAdminRole,
  ModeratorAdminRoleInput,
  ModeratorAdminRoleMutationResult
} from "./moderator-admin.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeModeratorAdminPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const toRoleForGrant = (role: ModeratorAdminRole): ModeratorRoleForGrant => ({
  key: role.key,
  permissions: role.permissions
});

const hasOwnerWildcard = (permissions: readonly string[]): boolean => permissions.includes("*");

const normalizePermissionList = (permissions: readonly unknown[]): string[] =>
  [...new Set(permissions
    .filter((permission): permission is string => typeof permission === "string")
    .map((permission) => permission.trim())
    .filter(Boolean))]
    .sort();

const normalizeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9:-]+/g, "-").replace(/^-+|-+$/g, "");

const normalizeNullableText = (value: string | null | undefined, maxLength: number): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
};

const normalizeRankPathInput = (input: ModeratorAdminRankPathInput): ModeratorAdminRankPathInput => ({
  key: normalizeKey(input.key),
  name: input.name.trim().slice(0, 191),
  description: normalizeNullableText(input.description, 280),
  sortOrder: Number.isFinite(input.sortOrder) ? Math.max(0, Math.trunc(input.sortOrder)) : 0
});

const normalizeRoleInput = (input: ModeratorAdminRoleInput): ModeratorAdminRoleInput => ({
  key: normalizeKey(input.key),
  name: input.name.trim().slice(0, 191),
  permissions: normalizePermissionList(input.permissions),
  rankPathId: normalizeNullableText(input.rankPathId, 36),
  rankLevel: input.rankLevel === null ? null : Math.max(1, Math.trunc(input.rankLevel)),
  displayLabel: normalizeNullableText(input.displayLabel, 191),
  nextRoleId: normalizeNullableText(input.nextRoleId, 36),
  discordRoleId: normalizeNullableText(input.discordRoleId, 80),
  isOwnerRank: input.isOwnerRank,
  isSystem: input.isSystem
});

const isValidRankPathInput = (input: ModeratorAdminRankPathInput): boolean =>
  input.key.length > 0 && input.name.length > 0;

const isValidRoleInput = (input: ModeratorAdminRoleInput): boolean =>
  input.key.length > 0
  && input.name.length > 0
  && ((input.rankPathId === null && input.rankLevel === null) || (input.rankPathId !== null && input.rankLevel !== null));

const normalizeCreateInput = (
  input: ModeratorAdminGrantCreateInput
): ModeratorAdminGrantCreateInput => ({
  ...input,
  targetUserId: input.targetUserId.trim(),
  roleId: input.roleId.trim(),
  scopeId: normalizeModeratorGrantScopeId(input.scopeKind, input.scopeId),
  reason: normalizeModeratorGrantReason(input.reason),
  expiresAt: input.expiresAt?.trim() || null
});

const normalizeUpdateInput = (
  input: ModeratorAdminGrantUpdateInput,
  existing: ModeratorAdminGrant
): ModeratorAdminGrantUpdateInput => {
  const scopeKind = input.scopeKind ?? existing.scopeKind;
  const update: ModeratorAdminGrantUpdateInput = {};

  if (input.trustLevel !== undefined) {
    update.trustLevel = input.trustLevel;
  }
  if (input.scopeKind !== undefined) {
    update.scopeKind = input.scopeKind;
  }
  if (input.scopeId !== undefined) {
    update.scopeId = normalizeModeratorGrantScopeId(scopeKind as ModeratorGrantScopeKind, input.scopeId);
  }
  if (input.availability !== undefined) {
    update.availability = input.availability;
  }
  if (input.reason !== undefined) {
    update.reason = normalizeModeratorGrantReason(input.reason);
  }
  if (input.expiresAt !== undefined) {
    update.expiresAt = input.expiresAt?.trim() || null;
  }

  return update;
};

const mergeGrantForValidation = (
  existing: ModeratorAdminGrant,
  update: ModeratorAdminGrantUpdateInput
): ModeratorGrantInput => {
  const scopeKind = update.scopeKind ?? existing.scopeKind;

  return {
    targetUserId: existing.userId,
    roleId: existing.roleId,
    trustLevel: update.trustLevel ?? (existing.trustLevel === "owner" ? "helper" : existing.trustLevel),
    scopeKind,
    scopeId: update.scopeId !== undefined
      ? normalizeModeratorGrantScopeId(scopeKind, update.scopeId)
      : existing.scopeId,
    availability: update.availability ?? existing.availability,
    expiresAt: update.expiresAt !== undefined ? update.expiresAt : existing.expiresAt,
    reason: update.reason !== undefined ? normalizeModeratorGrantReason(update.reason) : null
  };
};

export class ModeratorAdminService {
  public constructor(private readonly repository: ModeratorAdminRepository) {}

  public async listModerators(input: { authUserId: string }): Promise<ModeratorAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const permissions = normalizeModeratorAdminPermissions(actor.rolePermissionValues);
    const [users, rankPaths, roles, grants, auditLogs] = await Promise.all([
      this.repository.listUsers(),
      this.repository.listRankPaths(),
      this.repository.listRoles(),
      this.repository.listGrants(),
      this.repository.listAuditLogs(50)
    ]);

    return {
      ok: true,
      users,
      rankPaths,
      roles,
      grants,
      auditLogs,
      canManageRanks: hasOwnerWildcard(permissions)
    };
  }

  public async createRankPath(input: {
    authUserId: string;
    rankPath: ModeratorAdminRankPathInput;
  }): Promise<ModeratorAdminRankPathMutationResult> {
    const actor = await this.requireRankManager(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const normalized = normalizeRankPathInput(input.rankPath);

    if (!isValidRankPathInput(normalized)) {
      return { ok: false, reason: "moderator_admin_invalid_input" };
    }

    const result = await this.repository.createRankPath(normalized);
    return result === "exists"
      ? { ok: false, reason: "moderator_admin_rank_path_exists" }
      : { ok: true, rankPath: result };
  }

  public async updateRankPath(input: {
    authUserId: string;
    rankPathId: string;
    rankPath: ModeratorAdminRankPathInput;
  }): Promise<ModeratorAdminRankPathMutationResult> {
    const actor = await this.requireRankManager(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const normalized = normalizeRankPathInput(input.rankPath);

    if (!isValidRankPathInput(normalized)) {
      return { ok: false, reason: "moderator_admin_invalid_input" };
    }

    const result = await this.repository.updateRankPath(input.rankPathId.trim(), normalized);

    if (result === "not-found") {
      return { ok: false, reason: "moderator_admin_rank_path_not_found" };
    }
    if (result === "exists") {
      return { ok: false, reason: "moderator_admin_rank_path_exists" };
    }

    return { ok: true, rankPath: result };
  }

  public async createRole(input: {
    authUserId: string;
    role: ModeratorAdminRoleInput;
  }): Promise<ModeratorAdminRoleMutationResult> {
    const actor = await this.requireRankManager(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const normalized = normalizeRoleInput(input.role);

    if (!isValidRoleInput(normalized)) {
      return { ok: false, reason: "moderator_admin_invalid_input" };
    }

    const result = await this.repository.createRole(normalized);

    if (result === "exists") {
      return { ok: false, reason: "moderator_admin_role_exists" };
    }
    if (result === "rank-path-not-found") {
      return { ok: false, reason: "moderator_admin_rank_path_not_found" };
    }

    return { ok: true, role: result };
  }

  public async updateRole(input: {
    authUserId: string;
    roleId: string;
    role: ModeratorAdminRoleInput;
  }): Promise<ModeratorAdminRoleMutationResult> {
    const actor = await this.requireRankManager(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const normalized = normalizeRoleInput(input.role);

    if (!isValidRoleInput(normalized)) {
      return { ok: false, reason: "moderator_admin_invalid_input" };
    }

    const result = await this.repository.updateRole(input.roleId.trim(), normalized);

    if (result === "not-found") {
      return { ok: false, reason: "moderator_admin_role_not_found" };
    }
    if (result === "exists") {
      return { ok: false, reason: "moderator_admin_role_exists" };
    }
    if (result === "rank-path-not-found") {
      return { ok: false, reason: "moderator_admin_rank_path_not_found" };
    }

    return { ok: true, role: result };
  }

  public async grantRole(input: {
    authUserId: string;
    grant: ModeratorAdminGrantCreateInput;
  }): Promise<ModeratorAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const normalized = normalizeCreateInput(input.grant);
    const [targetUser, role] = await Promise.all([
      this.repository.getUser(normalized.targetUserId),
      this.repository.getRole(normalized.roleId)
    ]);

    if (!targetUser) {
      return {
        ok: false,
        reason: "moderator_admin_user_not_found"
      };
    }

    if (!role) {
      return {
        ok: false,
        reason: "moderator_admin_role_not_found"
      };
    }

    const validation = validateModeratorGrantInput(normalized, toRoleForGrant(role));

    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.issues.some((issue) =>
          issue === "moderator_grant_owner_admin_role_forbidden"
          || issue === "moderator_grant_dangerous_permission_forbidden"
        ) ? "moderator_admin_role_forbidden" : "moderator_admin_invalid_input",
        issues: validation.issues
      };
    }

    if (!isModeratorRoleGrantable(role)) {
      return {
        ok: false,
        reason: "moderator_admin_role_forbidden"
      };
    }

    const result = await this.repository.grantRole({
      ...normalized,
      actorUserId: actor.domainUserId
    });

    return result === "exists"
      ? {
        ok: false,
        reason: "moderator_admin_grant_exists"
      }
      : {
        ok: true,
        ...result
      };
  }

  public async updateGrant(input: {
    authUserId: string;
    grantId: string;
    update: ModeratorAdminGrantUpdateInput;
  }): Promise<ModeratorAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const existing = await this.repository.getGrant(input.grantId);

    if (!existing) {
      return {
        ok: false,
        reason: "moderator_admin_grant_not_found"
      };
    }

    const role = await this.repository.getRole(existing.roleId);

    if (!role) {
      return {
        ok: false,
        reason: "moderator_admin_role_not_found"
      };
    }

    const normalized = normalizeUpdateInput(input.update, existing);
    const validation = validateModeratorGrantInput(
      mergeGrantForValidation(existing, normalized),
      toRoleForGrant(role)
    );

    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.issues.some((issue) =>
          issue === "moderator_grant_owner_admin_role_forbidden"
          || issue === "moderator_grant_dangerous_permission_forbidden"
        ) ? "moderator_admin_role_forbidden" : "moderator_admin_invalid_input",
        issues: validation.issues
      };
    }

    const result = await this.repository.updateGrant(input.grantId, {
      ...normalized,
      actorUserId: actor.domainUserId
    });

    return result === "not-found"
      ? {
        ok: false,
        reason: "moderator_admin_grant_not_found"
      }
      : {
        ok: true,
        ...result
      };
  }

  public async revokeGrant(input: {
    authUserId: string;
    grantId: string;
    reason: string | null;
  }): Promise<ModeratorAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const existing = await this.repository.getGrant(input.grantId);

    if (!existing) {
      return {
        ok: false,
        reason: "moderator_admin_grant_not_found"
      };
    }

    const role = await this.repository.getRole(existing.roleId);

    if (!role) {
      return {
        ok: false,
        reason: "moderator_admin_role_not_found"
      };
    }

    if (!isModeratorRoleGrantable(role)) {
      return {
        ok: false,
        reason: "moderator_admin_role_forbidden"
      };
    }

    const reason = normalizeModeratorGrantReason(input.reason);

    if (reason && reason.length > 280) {
      return {
        ok: false,
        reason: "moderator_admin_invalid_input",
        issues: ["moderator_grant_reason_too_long"]
      };
    }

    const result = await this.repository.revokeGrant(input.grantId, {
      actorUserId: actor.domainUserId,
      reason
    });

    return result === "not-found"
      ? {
        ok: false,
        reason: "moderator_admin_grant_not_found"
      }
      : {
        ok: true,
        ...result
      };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
    rolePermissionValues: readonly unknown[];
  } | {
    ok: false;
    reason: "moderator_admin_user_unlinked" | "moderator_admin_forbidden";
  }> {
    const actor: ModeratorAdminActor | null = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "moderator_admin_user_unlinked"
      };
    }

    if (!canManageModerators(normalizeModeratorAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "moderator_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId,
      rolePermissionValues: actor.rolePermissionValues
    };
  }

  private async requireRankManager(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
    rolePermissionValues: readonly unknown[];
  } | {
    ok: false;
    reason: "moderator_admin_user_unlinked" | "moderator_admin_forbidden";
  }> {
    const actor = await this.requireActor(authUserId);

    if (!actor.ok) {
      return actor;
    }

    return hasOwnerWildcard(normalizeModeratorAdminPermissions(actor.rolePermissionValues))
      ? actor
      : {
        ok: false,
        reason: "moderator_admin_forbidden"
      };
  }
}
