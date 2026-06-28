export const moderatorManageCapability = "moderators:manage" as const;

export const moderatorTrustLevels = [
  "observer",
  "helper",
  "moderator",
  "senior_moderator",
  "trusted_operator",
  "owner"
] as const;

export type ModeratorTrustLevel = typeof moderatorTrustLevels[number];

export const grantableModeratorTrustLevels = [
  "observer",
  "helper",
  "moderator",
  "senior_moderator",
  "trusted_operator"
] as const satisfies readonly ModeratorTrustLevel[];

export type GrantableModeratorTrustLevel = typeof grantableModeratorTrustLevels[number];

export const moderatorGrantScopeKinds = [
  "global",
  "chat",
  "event_routing",
  "content",
  "project",
  "stream_operations"
] as const;

export type ModeratorGrantScopeKind = typeof moderatorGrantScopeKinds[number];

export const moderatorGrantAvailabilities = [
  "always",
  "live_only",
  "offline_only"
] as const;

export type ModeratorGrantAvailability = typeof moderatorGrantAvailabilities[number];

export const roleGrantAuditActions = ["grant", "update", "revoke", "expire"] as const;

export type RoleGrantAuditAction = typeof roleGrantAuditActions[number];

export type ModeratorGrantInput = {
  targetUserId: string;
  roleId: string;
  trustLevel: GrantableModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId: string | null;
  availability: ModeratorGrantAvailability;
  expiresAt: string | null;
  reason: string | null;
};

export type ModeratorGrantUpdateInput = Partial<Pick<
  ModeratorGrantInput,
  "trustLevel" | "scopeKind" | "scopeId" | "availability" | "expiresAt" | "reason"
>>;

export type ModeratorRoleForGrant = {
  key: string;
  permissions: readonly unknown[];
};

export type ModeratorGrantValidationIssue =
  | "moderator_grant_target_user_required"
  | "moderator_grant_role_required"
  | "moderator_grant_invalid_trust_level"
  | "moderator_grant_invalid_scope"
  | "moderator_grant_scope_id_required"
  | "moderator_grant_scope_id_must_be_empty"
  | "moderator_grant_invalid_availability"
  | "moderator_grant_invalid_expiration"
  | "moderator_grant_reason_too_long"
  | "moderator_grant_owner_admin_role_forbidden"
  | "moderator_grant_dangerous_permission_forbidden";

export type ModeratorGrantValidationResult = {
  ok: boolean;
  issues: readonly ModeratorGrantValidationIssue[];
};
