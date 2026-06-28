import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerModeratorAdminRoutes } from "../../src/moderators/moderator-admin.route.js";
import { ModeratorAdminService } from "../../src/moderators/moderator-admin.service.js";
import type {
  ModeratorAdminActor,
  ModeratorAdminAuditLog,
  ModeratorAdminGrant,
  ModeratorAdminGrantCreateInput,
  ModeratorAdminGrantUpdateInput,
  ModeratorAdminRepository,
  ModeratorAdminRole,
  ModeratorAdminUser
} from "../../src/moderators/moderator-admin.types.js";

const now = "2026-06-28T10:00:00.000Z";

const createUser = (id: string, displayName: string): ModeratorAdminUser => ({
  id,
  displayName,
  profileVisibility: "minimal",
  avatarUrl: null,
  authEmail: `${id}@example.test`,
  createdAt: now,
  updatedAt: now
});

const createRole = (
  id: string,
  key: string,
  permissions: readonly string[]
): ModeratorAdminRole => ({
  id,
  key,
  name: key,
  permissions,
  grantable: key !== "owner" && key !== "admin" && !permissions.includes("*"),
  createdAt: now,
  updatedAt: now
});

class FakeModeratorAdminRepository implements ModeratorAdminRepository {
  public actor: ModeratorAdminActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };
  public readonly users = new Map<string, ModeratorAdminUser>([
    ["owner-user", createUser("owner-user", "Owner")],
    ["helper-user", createUser("helper-user", "Helper")]
  ]);
  public readonly roles = new Map<string, ModeratorAdminRole>([
    ["helper-role", createRole("helper-role", "community-helper", ["event-routing:review"])],
    ["moderator-role", createRole("moderator-role", "chat-moderator", ["chat:moderate"])],
    ["owner-role", createRole("owner-role", "owner", ["*"])],
    ["money-role", createRole("money-role", "finance-helper", ["money:review"])]
  ]);
  public readonly grants = new Map<string, ModeratorAdminGrant>();
  public readonly auditLogs: ModeratorAdminAuditLog[] = [];

  public async resolveActor(): Promise<ModeratorAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listUsers(): Promise<readonly ModeratorAdminUser[]> {
    return [...this.users.values()].map((user) => structuredClone(user));
  }

  public async listRoles(): Promise<readonly ModeratorAdminRole[]> {
    return [...this.roles.values()].map((role) => structuredClone(role));
  }

  public async listGrants(): Promise<readonly ModeratorAdminGrant[]> {
    return [...this.grants.values()].map((grant) => structuredClone(grant));
  }

  public async listAuditLogs(): Promise<readonly ModeratorAdminAuditLog[]> {
    return this.auditLogs.map((log) => structuredClone(log));
  }

  public async getUser(userId: string): Promise<ModeratorAdminUser | null> {
    const user = this.users.get(userId);
    return user ? structuredClone(user) : null;
  }

  public async getRole(roleId: string): Promise<ModeratorAdminRole | null> {
    const role = this.roles.get(roleId);
    return role ? structuredClone(role) : null;
  }

  public async getGrant(grantId: string): Promise<ModeratorAdminGrant | null> {
    const grant = this.grants.get(grantId);
    return grant ? structuredClone(grant) : null;
  }

  public async getGrantByUserRole(userId: string, roleId: string): Promise<ModeratorAdminGrant | null> {
    const grant = [...this.grants.values()].find((candidate) =>
      candidate.userId === userId && candidate.roleId === roleId
    );

    return grant ? structuredClone(grant) : null;
  }

  public async grantRole(input: ModeratorAdminGrantCreateInput & {
    actorUserId: string;
  }): Promise<{
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  } | "exists"> {
    const existing = await this.getGrantByUserRole(input.targetUserId, input.roleId);

    if (existing && existing.status !== "revoked") {
      return "exists";
    }

    const role = this.roles.get(input.roleId);

    if (!role) {
      throw new Error("role_missing_in_fake");
    }

    const grant: ModeratorAdminGrant = {
      id: existing?.id ?? `grant-${this.grants.size + 1}`,
      userId: input.targetUserId,
      roleId: input.roleId,
      roleKey: role.key,
      roleName: role.name,
      rolePermissions: role.permissions,
      trustLevel: input.trustLevel,
      scopeKind: input.scopeKind,
      scopeId: input.scopeId,
      availability: input.availability,
      assignedByUserId: input.actorUserId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
      assignedAt: now,
      status: input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now() ? "expired" : "active"
    };
    this.grants.set(grant.id, grant);

    const auditLog = this.createAuditLog("grant", grant, null, { ...grant }, input.reason);
    return {
      grant: structuredClone(grant),
      auditLog
    };
  }

  public async updateGrant(grantId: string, input: ModeratorAdminGrantUpdateInput & {
    actorUserId: string;
  }): Promise<{
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  } | "not-found"> {
    const existing = this.grants.get(grantId);

    if (!existing || existing.status === "revoked") {
      return "not-found";
    }

    const next: ModeratorAdminGrant = {
      ...existing,
      ...(input.trustLevel !== undefined ? { trustLevel: input.trustLevel } : {}),
      ...(input.scopeKind !== undefined ? { scopeKind: input.scopeKind } : {}),
      ...(input.scopeId !== undefined ? { scopeId: input.scopeId } : {}),
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {})
    };
    this.grants.set(grantId, next);

    const auditLog = this.createAuditLog("update", next, { ...existing }, { ...next }, input.reason ?? null);
    return {
      grant: structuredClone(next),
      auditLog
    };
  }

  public async revokeGrant(grantId: string, input: {
    actorUserId: string;
    reason: string | null;
  }): Promise<{
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  } | "not-found"> {
    const existing = this.grants.get(grantId);

    if (!existing || existing.status === "revoked") {
      return "not-found";
    }

    const next: ModeratorAdminGrant = {
      ...existing,
      revokedAt: "2026-06-28T11:00:00.000Z",
      revokedByUserId: input.actorUserId,
      revocationReason: input.reason,
      status: "revoked"
    };
    this.grants.set(grantId, next);

    const auditLog = this.createAuditLog("revoke", next, { ...existing }, null, input.reason);
    return {
      grant: structuredClone(next),
      auditLog
    };
  }

  private createAuditLog(
    action: ModeratorAdminAuditLog["action"],
    grant: ModeratorAdminGrant,
    previousValue: Record<string, unknown> | null,
    nextValue: Record<string, unknown> | null,
    reason: string | null
  ): ModeratorAdminAuditLog {
    const log: ModeratorAdminAuditLog = {
      id: `audit-${this.auditLogs.length + 1}`,
      targetUserId: grant.userId,
      targetDisplayName: this.users.get(grant.userId)?.displayName ?? null,
      roleId: grant.roleId,
      roleKey: grant.roleKey,
      roleName: grant.roleName,
      actorUserId: "owner-user",
      actorDisplayName: "Owner",
      action,
      previousValue,
      nextValue,
      reason,
      createdAt: now
    };
    this.auditLogs.unshift(log);
    return structuredClone(log);
  }
}

