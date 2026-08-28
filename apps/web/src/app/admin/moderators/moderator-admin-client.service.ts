import {
  canUpdateOrdinaryModeratorRankPath,
  hasStrictModeratorRoleAuthorityShape,
  isProtectedModeratorRoleAuthority
} from "@maiks-yt/domain/community";
import type { GrantableModeratorTrustLevel, ModeratorGrantAvailability, ModeratorGrantScopeKind, ModeratorRoleAuthorityIntegrity, ModeratorTrustLevel, RoleGrantAuditAction } from "@maiks-yt/domain/community";

export type ModeratorAdminFailureReason =
  | "not_authenticated"
  | "moderator_admin_unavailable"
  | "moderator_admin_user_unlinked"
  | "moderator_admin_forbidden"
  | "moderator_admin_invalid_input"
  | "moderator_admin_user_not_found"
  | "moderator_admin_role_not_found"
  | "moderator_admin_role_exists"
  | "moderator_admin_role_forbidden"
  | "moderator_admin_role_in_use"
  | "moderator_admin_role_protected"
  | "moderator_admin_rank_path_not_found"
  | "moderator_admin_rank_path_exists"
  | "moderator_admin_rank_path_in_use"
  | "moderator_admin_rank_path_protected"
  | "moderator_admin_grant_not_found"
  | "moderator_admin_grant_exists";

export type ModeratorAdminUser = {
  id: string;
  displayName: string;
  profileVisibility: string;
  avatarUrl: string | null;
  authEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModeratorAdminRole = {
  id: string;
  key: string;
  name: string;
  permissions: readonly string[];
  rankPathId: string | null;
  rankPathKey: string | null;
  rankPathName: string | null;
  rankLevel: number | null;
  displayLabel: string | null;
  nextRoleId: string | null;
  discordRoleId: string | null;
  isOwnerRank: boolean;
  isSystem: boolean;
  authorityIntegrity: ModeratorRoleAuthorityIntegrity;
  grantable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ModeratorAdminRankPath = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ModeratorAdminGrant = {
  id: string;
  userId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  rolePermissions: readonly string[];
  trustLevel: ModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId: string | null;
  availability: ModeratorGrantAvailability;
  assignedByUserId: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  assignedAt: string;
  status: "active" | "expired" | "revoked";
};

export type ModeratorAdminAuditLog = {
  id: string;
  targetUserId: string;
  targetDisplayName: string | null;
  roleId: string;
  roleKey: string | null;
  roleName: string | null;
  actorUserId: string | null;
  actorDisplayName: string | null;
  action: RoleGrantAuditAction;
  reason: string | null;
  createdAt: string;
};

export type ModeratorAdminListResponse =
  | {
    ok: true;
    users: readonly ModeratorAdminUser[];
    rankPaths: readonly ModeratorAdminRankPath[];
    roles: readonly ModeratorAdminRole[];
    grants: readonly ModeratorAdminGrant[];
    auditLogs: readonly ModeratorAdminAuditLog[];
    canManageRanks: boolean;
  }
  | {
    ok: false;
    reason: ModeratorAdminFailureReason;
  };

export type ModeratorAdminMutationResponse =
  | {
    ok: true;
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  }
  | {
    ok: false;
    reason: ModeratorAdminFailureReason;
    issues?: readonly string[];
  };

export type RankPathMutationResponse =
  | {
    ok: true;
    rankPath: ModeratorAdminRankPath;
  }
  | {
    ok: false;
    reason: ModeratorAdminFailureReason;
  };

export type RoleMutationResponse =
  | {
    ok: true;
    role: ModeratorAdminRole;
  }
  | {
    ok: false;
    reason: ModeratorAdminFailureReason;
  };

export type RankDeleteResponse =
  | {
    ok: true;
    id: string;
  }
  | {
    ok: false;
    reason: ModeratorAdminFailureReason;
  };

export type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

export type GrantFormState = {
  targetUserId: string;
  roleId: string;
  trustLevel: GrantableModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId: string;
  availability: ModeratorGrantAvailability;
  expiresAt: string;
  reason: string;
};

export type RankPathFormState = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  sortOrder: string;
};

export type RoleFormState = {
  id: string | null;
  key: string;
  name: string;
  permissions: string;
  rankPathId: string;
  rankLevel: string;
  displayLabel: string;
  nextRoleId: string;
  discordRoleId: string;
  isOwnerRank: boolean;
  isSystem: boolean;
};

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

export const trustLevelLabels: Record<ModeratorTrustLevel, string> = {
  observer: "Observer",
  helper: "Helper",
  moderator: "Moderator",
  senior_moderator: "Senior moderator",
  trusted_operator: "Trusted operator",
  owner: "Owner"
};

export const scopeLabels: Record<ModeratorGrantScopeKind, string> = {
  global: "Global",
  chat: "Chat",
  event_routing: "Event routing",
  content: "Content",
  project: "Project",
  stream_operations: "Stream operations"
};

export const availabilityLabels: Record<ModeratorGrantAvailability, string> = {
  always: "Always",
  live_only: "Live only",
  offline_only: "Offline only"
};

export const actionLabels: Record<RoleGrantAuditAction, string> = {
  grant: "Granted",
  update: "Updated",
  revoke: "Revoked",
  expire: "Expired"
};

export const emptyForm: GrantFormState = {
  targetUserId: "",
  roleId: "",
  trustLevel: "helper",
  scopeKind: "global",
  scopeId: "",
  availability: "always",
  expiresAt: "",
  reason: ""
};

export const emptyRankPathForm: RankPathFormState = {
  id: null,
  key: "",
  name: "",
  description: "",
  sortOrder: "0"
};

export const emptyRoleForm: RoleFormState = {
  id: null,
  key: "",
  name: "",
  permissions: "",
  rankPathId: "",
  rankLevel: "",
  displayLabel: "",
  nextRoleId: "",
  discordRoleId: "",
  isOwnerRank: false,
  isSystem: false
};

export const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))
    : "None";

