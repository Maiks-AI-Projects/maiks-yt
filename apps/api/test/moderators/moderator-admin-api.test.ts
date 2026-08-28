import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { canUpdateOrdinaryModeratorRankPath } from "@maiks-yt/domain/community";

import { registerModeratorAdminRoutes } from "../../src/moderators/moderator-admin.route.js";
import { ModeratorAdminService } from "../../src/moderators/moderator-admin.service.js";
import { updateRankPath as updateStoredRankPath } from "../../src/moderators/moderator-admin-store-roles.service.js";
import {
  mapAuditLog,
  mapGrant,
  mapRole,
  type ModeratorAuditLogRow,
  type ModeratorGrantRow,
  type ModeratorRoleRow,
  type QueryExecutor
} from "../../src/moderators/moderator-admin-store-mappers.service.js";
import type {
  ModeratorAdminActor,
  ModeratorAdminAuditLog,
  ModeratorAdminGrant,
  ModeratorAdminGrantCreateInput,
  ModeratorAdminGrantUpdateInput,
  ModeratorAdminRankPath,
  ModeratorAdminRankPathInput,
  ModeratorAdminRepository,
  ModeratorAdminRole,
  ModeratorAdminRoleInput,
  ModeratorAdminUser
} from "../../src/moderators/moderator-admin.types.js";

const now = "2026-06-28T10:00:00.000Z";

