import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerLiveHelperDashboardRoutes } from "../../src/live-helper/live-helper.route.js";
import { LiveHelperDashboardService } from "../../src/live-helper/live-helper.service.js";
import type {
  LiveHelperDashboardActor,
  LiveHelperDashboardRepository,
  LiveHelperEventHistorySummary,
  LiveHelperFakeLocalActiveModerationSummary,
  LiveHelperFakeLocalModerationAuditSummary,
  LiveHelperGrantRecord,
  LiveHelperNotificationSummary,
  LiveHelperPendingApprovalSummary
} from "../../src/live-helper/live-helper.types.js";

const now = "2026-06-28T10:00:00.000Z";

class FakeLiveHelperDashboardRepository implements LiveHelperDashboardRepository {
  public actor: LiveHelperDashboardActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public pendingApprovals: Array<Omit<LiveHelperPendingApprovalSummary, "label">> = [
    {
      id: "approval-1",
      eventHistoryId: "history-1",
      eventKind: "website.signup",
      sourcePlatform: "test/system",
      destination: "top_notification",
      notificationPriority: "high",
      actorDisplayName: "Safe Test User",
      createdAt: now,
      occurredAt: now
    }
  ];

  public notifications: LiveHelperNotificationSummary[] = [
    {
      id: "notification-1",
      title: "Control panel smoke failed",
      severity: "warning",
      source: "dev_smoke",
      status: "unread",
      actionUrl: "/tools/notifications",
      createdAt: now
    },
    {
      id: "notification-2",
      title: "Push delivery failed",
      severity: "critical",
      source: "system",
      status: "read",
      actionUrl: null,
      createdAt: now
    }
  ];

  public activeGrants: LiveHelperGrantRecord[] = [
    {
      id: "grant-helper",
      userId: "helper-user",
      displayName: "Live Helper",
      roleKey: "community-helper",
      roleName: "Community Helper",
      rolePermissions: ["event-routing:review"],
      trustLevel: "helper",
      scopeKind: "event_routing",
      scopeId: "approvals",
      availability: "live_only",
      assignedAt: now,
      expiresAt: null
    },
    {
      id: "grant-owner",
      userId: "owner-user",
      displayName: "Owner",
      roleKey: "owner",
      roleName: "Owner",
      rolePermissions: ["*"],
      trustLevel: "owner",
      scopeKind: "global",
      scopeId: null,
      availability: "always",
      assignedAt: now,
      expiresAt: null
    },
    {
      id: "grant-money",
      userId: "money-user",
      displayName: "Money Helper",
      roleKey: "finance-helper",
      roleName: "Finance Helper",
      rolePermissions: ["money:review"],
      trustLevel: "helper",
      scopeKind: "global",
      scopeId: null,
      availability: "always",
      assignedAt: now,
      expiresAt: null
    }
  ];

  public history: Array<Omit<LiveHelperEventHistorySummary, "label">> = [
    {
      id: "history-1",
      eventKind: "website.signup",
      sourcePlatform: "test/system",
      routingOutcome: "queued_for_approval",
      destination: "top_notification",
      actorDisplayName: "Safe Test User",
      isTest: true,
      isSimulated: true,
      occurredAt: now
    }
  ];
  public fakeLocalModerationAudit: LiveHelperFakeLocalModerationAuditSummary[] = [
    {
      id: "fake-mod-audit-1",
      attemptedAt: now,
      source: "fake-local",
      actorDisplayName: "Live Helper",
      action: "hide_message",
      outcome: "applied",
      reason: null,
      targetMessageId: "fake-message-1",
      targetAuthorName: null,
      durationSeconds: null,
      mutedUntil: null,
      note: "Local test cleanup",
      providerAction: false
    }
  ];
  public fakeLocalActiveModeration: LiveHelperFakeLocalActiveModerationSummary[] = [
    {
      id: "fake-active-1",
      stateKind: "message_hidden",
      status: "active",
      targetMessageId: "fake-message-1",
      targetAuthorName: null,
      durationSeconds: null,
      activeUntil: null,
      note: "Local test cleanup",
      providerAction: false,
      updatedAt: now
    },
    {
      id: "fake-active-2",
      stateKind: "author_muted",
      status: "active",
      targetMessageId: null,
      targetAuthorName: "Test chatter",
      durationSeconds: 60,
      activeUntil: "2026-06-28T10:01:00.000Z",
      note: "Local mute drill",
      providerAction: false,
      updatedAt: now
    }
  ];

  public async resolveActor(): Promise<LiveHelperDashboardActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async countPendingApprovals(): Promise<number> {
    return this.pendingApprovals.length;
  }

  public async listPendingApprovals(limit: number): Promise<readonly Omit<LiveHelperPendingApprovalSummary, "label">[]> {
    return this.pendingApprovals.slice(0, limit).map((approval) => structuredClone(approval));
  }

  public async countOpenWarningCriticalNotifications(): Promise<{
    openWarningCount: number;
    openCriticalCount: number;
  }> {
    return {
      openWarningCount: this.notifications.filter((notification) => notification.severity === "warning").length,
      openCriticalCount: this.notifications.filter((notification) => notification.severity === "critical").length
    };
  }

