import type { NotificationCreateInput, NotificationRecord } from "@maiks-yt/domain/notifications";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerNotificationAdminRoutes } from "../../src/notifications/notification-admin.route.js";
import { NotificationAdminService } from "../../src/notifications/notification-admin.service.js";
import type {
  NotificationAdminActor,
  NotificationAdminRepository,
  NotificationCreateRecordInput,
  NotificationListOptions,
  NotificationPushSubscriptionInput,
  NotificationPushSubscriptionRecord,
  NotificationStatusUpdateInput
} from "../../src/notifications/notification-admin.types.js";

const createNotification = (overrides: Partial<NotificationRecord> = {}): NotificationRecord => ({
  id: "notification-1",
  title: "Smoke monitor failed",
  body: "The overlay smoke monitor reported a timeout.",
  severity: "critical",
  source: "dev_smoke",
  status: "unread",
  actionUrl: "/admin/event-routing",
  createdByUserId: null,
  readAt: null,
  archivedAt: null,
  createdAt: "2026-06-27T10:00:00.000Z",
  updatedAt: "2026-06-27T10:00:00.000Z",
  ...overrides
});

const createInput = (overrides: Partial<NotificationCreateInput> = {}): NotificationCreateInput => ({
  title: "Smoke monitor failed",
  body: "The overlay smoke monitor reported a timeout.",
  severity: "critical",
  source: "dev_smoke",
  actionUrl: "/admin/event-routing",
  ...overrides
});

class FakeNotificationAdminRepository implements NotificationAdminRepository {
  public actor: NotificationAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly notifications = new Map<string, NotificationRecord>();
  public readonly pushSubscriptions = new Map<string, NotificationPushSubscriptionRecord>();
  public lastListOptions: NotificationListOptions | null = null;
  public lastCreate: NotificationCreateRecordInput | null = null;
  public lastStatusUpdate: NotificationStatusUpdateInput | null = null;
  public lastPushFailure: { endpointHash: string; error: string; revoke: boolean } | null = null;

  public constructor() {
    this.notifications.set("notification-1", createNotification());
    this.notifications.set("notification-2", createNotification({
      id: "notification-2",
      title: "Provider token expires soon",
      severity: "warning",
      source: "provider"
    }));
    this.notifications.set("archived-1", createNotification({
      id: "archived-1",
      title: "Old deploy note",
      severity: "info",
      status: "archived",
      archivedAt: "2026-06-26T10:00:00.000Z"
    }));
  }

  public async resolveActor(): Promise<NotificationAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listNotifications(options: NotificationListOptions): Promise<readonly NotificationRecord[]> {
    this.lastListOptions = structuredClone(options);
    const records = [...this.notifications.values()]
      .filter((notification) => options.includeArchived || notification.status !== "archived")
      .slice(0, options.limit);

    return records.map((notification) => structuredClone(notification));
  }

  public async countUnread(): Promise<{ unreadCount: number; criticalUnreadCount: number }> {
    const unread = [...this.notifications.values()]
      .filter((notification) => notification.status === "unread");

    return {
      unreadCount: unread.length,
      criticalUnreadCount: unread.filter((notification) => notification.severity === "critical").length
    };
  }

  public async createNotification(input: NotificationCreateRecordInput): Promise<NotificationRecord> {
    this.lastCreate = structuredClone(input);
    const notification = createNotification({
      id: `notification-${this.notifications.size + 1}`,
      ...input,
      status: "unread",
      readAt: null,
      archivedAt: null,
      createdAt: "2026-06-27T11:00:00.000Z",
      updatedAt: "2026-06-27T11:00:00.000Z"
    });
    this.notifications.set(notification.id, notification);

    return structuredClone(notification);
  }

