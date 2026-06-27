import { createHash } from "node:crypto";

import {
  canManageNotifications,
  validateNotificationCreateInput
} from "@maiks-yt/domain/notifications";
import type { NotificationCreateInput, NotificationRecord } from "@maiks-yt/domain/notifications";
import webPush from "web-push";

import type {
  NotificationAdminActor,
  NotificationAdminRepository,
  NotificationCreateResult,
  NotificationListOptions,
  NotificationListResult,
  NotificationPushConfigResult,
  NotificationPushRevokeResult,
  NotificationPushSendSummary,
  NotificationPushSubscriptionInput,
  NotificationPushSubscriptionRecord,
  NotificationPushSubscriptionResult,
  NotificationStatusUpdateInput,
  NotificationStatusUpdateResult
} from "./notification-admin.types.js";

type NotificationPushConfig = {
  publicKey: string | null;
  privateKey: string | null;
  contact: string | null;
};

const endpointHash = (endpoint: string): string =>
  createHash("sha256").update(endpoint).digest("hex");

const normalizeNullableText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSubscriptionInput = (
  input: NotificationPushSubscriptionInput
): NotificationPushSubscriptionInput | null => {
  const endpoint = input.endpoint.trim();
  const p256dh = input.keys.p256dh.trim();
  const auth = input.keys.auth.trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  try {
    const parsedEndpoint = new URL(endpoint);

    if (parsedEndpoint.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth
    },
    userAgent: normalizeNullableText(input.userAgent)
  };
};

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeNotificationAdminPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

export class NotificationAdminService {
  public constructor(
    private readonly repository: NotificationAdminRepository,
    private readonly pushConfig: NotificationPushConfig = {
      publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? null,
      privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY ?? null,
      contact: process.env.WEB_PUSH_CONTACT ?? null
    }
  ) {}

  public async listNotifications(input: {
    authUserId: string;
  } & NotificationListOptions): Promise<NotificationListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const [notifications, counts] = await Promise.all([
      this.repository.listNotifications({
        includeArchived: input.includeArchived,
        limit: input.limit
      }),
      this.repository.countUnread()
    ]);

    return {
      ok: true,
      notifications,
      unreadCount: counts.unreadCount,
      criticalUnreadCount: counts.criticalUnreadCount
    };
  }

  public async createSystemNotification(input: NotificationCreateInput): Promise<NotificationCreateResult> {
    const validation = validateNotificationCreateInput(input);

    if (!validation.ok) {
      return {
        ok: false,
        reason: "notification_invalid_input",
        issues: validation.issues
      };
    }

    const notification = await this.repository.createNotification({
      ...validation.value,
      createdByUserId: null
    });

    await this.sendPushForNotification(notification);

    return {
      ok: true,
      notification
    };
  }

  public async updateNotificationStatus(input: {
    authUserId: string;
  } & NotificationStatusUpdateInput): Promise<NotificationStatusUpdateResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const notification = await this.repository.updateNotificationStatus({
      id: input.id,
      status: input.status
    });

    if (!notification) {
      return {
        ok: false,
        reason: "notification_not_found"
      };
    }

    return {
      ok: true,
      notification
    };
  }

  public async getPushConfig(input: { authUserId: string }): Promise<NotificationPushConfigResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      enabled: this.hasPushConfig(),
      publicKey: this.pushConfig.publicKey
    };
  }

  public async registerPushSubscription(input: {
    authUserId: string;
    subscription: NotificationPushSubscriptionInput;
  }): Promise<NotificationPushSubscriptionResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!this.hasPushConfig()) {
      return {
        ok: false,
        reason: "notification_push_unavailable"
      };
    }

    const normalizedSubscription = normalizeSubscriptionInput(input.subscription);

    if (!normalizedSubscription) {
      return {
        ok: false,
        reason: "notification_push_invalid_input"
      };
    }

    return {
      ok: true,
      subscription: await this.repository.upsertPushSubscription({
        ...normalizedSubscription,
        userId: actor.domainUserId,
        endpointHash: endpointHash(normalizedSubscription.endpoint)
      })
    };
  }

  public async revokePushSubscription(input: {
    authUserId: string;
    endpoint: string;
  }): Promise<NotificationPushRevokeResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const endpoint = input.endpoint.trim();

    if (!endpoint) {
      return {
        ok: false,
        reason: "notification_push_invalid_input"
      };
    }

    return {
      ok: true,
      revoked: await this.repository.revokePushSubscription({
        userId: actor.domainUserId,
        endpointHash: endpointHash(endpoint)
      })
    };
  }

  private async sendPushForNotification(notification: NotificationRecord): Promise<NotificationPushSendSummary> {
    if (!this.hasPushConfig() || notification.status === "archived" || notification.severity === "info") {
      return {
        attempted: 0,
        sent: 0,
        failed: 0
      };
    }

    webPush.setVapidDetails(
      this.pushConfig.contact ?? "mailto:admin@maiks.yt",
      this.pushConfig.publicKey ?? "",
      this.pushConfig.privateKey ?? ""
    );

    const subscriptions = await this.repository.listActivePushSubscriptions();
    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(toWebPushSubscription(subscription), JSON.stringify({
          title: notification.title,
          body: notification.body,
          severity: notification.severity,
          source: notification.source,
          actionUrl: notification.actionUrl ?? "/tools/notifications",
          notificationId: notification.id
        }));
        await this.repository.recordPushSuccess({
          endpointHash: subscription.endpointHash
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = typeof error === "object"
          && error !== null
          && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
        await this.repository.recordPushFailure({
          endpointHash: subscription.endpointHash,
          error: error instanceof Error ? error.message : "push_send_failed",
          revoke: statusCode === 404 || statusCode === 410
        });
      }
    }

    return {
      attempted: subscriptions.length,
      sent,
      failed
    };
  }

  private hasPushConfig(): boolean {
    return Boolean(this.pushConfig.publicKey && this.pushConfig.privateKey && this.pushConfig.contact);
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "notification_admin_user_unlinked" | "notification_admin_forbidden";
  }> {
    const actor: NotificationAdminActor | null = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "notification_admin_user_unlinked"
      };
    }

    if (!canManageNotifications(normalizeNotificationAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "notification_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}

const toWebPushSubscription = (
  subscription: NotificationPushSubscriptionRecord
): webPush.PushSubscription => ({
  endpoint: subscription.endpoint,
  keys: {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth
  }
});
