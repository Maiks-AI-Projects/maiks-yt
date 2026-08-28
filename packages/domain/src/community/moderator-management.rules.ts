import {
  grantableModeratorTrustLevels,
  moderatorGrantAvailabilities,
  moderatorGrantScopeKinds,
  moderatorManageCapability,
  type GrantableModeratorTrustLevel,
  type ModeratorGrantAvailability,
  type ModeratorGrantInput,
  type ModeratorGrantScopeKind,
  type ModeratorGrantUpdateInput,
  type ModeratorGrantValidationIssue,
  type ModeratorGrantValidationResult,
  type ModeratorRoleForGrant
} from "./moderator-management.types.js";

const grantableTrustLevelSet = new Set<string>(grantableModeratorTrustLevels);
const scopeKindSet = new Set<string>(moderatorGrantScopeKinds);
const availabilitySet = new Set<string>(moderatorGrantAvailabilities);

const protectedRoleKeys = new Set(["owner", "admin"]);
const normalizedModeratorRoleKeyPattern = /^[a-z0-9:-]+$/;

const dangerousPermissionExact = new Set([
  "*",
  moderatorManageCapability,
  "roles:manage",
  "admin:manage",
  "owner:manage",
  "users:delete",
  "users:delete:irreversible",
  "audit:disable",
  "audit-logs:disable"
]);

const dangerousPermissionPrefixes = [
  "auth:",
  "secrets:",
  "secret:",
  "provider-credentials:",
  "provider:credentials",
  "production-auth:",
  "production-secrets:",
  "money:",
  "ledger:",
  "finance:",
  "refunds:",
  "support:"
] as const;

export const canManageModerators = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is string =>
    capability === "*" || capability === moderatorManageCapability
  );

export const isGrantableModeratorTrustLevel = (
  value: unknown
): value is GrantableModeratorTrustLevel =>
  typeof value === "string" && grantableTrustLevelSet.has(value);

export const isModeratorGrantScopeKind = (
  value: unknown
): value is ModeratorGrantScopeKind =>
  typeof value === "string" && scopeKindSet.has(value);

export const isModeratorGrantAvailability = (
  value: unknown
): value is ModeratorGrantAvailability =>
  typeof value === "string" && availabilitySet.has(value);

