import type {
  ModeratorGrantAvailability,
  ModeratorGrantInput,
  ModeratorGrantScopeKind,
  ModeratorGrantUpdateInput,
  ModeratorTrustLevel,
  RoleGrantAuditAction
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
  grantable: boolean;
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
  previousValue: Record<string, unknown> | null;
  nextValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
};

export type ModeratorAdminListResult =
  | {
    ok: true;
    users: readonly ModeratorAdminUser[];
    roles: readonly ModeratorAdminRole[];
    grants: readonly ModeratorAdminGrant[];
    auditLogs: readonly ModeratorAdminAuditLog[];
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

export interface ModeratorAdminRepository {
  resolveActor(authUserId: string): Promise<ModeratorAdminActor | null>;
  listUsers(): Promise<readonly ModeratorAdminUser[]>;
  listRoles(): Promise<readonly ModeratorAdminRole[]>;
  listGrants(): Promise<readonly ModeratorAdminGrant[]>;
  listAuditLogs(limit: number): Promise<readonly ModeratorAdminAuditLog[]>;
  getUser(userId: string): Promise<ModeratorAdminUser | null>;
  getRole(roleId: string): Promise<ModeratorAdminRole | null>;
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
}