const createRoleRow = (overrides: Partial<ModeratorRoleRow> = {}): ModeratorRoleRow => ({
  id: "mapped-role",
  key: "community-helper",
  name: "Community helper",
  permissions: JSON.stringify(["chat:view"]),
  rankPathId: null,
  rankPathKey: null,
  rankPathName: null,
  rankLevel: null,
  displayLabel: null,
  nextRoleId: null,
  discordRoleId: null,
  isOwnerRank: 0,
  isSystem: 0,
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const createGrantRow = (overrides: Partial<ModeratorGrantRow> = {}): ModeratorGrantRow => ({
  id: "mapped-grant",
  userId: "helper-user",
  roleId: "mapped-role",
  roleKey: "community-helper",
  roleName: "Community helper",
  rolePermissions: JSON.stringify(["chat:view"]),
  roleIsOwnerRank: 0,
  roleIsSystem: 0,
  trustLevel: "full",
  scopeKind: "global",
  scopeId: null,
  availability: "active",
  assignedByUserId: "owner-user",
  expiresAt: null,
  revokedAt: null,
  revokedByUserId: null,
  revocationReason: null,
  assignedAt: now,
  ...overrides
});

const createAuditRow = (overrides: Partial<ModeratorAuditLogRow> = {}): ModeratorAuditLogRow => ({
  id: "mapped-audit",
  targetUserId: "helper-user",
  targetDisplayName: "Helper",
  roleId: "mapped-role",
  roleKey: "community-helper",
  roleName: "Community helper",
  actorUserId: "owner-user",
  actorDisplayName: "Owner",
  action: "grant",
  previousValue: null,
  nextValue: null,
  reason: "Approved helper access",
  createdAt: now,
  ...overrides
});

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
  rankPathId: null,
  rankPathKey: null,
  rankPathName: null,
  rankLevel: null,
  displayLabel: null,
  nextRoleId: null,
  discordRoleId: null,
  isOwnerRank: key === "owner",
  isSystem: false,
  authorityIntegrity: "valid",
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
  public readonly rankPaths = new Map<string, ModeratorAdminRankPath>([
    ["mod-path", {
      id: "mod-path",
      key: "mod",
      name: "Moderator",
      description: null,
      sortOrder: 10,
      createdAt: now,
      updatedAt: now
    }]
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

  public async listRankPaths(): Promise<readonly ModeratorAdminRankPath[]> {
    return [...this.rankPaths.values()].map((rankPath) => structuredClone(rankPath));
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

  public async getRoleByKey(key: string): Promise<ModeratorAdminRole | null> {
    const role = [...this.roles.values()].find((candidate) => candidate.key === key);
    return role ? structuredClone(role) : null;
  }

  public async getRankPath(rankPathId: string): Promise<ModeratorAdminRankPath | null> {
    const rankPath = this.rankPaths.get(rankPathId);
    return rankPath ? structuredClone(rankPath) : null;
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

  public async createRankPath(input: ModeratorAdminRankPathInput): Promise<ModeratorAdminRankPath | "exists"> {
    if ([...this.rankPaths.values()].some((rankPath) => rankPath.key === input.key)) {
      return "exists";
    }

    const rankPath = {
      ...input,
      id: `rank-path-${this.rankPaths.size + 1}`,
      createdAt: now,
      updatedAt: now
    };
    this.rankPaths.set(rankPath.id, rankPath);
    return structuredClone(rankPath);
  }

  public async updateRankPath(
    rankPathId: string,
    input: ModeratorAdminRankPathInput
  ): Promise<ModeratorAdminRankPath | "not-found" | "exists" | "protected"> {
    const existing = this.rankPaths.get(rankPathId);

    if (!existing) {
      return "not-found";
    }

    const attachedRoles = [...this.roles.values()]
      .filter((role) => role.rankPathId === rankPathId);

    if (!canUpdateOrdinaryModeratorRankPath(attachedRoles)) {
      return "protected";
    }

    if ([...this.rankPaths.values()].some((rankPath) => rankPath.id !== rankPathId && rankPath.key === input.key)) {
      return "exists";
    }

    const next = {
      ...existing,
      ...input,
      id: rankPathId,
      updatedAt: now
    };
    this.rankPaths.set(rankPathId, next);
    return structuredClone(next);
  }

  public async createRole(input: ModeratorAdminRoleInput): Promise<ModeratorAdminRole | "exists" | "rank-path-not-found" | "protected"> {
    if ([...this.roles.values()].some((role) => role.key === input.key)) {
      return "exists";
    }

    if (input.rankPathId && !this.rankPaths.has(input.rankPathId)) {
      return "rank-path-not-found";
    }

    const role = {
      ...createRole(`role-${this.roles.size + 1}`, input.key, input.permissions),
      ...input,
      id: `role-${this.roles.size + 1}`,
      createdAt: now,
      updatedAt: now
    };
    this.roles.set(role.id, role);
    return structuredClone(role);
  }

  public async updateRole(
    roleId: string,
    input: ModeratorAdminRoleInput
  ): Promise<ModeratorAdminRole | "not-found" | "exists" | "rank-path-not-found" | "protected"> {
    const existing = this.roles.get(roleId);

    if (!existing) {
      return "not-found";
    }

    if ([...this.roles.values()].some((role) => role.id !== roleId && role.key === input.key)) {
      return "exists";
    }

    if (input.rankPathId && !this.rankPaths.has(input.rankPathId)) {
      return "rank-path-not-found";
    }

    const next = {
      ...existing,
      ...input,
      id: roleId,
      updatedAt: now
    };
    this.roles.set(roleId, next);
    return structuredClone(next);
  }

  public async deleteRankPath(rankPathId: string): Promise<"deleted" | "not-found" | "in-use"> {
    if (!this.rankPaths.has(rankPathId)) {
      return "not-found";
    }
    if ([...this.roles.values()].some((role) => role.rankPathId === rankPathId)) {
      return "in-use";
    }
    this.rankPaths.delete(rankPathId);
    return "deleted";
  }

  public async deleteRole(roleId: string): Promise<"deleted" | "not-found" | "protected" | "in-use"> {
    const role = this.roles.get(roleId);
    if (!role) {
      return "not-found";
    }
    if (role.isOwnerRank || role.isSystem) {
      return "protected";
    }
    if ([...this.grants.values()].some((grant) => grant.roleId === roleId)
      || [...this.roles.values()].some((candidate) => candidate.nextRoleId === roleId)) {
      return "in-use";
    }
    this.roles.delete(roleId);
    return "deleted";
  }

  private createAuditLog(
    action: ModeratorAdminAuditLog["action"],
    grant: ModeratorAdminGrant,
    _previousValue: Record<string, unknown> | null,
    _nextValue: Record<string, unknown> | null,
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
      reason,
      createdAt: now
    };
    this.auditLogs.unshift(log);
    return structuredClone(log);
  }
}

describe("Moderator rank path repository protection", () => {
  it("returns protected before issuing SQL mutation for an attached protected role", async () => {
    const statements: string[] = [];
    const executor = {
      execute: async (statement: string) => {
        statements.push(statement);

        if (statement.includes("FROM role_rank_paths")) {
          return [[{
            id: "mod-path",
            key: "mod",
            name: "Moderator",
            description: null,
            sortOrder: 10,
            createdAt: now,
            updatedAt: now
          }]];
        }

        if (statement.includes("FROM roles")) {
          return [[{
            key: " Admin ",
            permissions: JSON.stringify(["chat:view"]),
            isOwnerRank: 0,
            isSystem: 0
          }]];
        }

        throw new Error(`unexpected_statement:${statement}`);
      }
    } as unknown as QueryExecutor;

    await expect(updateStoredRankPath(executor, "mod-path", {
      key: "changed-path",
      name: "Changed path",
      description: "Must not persist",
      sortOrder: 99
    })).resolves.toBe("protected");

    expect(statements.some((statement) => statement.includes("UPDATE role_rank_paths"))).toBe(false);
  });

  it("fails closed before SQL mutation for malformed attached authority rows", async () => {
    const malformedRows = [
      { key: "", permissions: JSON.stringify(["chat:view"]), isOwnerRank: 0, isSystem: 0 },
      { key: "bad key", permissions: JSON.stringify(["chat:view"]), isOwnerRank: 0, isSystem: 0 },
      { key: "helper", permissions: 7, isOwnerRank: 0, isSystem: 0 },
      { key: "helper", permissions: JSON.stringify(["chat:view", 7]), isOwnerRank: 0, isSystem: 0 },
      { key: "helper", permissions: "not-json", isOwnerRank: 0, isSystem: 0 },
      { key: "helper", permissions: JSON.stringify(["chat:view"]), isOwnerRank: "0", isSystem: 0 },
      { key: "helper", permissions: JSON.stringify(["chat:view"]), isOwnerRank: 0 }
    ];

    for (const malformedRow of malformedRows) {
      const statements: string[] = [];
      const executor = {
        execute: async (statement: string) => {
          statements.push(statement);

          if (statement.includes("FROM role_rank_paths")) {
            return [[{
              id: "mod-path",
              key: "mod",
              name: "Moderator",
              description: null,
              sortOrder: 10,
              createdAt: now,
              updatedAt: now
            }]];
          }

          if (statement.includes("FROM roles")) {
            return [[malformedRow]];
          }

          throw new Error(`unexpected_statement:${statement}`);
        }
      } as unknown as QueryExecutor;

      await expect(updateStoredRankPath(executor, "mod-path", {
        key: "changed-path",
        name: "Changed path",
        description: "Must not persist",
        sortOrder: 99
      })).resolves.toBe("protected");
      expect(statements.some((statement) => statement.includes("UPDATE role_rank_paths"))).toBe(false);
    }
  });
});

describe("Moderator role authority mapper", () => {
  it("keeps valid ordinary role authority grantable", () => {
    expect(mapRole(createRoleRow())).toMatchObject({
      key: "community-helper",
      permissions: ["chat:view"],
      isOwnerRank: false,
      isSystem: false,
      authorityIntegrity: "valid",
      grantable: true
    });
  });

  it("sanitizes malformed authority and marks it non-grantable", () => {
    for (const row of [
      createRoleRow({ permissions: JSON.stringify({ permission: "chat:view" }) }),
      createRoleRow({ permissions: JSON.stringify(["chat:view", 7]) }),
      createRoleRow({ key: "Bad key from database" })
    ]) {
      const role = mapRole(row);
      expect(role).toMatchObject({
        key: "invalid-role-key",
        permissions: [],
        isOwnerRank: false,
        isSystem: false,
        authorityIntegrity: "invalid",
        grantable: false
      });
      expect(JSON.stringify(role)).not.toContain("Bad key from database");
      expect(JSON.stringify(role)).not.toContain("permission\":\"chat:view");
    }
  });

  it("sanitizes malformed authority in grant DTOs", () => {
    const validGrant = mapGrant(createGrantRow());
    expect(validGrant).toMatchObject({
      roleKey: "community-helper",
      rolePermissions: ["chat:view"]
    });

    for (const row of [
      createGrantRow({ rolePermissions: JSON.stringify({ permission: "chat:view" }) }),
      createGrantRow({ rolePermissions: JSON.stringify(["chat:view", 7]) }),
      createGrantRow({ roleKey: "Bad key from database" })
    ]) {
      const grant = mapGrant(row);
      expect(grant).toMatchObject({
        roleKey: "invalid-role-key",
        rolePermissions: []
      });
      expect(JSON.stringify(grant)).not.toContain("Bad key from database");
      expect(JSON.stringify(grant)).not.toContain("permission\":\"chat:view");
    }
  });
});

describe("Moderator audit mapper", () => {
  it("omits raw snapshots while preserving the finite audit summary", () => {
    const audit = mapAuditLog(createAuditRow({
      roleKey: "Bad audit key from database",
      previousValue: JSON.stringify({
        roleKey: "snapshot-owner",
        roleId: "snapshot-role-id-before",
        permissions: { wildcard: "*" }
      }),
      nextValue: {
        roleKey: "snapshot-admin",
        targetUserId: "snapshot-user-id-after",
        permissions: ["chat:view", 7]
      }
    }));

    expect(audit).toEqual({
      id: "mapped-audit",
      targetUserId: "helper-user",
      targetDisplayName: "Helper",
      roleId: "mapped-role",
      roleKey: "invalid-role-key",
      roleName: "Community helper",
      actorUserId: "owner-user",
      actorDisplayName: "Owner",
      action: "grant",
      reason: "Approved helper access",
      createdAt: now
    });
    expect(audit).not.toHaveProperty("previousValue");
    expect(audit).not.toHaveProperty("nextValue");
    expect(JSON.stringify(audit)).not.toContain("snapshot-");
    expect(JSON.stringify(audit)).not.toContain("permissions");
  });
});

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

  it("protects flagged and wildcard ranks from ordinary role CRUD", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);

    for (const key of [" OWNER ", "AdMiN"]) {
      await expect(service.createRole({
        authUserId: "auth-owner",
        role: {
          key,
          name: "Reserved authority",
          permissions: ["chat:view"],
          rankPathId: null,
          rankLevel: null,
          displayLabel: null,
          nextRoleId: null,
          discordRoleId: null,
          isOwnerRank: false,
          isSystem: false
        }
      })).resolves.toEqual({
        ok: false,
        reason: "moderator_admin_role_protected"
      });
    }
    expect([...repository.roles.values()].some((role) => role.key === "admin")).toBe(false);

    await expect(service.createRole({
      authUserId: "auth-owner",
      role: {
        key: "shadow-owner",
        name: "Shadow Owner",
        permissions: ["*"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    expect([...repository.roles.values()].some((role) => role.key === "shadow-owner")).toBe(false);

    await expect(service.createRole({
      authUserId: "auth-owner",
      role: {
        key: "system-helper",
        name: "System Helper",
        permissions: ["chat:view"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: true
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });

    await expect(service.updateRole({
      authUserId: "auth-owner",
      roleId: "helper-role",
      role: {
        key: "community-helper",
        name: "Community Helper",
        permissions: ["chat:view", "*"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    expect(repository.roles.get("helper-role")?.permissions).toEqual(["event-routing:review"]);

    await expect(service.updateRole({
      authUserId: "auth-owner",
      roleId: "helper-role",
      role: {
        key: " ADMIN ",
        name: "Community Helper",
        permissions: ["chat:view"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    expect(repository.roles.get("helper-role")?.key).toBe("community-helper");

    const inconsistentOwner = repository.roles.get("owner-role")!;
    repository.roles.set("owner-role", {
      ...inconsistentOwner,
      key: "legacy-owner",
      isOwnerRank: true,
      permissions: ["chat:view"]
    });

    await expect(service.updateRole({
      authUserId: "auth-owner",
      roleId: "owner-role",
      role: {
        key: "legacy-owner",
        name: "Legacy Owner",
        permissions: ["chat:view"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });

    await expect(service.deleteRole({
      authUserId: "auth-owner",
      roleId: "owner-role"
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });

    const reservedKeyRole = createRole("reserved-key-role", " Admin ", ["chat:view"]);
    repository.roles.set(reservedKeyRole.id, {
      ...reservedKeyRole,
      isOwnerRank: false,
      isSystem: false,
      grantable: true
    });

    await expect(service.updateRole({
      authUserId: "auth-owner",
      roleId: reservedKeyRole.id,
      role: {
        key: "community-admin",
        name: "Community Admin",
        permissions: ["chat:view"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: false
      }
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    await expect(service.deleteRole({
      authUserId: "auth-owner",
      roleId: reservedKeyRole.id
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    expect(repository.roles.get(reservedKeyRole.id)?.key).toBe(" Admin ");
    expect(repository.auditLogs).toHaveLength(0);
  });

  it("blocks grant update and revoke for protected roles without audit side effects", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);
    const protectedRole = createRole("legacy-wildcard-role", "legacy-helper", ["*"]);
    repository.roles.set(protectedRole.id, {
      ...protectedRole,
      isOwnerRank: false,
      isSystem: false,
      grantable: true
    });
    repository.grants.set("legacy-grant", {
      id: "legacy-grant",
      userId: "helper-user",
      roleId: protectedRole.id,
      roleKey: protectedRole.key,
      roleName: protectedRole.name,
      rolePermissions: protectedRole.permissions,
      trustLevel: "trusted_operator",
      scopeKind: "global",
      scopeId: null,
      availability: "always",
      assignedByUserId: "owner-user",
      expiresAt: null,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
      assignedAt: now,
      status: "active"
    });

    await expect(service.grantRole({
      authUserId: "auth-owner",
      grant: {
        targetUserId: "helper-user",
        roleId: protectedRole.id,
        trustLevel: "trusted_operator",
        scopeKind: "global",
        scopeId: null,
        availability: "always",
        expiresAt: null,
        reason: "No wildcard grant"
      }
    })).resolves.toMatchObject({
      ok: false,
      reason: "moderator_admin_role_forbidden",
      issues: expect.arrayContaining([
        "moderator_grant_protected_role_forbidden",
        "moderator_grant_dangerous_permission_forbidden"
      ])
    });

    await expect(service.updateGrant({
      authUserId: "auth-owner",
      grantId: "legacy-grant",
      update: {
        availability: "live_only",
        reason: "No wildcard mutation"
      }
    })).resolves.toMatchObject({
      ok: false,
      reason: "moderator_admin_role_forbidden",
      issues: expect.arrayContaining([
        "moderator_grant_protected_role_forbidden",
        "moderator_grant_dangerous_permission_forbidden"
      ])
    });

    await expect(service.revokeGrant({
      authUserId: "auth-owner",
      grantId: "legacy-grant",
      reason: "No wildcard revoke"
    })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_forbidden"
    });

    expect(repository.grants.get("legacy-grant")).toMatchObject({
      availability: "always",
      status: "active"
    });
    expect(repository.auditLogs).toHaveLength(0);
  });

  it("blocks every existing-role mutation for mapper-detected authority-integrity failures", async () => {
    const malformedRows = [
      createRoleRow({ id: "object-role", permissions: JSON.stringify({ permission: "chat:view" }) }),
      createRoleRow({ id: "numeric-role", permissions: JSON.stringify(["chat:view", 7]) }),
      createRoleRow({ id: "bad-key-role", key: "Bad key from database" })
    ];

    for (const row of malformedRows) {
      const repository = new FakeModeratorAdminRepository();
      const service = new ModeratorAdminService(repository);
      const role = mapRole(row);
      const grantId = `grant-${role.id}`;
      repository.roles.set(role.id, role);
      repository.grants.set(grantId, {
        id: grantId,
        userId: "helper-user",
        roleId: role.id,
        roleKey: role.key,
        roleName: role.name,
        rolePermissions: role.permissions,
        trustLevel: "helper",
        scopeKind: "global",
        scopeId: null,
        availability: "always",
        assignedByUserId: "owner-user",
        expiresAt: null,
        revokedAt: null,
        revokedByUserId: null,
        revocationReason: null,
        assignedAt: now,
        status: "active"
      });

      await expect(service.updateRole({
        authUserId: "auth-owner",
        roleId: role.id,
        role: {
          key: "community-helper",
          name: "Community helper",
          permissions: ["chat:view"],
          rankPathId: null,
          rankLevel: null,
          displayLabel: null,
          nextRoleId: null,
          discordRoleId: null,
          isOwnerRank: false,
          isSystem: false
        }
      })).resolves.toEqual({
        ok: false,
        reason: "moderator_admin_role_protected"
      });
      await expect(service.deleteRole({
        authUserId: "auth-owner",
        roleId: role.id
      })).resolves.toEqual({
        ok: false,
        reason: "moderator_admin_role_protected"
      });
      await expect(service.grantRole({
        authUserId: "auth-owner",
        grant: {
          targetUserId: "helper-user",
          roleId: role.id,
          trustLevel: "helper",
          scopeKind: "global",
          scopeId: null,
          availability: "always",
          expiresAt: null,
          reason: "Must fail closed"
        }
      })).resolves.toMatchObject({
        ok: false,
        reason: "moderator_admin_role_forbidden",
        issues: expect.arrayContaining(["moderator_grant_protected_role_forbidden"])
      });
      await expect(service.updateGrant({
        authUserId: "auth-owner",
        grantId,
        update: {
          availability: "live_only",
          reason: "Must not update"
        }
      })).resolves.toMatchObject({
        ok: false,
        reason: "moderator_admin_role_forbidden",
        issues: expect.arrayContaining(["moderator_grant_protected_role_forbidden"])
      });
      await expect(service.revokeGrant({
        authUserId: "auth-owner",
        grantId,
        reason: "Must not revoke"
      })).resolves.toEqual({
        ok: false,
        reason: "moderator_admin_role_forbidden"
      });

      expect(repository.roles.get(role.id)).toEqual(role);
      expect(repository.grants.get(grantId)).toMatchObject({
        availability: "always",
        status: "active"
      });
      expect(repository.auditLogs).toHaveLength(0);
    }
  });

  it("blocks rank-path updates with protected attached roles and preserves ordinary updates", async () => {
    const protectedRoles = [
      { key: " Owner ", permissions: ["chat:view"], isOwnerRank: false, isSystem: false },
      { key: "legacy-owner", permissions: ["chat:view"], isOwnerRank: true, isSystem: false },
      { key: "system-rank", permissions: ["chat:view"], isOwnerRank: false, isSystem: true },
      { key: "legacy-wildcard", permissions: [" * "], isOwnerRank: false, isSystem: false }
    ] as const;

    for (const protectedRole of protectedRoles) {
      const repository = new FakeModeratorAdminRepository();
      const service = new ModeratorAdminService(repository);
      const attachedRole = createRole("attached-protected-role", protectedRole.key, protectedRole.permissions);
      repository.roles.set(attachedRole.id, {
        ...attachedRole,
        rankPathId: "mod-path",
        rankPathKey: "mod",
        rankPathName: "Moderator",
        rankLevel: 1,
        isOwnerRank: protectedRole.isOwnerRank,
        isSystem: protectedRole.isSystem,
        grantable: true
      });
      const before = structuredClone(repository.rankPaths.get("mod-path"));

      await expect(service.updateRankPath({
        authUserId: "auth-owner",
        rankPathId: "mod-path",
        rankPath: {
          key: "changed-path",
          name: "Changed path",
          description: "Must not persist",
          sortOrder: 99
        }
      })).resolves.toEqual({
        ok: false,
        reason: "moderator_admin_rank_path_protected"
      });

      expect(repository.rankPaths.get("mod-path")).toEqual(before);
      expect(repository.auditLogs).toHaveLength(0);
    }

    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);
    const helperRole = repository.roles.get("helper-role")!;
    repository.roles.set(helperRole.id, {
      ...helperRole,
      rankPathId: "mod-path",
      rankPathKey: "mod",
      rankPathName: "Moderator",
      rankLevel: 1
    });

    await expect(service.updateRankPath({
      authUserId: "auth-owner",
      rankPathId: "mod-path",
      rankPath: {
        key: "community-moderation",
        name: "Community moderation",
        description: "Ordinary progression",
        sortOrder: 20
      }
    })).resolves.toMatchObject({
      ok: true,
      rankPath: {
        id: "mod-path",
        key: "community-moderation",
        name: "Community moderation",
        description: "Ordinary progression",
        sortOrder: 20
      }
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

  it("removes only unused ranks and empty promotion paths", async () => {
    const repository = new FakeModeratorAdminRepository();
    const service = new ModeratorAdminService(repository);
    const helperRole = repository.roles.get("helper-role")!;
    repository.roles.set("helper-role", { ...helperRole, rankPathId: "mod-path" });

    await expect(service.deleteRole({ authUserId: "auth-owner", roleId: "owner-role" })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    await expect(service.deleteRankPath({ authUserId: "auth-owner", rankPathId: "mod-path" })).resolves.toEqual({
      ok: false,
      reason: "moderator_admin_rank_path_in_use"
    });
    await expect(service.deleteRole({ authUserId: "auth-owner", roleId: "helper-role" })).resolves.toEqual({
      ok: true,
      id: "helper-role"
    });
    await expect(service.deleteRankPath({ authUserId: "auth-owner", rankPathId: "mod-path" })).resolves.toEqual({
      ok: true,
      id: "mod-path"
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

  it("returns a finite forbidden response for protected role creation", async () => {
    const repository = new FakeModeratorAdminRepository();
    const server = Fastify();

    registerModeratorAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ModeratorAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/moderators/roles",
      payload: {
        key: "shadow-owner",
        name: "Shadow Owner",
        permissions: ["*"],
        rankPathId: null,
        rankLevel: null,
        displayLabel: null,
        nextRoleId: null,
        discordRoleId: null,
        isOwnerRank: false,
        isSystem: false
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "moderator_admin_role_protected"
    });
    expect([...repository.roles.values()].some((role) => role.key === "shadow-owner")).toBe(false);
  });

  it("returns only finite sanitized authority state for malformed stored roles", async () => {
    const repository = new FakeModeratorAdminRepository();
    const malformedRole = mapRole(createRoleRow({
      id: "malformed-api-role",
      key: "Bad key from database",
      permissions: JSON.stringify(["chat:view", 7])
    }));
    repository.roles.set(malformedRole.id, malformedRole);
    const server = Fastify();

    registerModeratorAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ModeratorAdminService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/moderators"
    });
    const payload = response.json() as {
      roles: Array<Record<string, unknown>>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.roles.find((role) => role.id === malformedRole.id)).toMatchObject({
      key: "invalid-role-key",
      permissions: [],
      isOwnerRank: false,
      isSystem: false,
      authorityIntegrity: "invalid",
      grantable: false
    });
    expect(response.body).not.toContain("Bad key from database");
    expect(response.body).not.toContain("chat:view");
  });

  it("does not return raw historical audit snapshots", async () => {
    const repository = new FakeModeratorAdminRepository();
    repository.auditLogs.unshift(mapAuditLog(createAuditRow({
      roleKey: "Bad audit key from database",
      previousValue: JSON.stringify({
        roleKey: "snapshot-owner",
        roleId: "snapshot-role-id-before",
        permissions: { wildcard: "*" }
      }),
      nextValue: JSON.stringify({
        roleKey: "snapshot-admin",
        targetUserId: "snapshot-user-id-after",
        permissions: ["chat:view", 7]
      })
    })));
    const server = Fastify();

    registerModeratorAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ModeratorAdminService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/moderators"
    });
    const payload = response.json() as {
      auditLogs: Array<Record<string, unknown>>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.auditLogs[0]).toMatchObject({
      id: "mapped-audit",
      roleKey: "invalid-role-key",
      roleName: "Community helper",
      action: "grant",
      reason: "Approved helper access",
      createdAt: now
    });
    expect(payload.auditLogs[0]).not.toHaveProperty("previousValue");
    expect(payload.auditLogs[0]).not.toHaveProperty("nextValue");
    const serializedAudit = JSON.stringify(payload.auditLogs[0]);
    expect(serializedAudit).not.toContain("snapshot-");
    expect(serializedAudit).not.toContain("permissions");
    expect(serializedAudit).not.toContain("Bad audit key from database");
  });

  it("returns a finite forbidden response for a protected rank-path update", async () => {
    const repository = new FakeModeratorAdminRepository();
    const protectedRole = createRole("reserved-path-role", " Admin ", ["chat:view"]);
    repository.roles.set(protectedRole.id, {
      ...protectedRole,
      rankPathId: "mod-path",
      rankPathKey: "mod",
      rankPathName: "Moderator",
      rankLevel: 1,
      isOwnerRank: false,
      isSystem: false,
      grantable: true
    });
    const server = Fastify();

    registerModeratorAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new ModeratorAdminService(repository)
    });

    const response = await server.inject({
      method: "PATCH",
      url: "/admin/moderators/rank-paths/mod-path",
      payload: {
        key: "changed-path",
        name: "Changed path",
        description: "Must not persist",
        sortOrder: 99
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "moderator_admin_rank_path_protected"
    });
    expect(repository.rankPaths.get("mod-path")).toMatchObject({
      key: "mod",
      name: "Moderator",
      description: null,
      sortOrder: 10
    });
    expect(repository.auditLogs).toHaveLength(0);
  });
});
