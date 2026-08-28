import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  AdminOverviewActivityService,
  createAdminOverviewActivityRepository,
  registerAdminOverviewActivityRoutes
} from "../../src/admin-overview/index.js";
import type {
  AdminOverviewActiveGrantRecord,
  AdminOverviewActivityRepository,
  AdminOverviewActor
} from "../../src/admin-overview/index.js";

const createActiveGrant = (
  overrides: Partial<AdminOverviewActiveGrantRecord> = {}
): AdminOverviewActiveGrantRecord => ({
  roleKey: "community-helper",
  rolePermissions: ["event-routing:review"],
  roleIsOwnerRank: false,
  roleIsSystem: false,
  roleAuthorityIntegrity: "valid",
  trustLevel: "helper",
  ...overrides
});

class FakeAdminOverviewActivityRepository implements AdminOverviewActivityRepository {
  public actor: AdminOverviewActor | null = {
    rolePermissionValues: [["*"]]
  };

  public notifications = {
    openWarningCount: 2,
    openCriticalCount: 1
  };

  public activeGrants: AdminOverviewActiveGrantRecord[] = [
    createActiveGrant(),
    createActiveGrant({
      roleKey: "legacy-owner-rank",
      roleIsOwnerRank: true
    }),
    createActiveGrant({
      roleKey: "system-helper",
      roleIsSystem: true
    }),
    createActiveGrant({
      roleKey: "wildcard-helper",
      rolePermissions: ["*"]
    }),
    createActiveGrant({
      roleKey: "invalid-role-key",
      rolePermissions: [],
      roleAuthorityIntegrity: "invalid"
    }),
    createActiveGrant({
      roleKey: "invalid-role-key",
      rolePermissions: [],
      roleAuthorityIntegrity: "invalid"
    }),
    createActiveGrant({
      roleKey: "invalid-role-key",
      rolePermissions: [],
      roleAuthorityIntegrity: "invalid"
    })
  ];

  public async resolveActor(): Promise<AdminOverviewActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async countOpenWarningCriticalNotifications(): Promise<{
    openWarningCount: number;
    openCriticalCount: number;
  }> {
    return structuredClone(this.notifications);
  }

  public async listActiveHelperGrants(): Promise<readonly AdminOverviewActiveGrantRecord[]> {
    return this.activeGrants.map((grant) => structuredClone(grant));
  }
}

describe("Admin Overview activity repository", () => {
  it("projects complete authority and sanitizes malformed role rows", async () => {
    const statements: string[] = [];
    const rows = [
      {
        roleKey: "community-helper",
        rolePermissions: JSON.stringify(["event-routing:review"]),
        roleIsOwnerRank: 0,
        roleIsSystem: 0,
        trustLevel: "helper"
      },
      {
        roleKey: "legacy-owner-rank",
        rolePermissions: JSON.stringify(["chat:view"]),
        roleIsOwnerRank: 1,
        roleIsSystem: 0,
        trustLevel: "helper"
      },
      {
        roleKey: "system-helper",
        rolePermissions: JSON.stringify(["chat:view"]),
        roleIsOwnerRank: 0,
        roleIsSystem: 1,
        trustLevel: "helper"
      },
      {
        roleKey: "wildcard-helper",
        rolePermissions: JSON.stringify(["*"]),
        roleIsOwnerRank: 0,
        roleIsSystem: 0,
        trustLevel: "helper"
      },
      {
        roleKey: "object-permission-secret",
        rolePermissions: JSON.stringify({ permission: "chat:view" }),
        roleIsOwnerRank: 0,
        roleIsSystem: 0,
        trustLevel: "helper"
      },
      {
        roleKey: "numeric-permission-secret",
        rolePermissions: JSON.stringify(["chat:view", 7]),
        roleIsOwnerRank: 0,
        roleIsSystem: 0,
        trustLevel: "helper"
      },
      {
        roleKey: "Bad key from overview database",
        rolePermissions: JSON.stringify(["chat:view"]),
        roleIsOwnerRank: 0,
        roleIsSystem: 0,
        trustLevel: "helper"
      }
    ];
    const pool = {
      execute: async (statement: string) => {
        statements.push(statement);
        return [rows];
      }
    };
    const repository = createAdminOverviewActivityRepository(pool as never);

    const grants = await repository.listActiveHelperGrants();

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("roles.is_owner_rank AS roleIsOwnerRank");
    expect(statements[0]).toContain("roles.is_system AS roleIsSystem");
    expect(statements[0]).not.toContain("roles.`key` NOT IN");
    expect(grants.slice(0, 4)).toEqual([
      createActiveGrant(),
      createActiveGrant({
        roleKey: "legacy-owner-rank",
        rolePermissions: ["chat:view"],
        roleIsOwnerRank: true
      }),
      createActiveGrant({
        roleKey: "system-helper",
        rolePermissions: ["chat:view"],
        roleIsSystem: true
      }),
      createActiveGrant({
        roleKey: "wildcard-helper",
        rolePermissions: ["*"]
      })
    ]);
    expect(grants.slice(4)).toEqual([
      createActiveGrant({
        roleKey: "invalid-role-key",
        rolePermissions: [],
        roleAuthorityIntegrity: "invalid"
      }),
      createActiveGrant({
        roleKey: "invalid-role-key",
        rolePermissions: [],
        roleAuthorityIntegrity: "invalid"
      }),
      createActiveGrant({
        roleKey: "invalid-role-key",
        rolePermissions: [],
        roleAuthorityIntegrity: "invalid"
      })
    ]);
    const serialized = JSON.stringify(grants);
    expect(serialized).not.toContain("object-permission-secret");
    expect(serialized).not.toContain("numeric-permission-secret");
    expect(serialized).not.toContain("Bad key from overview database");
    expect(serialized).not.toContain("\"permission\":\"chat:view\"");
    expect(serialized).not.toContain("[\"chat:view\",7]");
  });
});