  public async listRecentWarningCriticalNotifications(limit: number): Promise<readonly LiveHelperNotificationSummary[]> {
    return this.notifications.slice(0, limit).map((notification) => structuredClone(notification));
  }

  public async listActiveHelperGrants(limit: number): Promise<readonly LiveHelperGrantRecord[]> {
    return this.activeGrants.slice(0, limit).map((grant) => structuredClone(grant));
  }

  public async listRecentSimulatedEventHistory(limit: number): Promise<readonly Omit<LiveHelperEventHistorySummary, "label">[]> {
    return this.history.slice(0, limit).map((event) => structuredClone(event));
  }

  public async listRecentFakeLocalModerationAudit(limit: number): Promise<readonly LiveHelperFakeLocalModerationAuditSummary[]> {
    return this.fakeLocalModerationAudit.slice(0, limit).map((entry) => structuredClone(entry));
  }

  public async listFakeLocalActiveModeration(limit: number): Promise<readonly LiveHelperFakeLocalActiveModerationSummary[]> {
    return this.fakeLocalActiveModeration.slice(0, limit).map((entry) => structuredClone(entry));
  }
}

describe("LiveHelperDashboardService", () => {
  it("allows owner wildcard and moderators:manage to view a sanitized read-only dashboard", async () => {
    const repository = new FakeLiveHelperDashboardRepository();
    const service = new LiveHelperDashboardService(repository);

    const ownerResult = await service.getDashboard({ authUserId: "auth-owner" });

    expect(ownerResult).toMatchObject({
      ok: true,
      readOnly: true,
      pendingApprovals: {
        count: 1,
        items: [
          {
            label: "Website Signup",
            actorDisplayName: "Safe Test User"
          }
        ]
      },
      notifications: {
        openWarningCount: 1,
        openCriticalCount: 1,
        items: [
          {
            title: "Control panel smoke failed"
          },
          {
            title: "Push delivery failed"
          }
        ]
      },
      activeHelperGrants: {
        count: 1,
        items: [
          {
            id: "grant-helper",
            displayName: "Live Helper",
            roleKey: "community-helper"
          }
        ]
      },
      recentSimulatedHistory: {
        items: [
          {
            label: "Website Signup",
            routingOutcome: "queued_for_approval"
          }
        ]
      },
      fakeLocalModerationAudit: {
        items: [
          {
            action: "hide_message",
            outcome: "applied",
            source: "fake-local",
            providerAction: false,
            note: "Local test cleanup"
          }
        ]
      },
      fakeLocalActiveModeration: {
        count: 2,
        items: [
          {
            stateKind: "message_hidden",
            status: "active",
            targetMessageId: "fake-message-1",
            providerAction: false
          },
          {
            stateKind: "author_muted",
            status: "active",
            targetAuthorName: "Test chatter",
            durationSeconds: 60,
            activeUntil: "2026-06-28T10:01:00.000Z",
            providerAction: false
          }
        ]
      }
    });
    expect(ownerResult.ok && ownerResult.activeHelperGrants.items[0]).not.toHaveProperty("rolePermissions");

    repository.actor = {
      domainUserId: "manager-user",
      rolePermissionValues: [JSON.stringify(["moderators:manage"])]
    };

    await expect(service.getDashboard({ authUserId: "auth-manager" })).resolves.toMatchObject({
      ok: true,
      readOnly: true
    });

    repository.actor = {
      domainUserId: "fake-local-helper",
      rolePermissionValues: [JSON.stringify(["fake-local-chat:moderate"])]
    };

    await expect(service.getDashboard({ authUserId: "auth-helper" })).resolves.toMatchObject({
      ok: true,
      readOnly: true
    });
  });

  it("denies unlinked and unprivileged users", async () => {
    const repository = new FakeLiveHelperDashboardRepository();
    const service = new LiveHelperDashboardService(repository);

    repository.actor = null;
    await expect(service.getDashboard({ authUserId: "auth-missing" })).resolves.toEqual({
      ok: false,
      reason: "live_helper_user_unlinked"
    });

    repository.actor = {
      domainUserId: "viewer-user",
      rolePermissionValues: [["event-routing:review"]]
    };

    await expect(service.getDashboard({ authUserId: "auth-viewer" })).resolves.toEqual({
      ok: false,
      reason: "live_helper_forbidden"
    });
  });
});

describe("Live helper dashboard routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerLiveHelperDashboardRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new LiveHelperDashboardService(new FakeLiveHelperDashboardRepository())
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/live-helper"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns 403 for authenticated users without moderator management", async () => {
    const server = Fastify();
    const repository = new FakeLiveHelperDashboardRepository();
    repository.actor = {
      domainUserId: "viewer-user",
      rolePermissionValues: [["notifications:manage"]]
    };

    registerLiveHelperDashboardRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-viewer" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new LiveHelperDashboardService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/live-helper"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "live_helper_forbidden"
    });
  });

  it("returns the dashboard for authenticated owner access", async () => {
    const server = Fastify();

    registerLiveHelperDashboardRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new LiveHelperDashboardService(new FakeLiveHelperDashboardRepository())
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/live-helper"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      readOnly: true,
      activeHelperGrants: {
        count: 1
      }
    });
  });
});