describe("ModeratorAdminService", () => {
  it("allows owner wildcard and moderators:manage to list and mutate grants with audit rows", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);

    await expect(service.listModerators({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      users: expect.any(Array),
      roles: expect.any(Array)
    });

    repository.actor = {
      domainUserId: "owner-user",
      rolePermissionValues: [JSON.stringify(["moderators:manage"])]
    };

    const grantResult = await service.grantRole({
      authUserId: "auth-manager",
      grant: {
        targetUserId: "helper-user",
        roleId: "helper-role",
        trustLevel: "helper",
        scopeKind: "event_routing",
        scopeId: "approvals",
        availability: "live_only",
        expiresAt: "2026-07-01T10:00:00.000Z",
        reason: "Live event review"
      }
    });

    expect(grantResult).toMatchObject({
      ok: true,
      grant: {
        trustLevel: "helper",
        scopeKind: "event_routing",
        scopeId: "approvals",
        availability: "live_only"
      },
      auditLog: {
        action: "grant"
      }
    });
    expect(repository.auditLogs).toHaveLength(1);

    const grantId = grantResult.ok ? grantResult.grant.id : "missing";
    const updateResult = await service.updateGrant({
      authUserId: "auth-manager",
      grantId,
      update: {
        trustLevel: "moderator",
        availability: "always",
        reason: "Broader event coverage"
      }
    });

    expect(updateResult).toMatchObject({
      ok: true,
      grant: {
        trustLevel: "moderator",
        availability: "always"
      },
      auditLog: {
        action: "update"
      }
    });
    expect(repository.auditLogs).toHaveLength(2);

    await expect(service.revokeGrant({
      authUserId: "auth-manager",
      grantId,
      reason: "Ended after stream"
    })).resolves.toMatchObject({
      ok: true,
      grant: {
        status: "revoked"
      },
      auditLog: {
        action: "revoke"
      }
    });
    expect(repository.auditLogs).toHaveLength(3);
  });

  it("denies unlinked and unprivileged users", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);

    repository.actor = null;
    await expect(service.listModerators({ authUserId: "auth-missing" })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["project-admin:manage"]]
    };

    await expect(service.grantRole({
      authUserId: "auth-helper",
      grant: {
        targetUserId: "helper-user",
        roleId: "helper-role",
        trustLevel: "helper",
        scopeKind: "global",
        scopeId: null,
        availability: "always",
        expiresAt: null,
        reason: null
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_forbidden"
    });
  });

  it("rejects owner/admin roles and dangerous permissions", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);

    await expect(service.grantRole({
      authUserId: "auth-owner",
      grant: {
        targetUserId: "helper-user",
        roleId: "owner-role",
        trustLevel: "trusted_operator",
        scopeKind: "global",
        scopeId: null,
        availability: "always",
        expiresAt: null,
        reason: "Nope"
      }
    })).resolves.toMatchObject({
      ok: false,
      reason: "moderator_admin_role_forbidden",
      issues: expect.arrayContaining([
        "moderator_grant_owner_admin_role_forbidden",
        "moderator_grant_dangerous_permission_forbidden"
      ])
    });

    await expect(service.grantRole({
      authUserId: "auth-owner",
      grant: {
        targetUserId: "helper-user",
        roleId: "money-role",
        trustLevel: "helper",
        scopeKind: "global",
        scopeId: null,
        availability: "always",
        expiresAt: null,
        reason: "Still no"
      }
    })).resolves.toMatchObject({
      ok: false,
      reason: "moderator_admin_role_forbidden",
      issues: expect.arrayContaining(["moderator_grant_dangerous_permission_forbidden"])
    });

    expect(repository.auditLogs).toHaveLength(0);
  });

  it("rejects invalid scoped grants", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);

    await expect(service.grantRole({
      authUserId: "auth-owner",
      grant: {
        targetUserId: "helper-user",
        roleId: "helper-role",
        trustLevel: "helper",
        scopeKind: "project",
        scopeId: null,
        availability: "always",
        expiresAt: null,
        reason: null
      }
    })).resolves.toMatchObject({
      ok: false,
      reason: "moderator_admin_invalid_input",
      issues: expect.arrayContaining(["moderator_grant_scope_id_required"])
    });
  });
});

describe("Moderator admin routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerModeratorAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ModeratorAdminService(new FakeModeratorAdminRepository())
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/moderators"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });
});