export const normalizeModeratorGrantScopeId = (
  scopeKind: ModeratorGrantScopeKind,
  scopeId: string | null | undefined
): string | null => {
  if (scopeKind === "global") {
    return null;
  }

  const trimmed = scopeId?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeModeratorGrantReason = (
  reason: string | null | undefined
): string | null => {
  const trimmed = reason?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export const isDangerousModeratorPermission = (permission: unknown): boolean => {
  if (typeof permission !== "string") {
    return false;
  }

  const normalizedPermission = permission.trim();

  return dangerousPermissionExact.has(normalizedPermission)
    || dangerousPermissionPrefixes.some((prefix) => normalizedPermission.startsWith(prefix));
};

export const hasModeratorWildcardAuthority = (permissions: readonly unknown[]): boolean =>
  permissions.some((permission) => typeof permission === "string" && permission.trim() === "*");

export const isReservedModeratorRoleKey = (key: unknown): boolean =>
  typeof key === "string" && protectedRoleKeys.has(key.trim().toLowerCase());

export const isNormalizedModeratorRoleKey = (key: unknown): key is string =>
  typeof key === "string"
  && key.length > 0
  && key === key.trim().toLowerCase()
  && normalizedModeratorRoleKeyPattern.test(key);

export type StrictModeratorRoleAuthority = {
  key: string;
  permissions: readonly string[];
  isOwnerRank: boolean;
  isSystem: boolean;
  authorityIntegrity?: "valid";
};

export const hasStrictModeratorRoleAuthorityShape = (
  role: unknown
): role is StrictModeratorRoleAuthority => {
  if (!role || typeof role !== "object" || Array.isArray(role)) {
    return false;
  }

  const candidate = role as Record<string, unknown>;

  return isNormalizedModeratorRoleKey(candidate.key)
    && Array.isArray(candidate.permissions)
    && candidate.permissions.every((permission) =>
      typeof permission === "string" && permission.trim().length > 0
    )
    && typeof candidate.isOwnerRank === "boolean"
    && typeof candidate.isSystem === "boolean"
    && (candidate.authorityIntegrity === undefined || candidate.authorityIntegrity === "valid");
};

export const isProtectedModeratorRoleAuthority = (
  role: Pick<ModeratorRoleForGrant, "key" | "permissions" | "isOwnerRank" | "isSystem" | "authorityIntegrity">
): boolean =>
  !hasStrictModeratorRoleAuthorityShape(role)
  || isReservedModeratorRoleKey(role.key)
  || role.isOwnerRank === true
  || role.isSystem === true
  || hasModeratorWildcardAuthority(role.permissions);

export const isModeratorRoleGrantable = (role: ModeratorRoleForGrant): boolean =>
  !isProtectedModeratorRoleAuthority(role)
  && !role.permissions.some(isDangerousModeratorPermission);

export const canCreateOrdinaryModeratorRole = (
  role: Pick<ModeratorRoleForGrant, "key" | "permissions" | "isOwnerRank" | "isSystem" | "authorityIntegrity">
): boolean =>
  hasStrictModeratorRoleAuthorityShape(role)
  && !isProtectedModeratorRoleAuthority(role);

export const canUpdateOrdinaryModeratorRole = (
  existing: Pick<ModeratorRoleForGrant, "key" | "permissions" | "isOwnerRank" | "isSystem" | "authorityIntegrity">,
  next: Pick<ModeratorRoleForGrant, "key" | "permissions" | "isOwnerRank" | "isSystem" | "authorityIntegrity">
): boolean =>
  hasStrictModeratorRoleAuthorityShape(existing)
  && hasStrictModeratorRoleAuthorityShape(next)
  && !isProtectedModeratorRoleAuthority(existing)
  && !isProtectedModeratorRoleAuthority(next);

export const canDeleteOrdinaryModeratorRole = (
  role: Pick<ModeratorRoleForGrant, "key" | "permissions" | "isOwnerRank" | "isSystem" | "authorityIntegrity">
): boolean =>
  hasStrictModeratorRoleAuthorityShape(role)
  && !isProtectedModeratorRoleAuthority(role);

export const canUpdateOrdinaryModeratorRankPath = (
  attachedRoles: unknown
): boolean =>
  Array.isArray(attachedRoles)
  && attachedRoles.every((role) =>
    hasStrictModeratorRoleAuthorityShape(role)
    && canDeleteOrdinaryModeratorRole(role)
  );

export const validateModeratorGrantInput = (
  input: ModeratorGrantInput,
  role?: ModeratorRoleForGrant | null
): ModeratorGrantValidationResult => {
  const issues: ModeratorGrantValidationIssue[] = [];

  if (input.targetUserId.trim().length === 0) {
    issues.push("moderator_grant_target_user_required");
  }

  if (input.roleId.trim().length === 0) {
    issues.push("moderator_grant_role_required");
  }

  if (!isGrantableModeratorTrustLevel(input.trustLevel)) {
    issues.push("moderator_grant_invalid_trust_level");
  }

  if (!isModeratorGrantScopeKind(input.scopeKind)) {
    issues.push("moderator_grant_invalid_scope");
  } else if (input.scopeKind === "global" && input.scopeId !== null) {
    issues.push("moderator_grant_scope_id_must_be_empty");
  } else if (input.scopeKind !== "global" && !input.scopeId) {
    issues.push("moderator_grant_scope_id_required");
  }

  if (!isModeratorGrantAvailability(input.availability)) {
    issues.push("moderator_grant_invalid_availability");
  }

  if (input.expiresAt !== null && Number.isNaN(Date.parse(input.expiresAt))) {
    issues.push("moderator_grant_invalid_expiration");
  }

  if (input.reason !== null && input.reason.length > 280) {
    issues.push("moderator_grant_reason_too_long");
  }

  if (role) {
    if (isReservedModeratorRoleKey(role.key)) {
      issues.push("moderator_grant_owner_admin_role_forbidden");
    }

    if (!hasStrictModeratorRoleAuthorityShape(role) || isProtectedModeratorRoleAuthority(role)) {
      issues.push("moderator_grant_protected_role_forbidden");
    }

    if (Array.isArray(role.permissions) && role.permissions.some(isDangerousModeratorPermission)) {
      issues.push("moderator_grant_dangerous_permission_forbidden");
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

export const validateModeratorGrantUpdateInput = (
  input: ModeratorGrantUpdateInput,
  role: ModeratorRoleForGrant
): ModeratorGrantValidationResult => {
  const merged: ModeratorGrantInput = {
    targetUserId: "target",
    roleId: "role",
    trustLevel: input.trustLevel ?? "helper",
    scopeKind: input.scopeKind ?? "global",
    scopeId: normalizeModeratorGrantScopeId(input.scopeKind ?? "global", input.scopeId),
    availability: input.availability ?? "always",
    expiresAt: input.expiresAt ?? null,
    reason: normalizeModeratorGrantReason(input.reason)
  };

  return validateModeratorGrantInput(merged, role);
};