  public async updateNotificationStatus(input: NotificationStatusUpdateInput): Promise<NotificationRecord | null> {
    this.lastStatusUpdate = structuredClone(input);
    const notification = this.notifications.get(input.id);

    if (!notification) {
      return null;
    }

    const updated = input.status === "read"
      ? {
        ...notification,
        status: "read" as const,
        readAt: notification.readAt ?? "2026-06-27T11:30:00.000Z",
        updatedAt: "2026-06-27T11:30:00.000Z"
      }
      : {
        ...notification,
        status: "archived" as const,
        archivedAt: notification.archivedAt ?? "2026-06-27T11:30:00.000Z",
        updatedAt: "2026-06-27T11:30:00.000Z"
      };
    this.notifications.set(input.id, updated);

    return structuredClone(updated);
  }

  public async upsertPushSubscription(input: NotificationPushSubscriptionInput & {
    userId: string;
    endpointHash: string;
  }): Promise<NotificationPushSubscriptionRecord> {
    const current = this.pushSubscriptions.get(input.endpointHash);
    const subscription: NotificationPushSubscriptionRecord = {
      id: current?.id ?? `push-${this.pushSubscriptions.size + 1}`,
      userId: input.userId,
      endpointHash: input.endpointHash,
      endpoint: input.endpoint,
      keys: structuredClone(input.keys),
      userAgent: input.userAgent,
      lastPushAt: current?.lastPushAt ?? null,
      lastError: null,
      revokedAt: null,
      createdAt: current?.createdAt ?? "2026-06-27T12:00:00.000Z",
      updatedAt: "2026-06-27T12:00:00.000Z"
    };
    this.pushSubscriptions.set(input.endpointHash, subscription);

    return structuredClone(subscription);
  }

  public async revokePushSubscription(input: {
    userId: string;
    endpointHash: string;
  }): Promise<boolean> {
    const subscription = this.pushSubscriptions.get(input.endpointHash);

    if (!subscription || subscription.userId !== input.userId || subscription.revokedAt) {
      return false;
    }

    this.pushSubscriptions.set(input.endpointHash, {
      ...subscription,
      revokedAt: "2026-06-27T12:10:00.000Z",
      updatedAt: "2026-06-27T12:10:00.000Z"
    });

    return true;
  }

  public async listActivePushSubscriptions(): Promise<readonly NotificationPushSubscriptionRecord[]> {
    return [...this.pushSubscriptions.values()]
      .filter((subscription) => !subscription.revokedAt)
      .map((subscription) => structuredClone(subscription));
  }

  public async recordPushSuccess(input: { endpointHash: string }): Promise<void> {
    const subscription = this.pushSubscriptions.get(input.endpointHash);

    if (subscription) {
      this.pushSubscriptions.set(input.endpointHash, {
        ...subscription,
        lastPushAt: "2026-06-27T12:20:00.000Z",
        lastError: null,
        updatedAt: "2026-06-27T12:20:00.000Z"
      });
    }
  }

  public async recordPushFailure(input: {
    endpointHash: string;
    error: string;
    revoke: boolean;
  }): Promise<void> {
    this.lastPushFailure = structuredClone(input);
  }
}