export const toDateTimeInput = (value: string | null): string =>
  value ? value.slice(0, 16) : "";

export const toIsoOrNull = (value: string): string | null =>
  value.trim().length > 0 ? new Date(value).toISOString() : null;

export const getFailureMessage = (
  response: Response,
  reason?: ModeratorAdminFailureReason,
  issues?: readonly string[]
): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing helper and moderator grants.";
  }

  if (reason === "moderator_admin_role_protected") {
    return "This protected rank cannot be created, changed, or removed here.";
  }

  if (reason === "moderator_admin_rank_path_protected") {
    return "This promotion path contains a protected rank and cannot be changed here.";
  }

  if (reason === "moderator_admin_role_forbidden") {
    return issues && issues.length > 0
      ? `That role cannot be granted here: ${issues.join(", ")}.`
      : "That role contains owner-only or dangerous capabilities.";
  }

  if (reason === "moderator_admin_grant_exists") {
    return "That user already has an active grant for the selected role.";
  }

  if (reason === "moderator_admin_invalid_input") {
    return issues && issues.length > 0
      ? `Invalid grant: ${issues.join(", ")}.`
      : "The grant has invalid or missing fields.";
  }

  if (response.status === 403 || reason === "moderator_admin_forbidden") {
    return "Your account does not have moderator management permission.";
  }

  return `Moderator admin request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (response: Response, reason?: ModeratorAdminFailureReason): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "moderator_admin_forbidden" || reason === "moderator_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

export const getUserLabel = (users: readonly ModeratorAdminUser[], userId: string | null): string => {
  if (!userId) {
    return "Unknown user";
  }

  const user = users.find((candidate) => candidate.id === userId);
  return user ? `${user.displayName}${user.authEmail ? ` (${user.authEmail})` : ""}` : userId;
};

export const toPayload = (form: GrantFormState) => ({
  targetUserId: form.targetUserId,
  roleId: form.roleId,
  trustLevel: form.trustLevel,
  scopeKind: form.scopeKind,
  scopeId: form.scopeKind === "global" ? null : form.scopeId.trim() || null,
  availability: form.availability,
  expiresAt: toIsoOrNull(form.expiresAt),
  reason: form.reason.trim() || null
});

export const toUpdatePayload = (form: GrantFormState) => ({
  trustLevel: form.trustLevel,
  scopeKind: form.scopeKind,
  scopeId: form.scopeKind === "global" ? null : form.scopeId.trim() || null,
  availability: form.availability,
  expiresAt: toIsoOrNull(form.expiresAt),
  reason: form.reason.trim() || null
});

export const parsePermissionText = (value: string): string[] =>
  [...new Set(value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean))]
    .sort();

export const roleIsProtectedForEditing = (role: ModeratorAdminRole | null | undefined): boolean => {
  if (!role) {
    return false;
  }

  return !hasStrictModeratorRoleAuthorityShape(role)
    || isProtectedModeratorRoleAuthority(role);
};

export const rankPathIsProtectedForEditing = (
  roles: readonly ModeratorAdminRole[],
  rankPathId: string | null | undefined
): boolean =>
  Boolean(rankPathId)
  && !canUpdateOrdinaryModeratorRankPath(
    roles.filter((role) => role.rankPathId === rankPathId)
  );

export const toRankPathPayload = (form: RankPathFormState) => ({
  key: form.key,
  name: form.name,
  description: form.description.trim() || null,
  sortOrder: Number.parseInt(form.sortOrder, 10) || 0
});

export const toRolePayload = (form: RoleFormState) => ({
  key: form.key,
  name: form.name,
  permissions: parsePermissionText(form.permissions),
  rankPathId: form.rankPathId || null,
  rankLevel: form.rankLevel ? Number.parseInt(form.rankLevel, 10) : null,
  displayLabel: form.displayLabel.trim() || null,
  nextRoleId: form.nextRoleId || null,
  discordRoleId: form.discordRoleId.trim() || null,
  isOwnerRank: form.isOwnerRank,
  isSystem: form.isSystem
});

export const getRankPathLabel = (
  rankPaths: readonly ModeratorAdminRankPath[],
  rankPathId: string | null
): string => {
  if (!rankPathId) {
    return "No path";
  }

  const rankPath = rankPaths.find((candidate) => candidate.id === rankPathId);
  return rankPath ? rankPath.name : rankPathId;
};
