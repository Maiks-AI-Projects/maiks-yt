import { isModeratorRoleGrantable } from "@maiks-yt/domain/community";

import type {
  AdminOverviewActivityRepository,
  AdminOverviewActivityResult
} from "./admin-overview-activity.types.js";

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

const hasOwnerWildcard = (rolePermissionValues: readonly unknown[]): boolean =>
  rolePermissionValues.some((rolePermissionValue) =>
    parsePermissionArray(rolePermissionValue).includes("*")
  );

export class AdminOverviewActivityService {
  public constructor(private readonly repository: AdminOverviewActivityRepository) {}

  public async getActivity(input: { authUserId: string }): Promise<AdminOverviewActivityResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "admin_overview_user_unlinked"
      };
    }

    if (!hasOwnerWildcard(actor.rolePermissionValues)) {
      return {
        ok: false,
        reason: "admin_overview_forbidden"
      };
    }

    const [notifications, activeHelperGrants] = await Promise.all([
      this.repository.countOpenWarningCriticalNotifications(),
      this.repository.listActiveHelperGrants()
    ]);
    const activeHelperCount = activeHelperGrants
      .filter((grant) => grant.trustLevel !== "owner")
      .filter((grant) => isModeratorRoleGrantable({
        key: grant.roleKey,
        permissions: grant.rolePermissions
      }))
      .length;

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      notifications,
      activeHelperGrants: {
        count: activeHelperCount
      }
    };
  }
}