describe("NotificationAdminService", () => {
  it("lists notifications with unread counts for owners", async () => {
    const repository = new FakeNotificationAdminRepository();
    const service = new NotificationAdminService(repository);

    const result = await service.listNotifications({
      authUserId: "auth-user",
      includeArchived: false,
      limit: 50
    });

    expect(result).toMatchObject({
      ok: true,
      unreadCount: 2,
      criticalUnreadCount: 1,
      notifications: [
        {
          id: "notification-1",
          status: "unread"
        },
        {
          id: "notification-2",
          status: "unread"
        }
      ]
    });
    expect(repository.lastListOptions).toEqual({
      includeArchived: false,
      limit: 50
    });
  });

  it("denies unlinked and non-notification admins", async () => {
    const repository = new FakeNotificationAdminRepository();
    const service = new NotificationAdminService(repository);

    repository.actor = null;
    await expect(service.listNotifications({
      authUserId: "auth-user",
      includeArchived: false,
      limit: 50
    })).resolves.toEqual({
      ok: false,
      reason: "notification_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["tokens:manage"]]
    };
    await expect(service.updateNotificationStatus({
      authUserId: "auth-user",
      id: "notification-1",
      status: "read"
    })).resolves.toEqual({
      ok: false,
      reason: "notification_admin_forbidden"
    });
  });

  it("validates dev-created notification input before persisting", async () => {
    const repository = new FakeNotificationAdminRepository();
    const service = new NotificationAdminService(repository);

    await expect(service.createSystemNotification(createInput({
      title: " ",
      body: " "
    }))).resolves.toEqual({
      ok: false,
      reason: "notification_invalid_input",
      issues: ["notification_title_required", "notification_body_required"]
    });
    expect(repository.lastCreate).toBeNull();

    await expect(service.createSystemNotification(createInput({
      title: "  Smoke recovered  ",
      body: "  The monitor recovered.  ",
      actionUrl: " https://maiks.yt/admin "
    }))).resolves.toMatchObject({
      ok: true,
      notification: {
        title: "Smoke recovered",
        body: "The monitor recovered.",
        actionUrl: "https://maiks.yt/admin",
        createdByUserId: null
      }
    });
  });

  it("marks notifications read and archived with status timestamps", async () => {
    const repository = new FakeNotificationAdminRepository();
    const service = new NotificationAdminService(repository);

    await expect(service.updateNotificationStatus({
      authUserId: "auth-user",
      id: "notification-1",
      status: "read"
    })).resolves.toMatchObject({
      ok: true,
      notification: {
        status: "read",
        readAt: "2026-06-27T11:30:00.000Z",
        archivedAt: null
      }
    });

    await expect(service.updateNotificationStatus({
      authUserId: "auth-user",
      id: "notification-2",
      status: "archived"
    })).resolves.toMatchObject({
      ok: true,
      notification: {
        status: "archived",
        readAt: null,
        archivedAt: "2026-06-27T11:30:00.000Z"
      }
    });

    await expect(service.updateNotificationStatus({
      authUserId: "auth-user",
      id: "missing",
      status: "read"
    })).resolves.toEqual({
      ok: false,
      reason: "notification_not_found"
    });
  });

  it("returns push config and stores owner push subscriptions", async () => {
    const repository = new FakeNotificationAdminRepository();
    const service = new NotificationAdminService(repository, {
      publicKey: "public-key",
      privateKey: "private-key",
      contact: "mailto:test@example.com"
    });

    await expect(service.getPushConfig({ authUserId: "auth-user" })).resolves.toEqual({
      ok: true,
      enabled: true,
      publicKey: "public-key"
    });

    await expect(service.registerPushSubscription({
      authUserId: "auth-user",
      subscription: {
        endpoint: "https://push.example.test/subscription/1",
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key"
        },
        userAgent: "test-browser"
      }
    })).resolves.toMatchObject({
      ok: true,
      subscription: {
        userId: "domain-user",
        endpoint: "https://push.example.test/subscription/1",
        revokedAt: null
      }
    });

    const subscription = [...repository.pushSubscriptions.values()][0];
    expect(subscription?.endpointHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("revokes owner push subscriptions by endpoint", async () => {
    const repository = new FakeNotificationAdminRepository();
    const service = new NotificationAdminService(repository, {
      publicKey: "public-key",
      privateKey: "private-key",
      contact: "mailto:test@example.com"
    });
    const created = await service.registerPushSubscription({
      authUserId: "auth-user",
      subscription: {
        endpoint: "https://push.example.test/subscription/2",
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key"
        },
        userAgent: null
      }
    });

    expect(created.ok).toBe(true);
    await expect(service.revokePushSubscription({
      authUserId: "auth-user",
      endpoint: "https://push.example.test/subscription/2"
    })).resolves.toEqual({
      ok: true,
      revoked: true
    });
    expect(await repository.listActivePushSubscriptions()).toHaveLength(0);
  });
});

describe("notification admin route boundary", () => {
  it("requires auth before listing admin notifications", async () => {
    const server = Fastify();
    registerNotificationAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/notifications"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns permission denial from admin routes", async () => {
    const repository = new FakeNotificationAdminRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["event-routing:manage"]]
    };
    const server = Fastify();
    registerNotificationAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new NotificationAdminService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/notifications?includeArchived=false&limit=50"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "notification_admin_forbidden"
    });
  });

  it("protects dev notification creates with the configured secret", async () => {
    const repository = new FakeNotificationAdminRepository();
    const server = Fastify();
    registerNotificationAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new NotificationAdminService(repository),
      getNodeEnv: () => "development",
      getDevNotificationSecret: () => "dev-secret"
    });

    const missingResponse = await server.inject({
      method: "POST",
      url: "/dev/notifications",
      payload: createInput()
    });
    expect(missingResponse.statusCode).toBe(401);
    expect(missingResponse.json()).toEqual({
      ok: false,
      reason: "notification_dev_secret_missing"
    });

    const invalidResponse = await server.inject({
      method: "POST",
      url: "/dev/notifications",
      headers: {
        "x-dev-notification-secret": "wrong"
      },
      payload: createInput()
    });
    expect(invalidResponse.statusCode).toBe(403);
    expect(invalidResponse.json()).toEqual({
      ok: false,
      reason: "notification_dev_secret_invalid"
    });

    const validResponse = await server.inject({
      method: "POST",
      url: "/dev/notifications",
      headers: {
        "x-dev-notification-secret": "dev-secret"
      },
      payload: createInput({
        title: " Created from watchdog "
      })
    });
    expect(validResponse.statusCode).toBe(200);
    expect(validResponse.json()).toMatchObject({
      ok: true,
      notification: {
        title: "Created from watchdog",
        source: "dev_smoke",
        status: "unread"
      }
    });
  });

  it("disables dev notification creates in production", async () => {
    const server = Fastify();
    registerNotificationAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      getNodeEnv: () => "production",
      getDevNotificationSecret: () => "dev-secret"
    });

    const response = await server.inject({
      method: "POST",
      url: "/dev/notifications",
      headers: {
        "x-dev-notification-secret": "dev-secret"
      },
      payload: createInput()
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_found"
    });
  });

  it("updates read and archive status through post or patch routes", async () => {
    const repository = new FakeNotificationAdminRepository();
    const server = Fastify();
    registerNotificationAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new NotificationAdminService(repository)
    });

    const readResponse = await server.inject({
      method: "POST",
      url: "/admin/notifications/notification-1/read"
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      ok: true,
      notification: {
        status: "read",
        readAt: "2026-06-27T11:30:00.000Z"
      }
    });

    const archiveResponse = await server.inject({
      method: "PATCH",
      url: "/admin/notifications/notification-2/archive"
    });
    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json()).toMatchObject({
      ok: true,
      notification: {
        status: "archived",
        archivedAt: "2026-06-27T11:30:00.000Z"
      }
    });
  });

  it("registers and revokes push subscriptions through owner routes", async () => {
    const repository = new FakeNotificationAdminRepository();
    const server = Fastify();
    registerNotificationAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new NotificationAdminService(repository, {
        publicKey: "public-key",
        privateKey: "private-key",
        contact: "mailto:test@example.com"
      })
    });

    const configResponse = await server.inject({
      method: "GET",
      url: "/admin/notifications/push-config"
    });
    expect(configResponse.statusCode).toBe(200);
    expect(configResponse.json()).toEqual({
      ok: true,
      enabled: true,
      publicKey: "public-key"
    });

    const subscribeResponse = await server.inject({
      method: "POST",
      url: "/admin/notifications/push-subscriptions",
      headers: {
        "user-agent": "vitest"
      },
      payload: {
        endpoint: "https://push.example.test/subscription/route",
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key"
        }
      }
    });
    expect(subscribeResponse.statusCode).toBe(200);
    expect(subscribeResponse.json()).toMatchObject({
      ok: true,
      subscription: {
        endpoint: "https://push.example.test/subscription/route",
        userAgent: "vitest"
      }
    });

    const revokeResponse = await server.inject({
      method: "POST",
      url: "/admin/notifications/push-subscriptions/revoke",
      payload: {
        endpoint: "https://push.example.test/subscription/route"
      }
    });
    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json()).toEqual({
      ok: true,
      revoked: true
    });
  });
});