describe("AdminOverviewActivityService", () => {
  it("counts only valid ordinary roles as active helper grants", async () => {
    const service = new AdminOverviewActivityService(new FakeAdminOverviewActivityRepository());

    await expect(service.getActivity({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      notifications: {
        openWarningCount: 2,
        openCriticalCount: 1
      },
      activeHelperGrants: {
        count: 1
      }
    });
  });

  it("denies unlinked and non-owner actors", async () => {
    const repository = new FakeAdminOverviewActivityRepository();
    const service = new AdminOverviewActivityService(repository);

    repository.actor = null;
    await expect(service.getActivity({ authUserId: "auth-missing" })).resolves.toEqual({
      ok: false,
      reason: "admin_overview_user_unlinked"
    });

    repository.actor = {
      rolePermissionValues: [JSON.stringify(["moderators:manage"])]
    };
    await expect(service.getActivity({ authUserId: "auth-manager" })).resolves.toEqual({
      ok: false,
      reason: "admin_overview_forbidden"
    });
  });
});

describe("admin overview activity route", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerAdminOverviewActivityRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/overview/activity"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns 403 for authenticated non-owner access", async () => {
    const server = Fastify();
    const repository = new FakeAdminOverviewActivityRepository();
    repository.actor = {
      rolePermissionValues: [["moderators:manage"]]
    };

    registerAdminOverviewActivityRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-manager" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new AdminOverviewActivityService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/overview/activity"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "admin_overview_forbidden"
    });
  });

  it("returns a minimal snapshot counting only valid ordinary helper authority", async () => {
    const server = Fastify();

    registerAdminOverviewActivityRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new AdminOverviewActivityService(
        new FakeAdminOverviewActivityRepository()
      )
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/overview/activity"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      notifications: {
        openWarningCount: 2,
        openCriticalCount: 1
      },
      activeHelperGrants: {
        count: 1
      }
    });
    expect(response.json()).not.toHaveProperty("pendingApprovals");
    expect(response.json()).not.toHaveProperty("recentSimulatedHistory");
    expect(response.json()).not.toHaveProperty("fakeLocalModerationAudit");
    expect(response.json()).not.toHaveProperty("fakeLocalActiveModeration");
  });

  it("returns a sanitized 503 when the service fails", async () => {
    const server = Fastify();

    registerAdminOverviewActivityRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        getActivity: async () => {
          throw new Error("sensitive database detail");
        }
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/overview/activity"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "admin_overview_unavailable"
    });
    expect(response.body).not.toContain("sensitive database detail");
  });
});
