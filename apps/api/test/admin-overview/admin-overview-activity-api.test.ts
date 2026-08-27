import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  AdminOverviewActivityService,
  registerAdminOverviewActivityRoutes
} from "../../src/admin-overview/index.js";
import type {
  AdminOverviewActiveGrantRecord,
  AdminOverviewActivityRepository,
  AdminOverviewActor
} from "../../src/admin-overview/index.js";

class FakeAdminOverviewActivityRepository implements AdminOverviewActivityRepository {
  public actor: AdminOverviewActor | null = {
    rolePermissionValues: [["*"]]
  };

  public notifications = {
    openWarningCount: 2,
    openCriticalCount: 1
  };

  public activeGrants: AdminOverviewActiveGrantRecord[] = [
    {
      roleKey: "community-helper",
      rolePermissions: ["event-routing:review"],
      trustLevel: "helper"
    },
    {
      roleKey: "owner",
      rolePermissions: ["*"],
      trustLevel: "owner"
    },
    {
      roleKey: "finance-helper",
      rolePermissions: ["money:review"],
      trustLevel: "helper"
    }
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

describe("AdminOverviewActivityService", () => {
  it("returns only production activity counts for owner wildcard", async () => {
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

  it("returns the minimal activity snapshot for owner access", async () => {
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
