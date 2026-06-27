import {
  canManageNotifications,
  validateNotificationCreateInput
} from "@maiks-yt/domain/notifications";
import type { NotificationCreateInput } from "@maiks-yt/domain/notifications";

import type {
  NotificationAdminActor,
  NotificationAdminRepository,
  NotificationCreateResult,
  NotificationListOptions,
  NotificationListResult,
  NotificationStatusUpdateInput,
  NotificationStatusUpdateResult
} from "./notification-admin.types.js";

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
  public constructor(private readonly repository: NotificationAdminRepository) {}

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

    return {
      ok: true,
      notification: await this.repository.createNotification({
        ...validation.value,
        createdByUserId: null
      })
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
