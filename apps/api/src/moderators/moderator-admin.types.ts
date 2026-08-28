import type {
  ModeratorGrantAvailability,
  ModeratorGrantInput,
  ModeratorGrantScopeKind,
  ModeratorGrantUpdateInput,
  ModeratorTrustLevel,
  RoleGrantAuditAction,
  ModeratorRoleAuthorityIntegrity
} from "@maiks-yt/domain/community";

export type ModeratorAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

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

export type ModeratorAdminListResult =
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
    reason: "moderator_admin_user_unlinked" | "moderator_admin_forbidden";
  };

export type ModeratorAdminMutationResult =
  | {
    ok: true;
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  }
  | {
    ok: false;
    reason:
      | "moderator_admin_user_unlinked"
      | "moderator_admin_forbidden"
      | "moderator_admin_invalid_input"
      | "moderator_admin_user_not_found"
      | "moderator_admin_role_not_found"
      | "moderator_admin_grant_not_found"
      | "moderator_admin_grant_exists"
      | "moderator_admin_role_forbidden";
    issues?: readonly string[];
  };

export type ModeratorAdminGrantCreateInput = ModeratorGrantInput;
export type ModeratorAdminGrantUpdateInput = ModeratorGrantUpdateInput;

export type ModeratorAdminRankPathInput = {
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type ModeratorAdminRoleInput = {
  key: string;
  name: string;
  permissions: readonly string[];
  rankPathId: string | null;
  rankLevel: number | null;
  displayLabel: string | null;
  nextRoleId: string | null;
  discordRoleId: string | null;
  isOwnerRank: boolean;
  isSystem: boolean;
};

export type ModeratorAdminRankPathMutationResult =
  | {
    ok: true;
    rankPath: ModeratorAdminRankPath;
  }
  | {
    ok: false;
    reason:
      | "moderator_admin_user_unlinked"
      | "moderator_admin_forbidden"
      | "moderator_admin_invalid_input"
      | "moderator_admin_rank_path_not_found"
      | "moderator_admin_rank_path_exists"
      | "moderator_admin_rank_path_protected";
  };

export type ModeratorAdminRoleMutationResult =
  | {
    ok: true;
    role: ModeratorAdminRole;
  }
  | {
    ok: false;
    reason:
      | "moderator_admin_user_unlinked"
      | "moderator_admin_forbidden"
      | "moderator_admin_invalid_input"
      | "moderator_admin_role_not_found"
      | "moderator_admin_rank_path_not_found"
      | "moderator_admin_role_exists"
      | "moderator_admin_role_protected";
  };

export type ModeratorAdminDeleteResult =
  | {
    ok: true;
    id: string;
  }
  | {
    ok: false;
    reason:
      | "moderator_admin_user_unlinked"
      | "moderator_admin_forbidden"
      | "moderator_admin_rank_path_not_found"
      | "moderator_admin_role_not_found"
      | "moderator_admin_rank_path_in_use"
      | "moderator_admin_role_in_use"
      | "moderator_admin_role_protected";
  };

export interface ModeratorAdminRepository {
  resolveActor(authUserId: string): Promise<ModeratorAdminActor | null>;
  listUsers(): Promise<readonly ModeratorAdminUser[]>;
  listRankPaths(): Promise<readonly ModeratorAdminRankPath[]>;
  listRoles(): Promise<readonly ModeratorAdminRole[]>;
  listGrants(): Promise<readonly ModeratorAdminGrant[]>;
  listAuditLogs(limit: number): Promise<readonly ModeratorAdminAuditLog[]>;
  getUser(userId: string): Promise<ModeratorAdminUser | null>;
  getRankPath(rankPathId: string): Promise<ModeratorAdminRankPath | null>;
  getRole(roleId: string): Promise<ModeratorAdminRole | null>;
  getRoleByKey(key: string): Promise<ModeratorAdminRole | null>;
  getGrant(grantId: string): Promise<ModeratorAdminGrant | null>;
  getGrantByUserRole(userId: string, roleId: string): Promise<ModeratorAdminGrant | null>;
  grantRole(input: ModeratorAdminGrantCreateInput & {
    actorUserId: string;
  }): Promise<{
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  } | "exists">;
  updateGrant(grantId: string, input: ModeratorAdminGrantUpdateInput & {
    actorUserId: string;
  }): Promise<{
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  } | "not-found">;
  revokeGrant(grantId: string, input: {
    actorUserId: string;
    reason: string | null;
  }): Promise<{
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  } | "not-found">;
  createRankPath(input: ModeratorAdminRankPathInput): Promise<ModeratorAdminRankPath | "exists">;
  updateRankPath(rankPathId: string, input: ModeratorAdminRankPathInput): Promise<ModeratorAdminRankPath | "not-found" | "exists" | "protected">;
  deleteRankPath(rankPathId: string): Promise<"deleted" | "not-found" | "in-use">;
  createRole(input: ModeratorAdminRoleInput): Promise<ModeratorAdminRole | "exists" | "rank-path-not-found" | "protected">;
  updateRole(roleId: string, input: ModeratorAdminRoleInput): Promise<ModeratorAdminRole | "not-found" | "exists" | "rank-path-not-found" | "protected">;
  deleteRole(roleId: string): Promise<"deleted" | "not-found" | "protected" | "in-use">;
}
