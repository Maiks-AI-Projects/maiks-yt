import { canManageModerators, isModeratorRoleGrantable } from "@maiks-yt/domain/community";
import { getEventRegistryEntry } from "@maiks-yt/domain/events";

import type {
  LiveHelperDashboardActor,
  LiveHelperDashboardRepository,
  LiveHelperDashboardResult
} from "./live-helper.types.js";

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

export const normalizeLiveHelperPermissions = (
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

export class LiveHelperDashboardService {
  public constructor(private readonly repository: LiveHelperDashboardRepository) {}

  public async getDashboard(input: { authUserId: string }): Promise<LiveHelperDashboardResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const [
      pendingApprovalCount,
      pendingApprovals,
      notificationCounts,
      notifications,
      activeHelperGrants,
      recentSimulatedHistory
    ] = await Promise.all([
      this.repository.countPendingApprovals(),
      this.repository.listPendingApprovals(10),
      this.repository.countOpenWarningCriticalNotifications(),
      this.repository.listRecentWarningCriticalNotifications(8),
      this.repository.listActiveHelperGrants(25),
      this.repository.listRecentSimulatedEventHistory(10)
    ]);

    const safeHelperGrants = activeHelperGrants
      .filter((grant) => grant.trustLevel !== "owner")
      .filter((grant) => isModeratorRoleGrantable({
        key: grant.roleKey,
        permissions: grant.rolePermissions
      }))
      .map(({ rolePermissions: _rolePermissions, ...grant }) => grant);

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      readOnly: true,
      pendingApprovals: {
        count: pendingApprovalCount,
        items: pendingApprovals.map((approval) => ({
          ...approval,
          label: getEventRegistryEntry(approval.eventKind).label
        }))
      },
      notifications: {
        ...notificationCounts,
        items: notifications
      },
      activeHelperGrants: {
        count: safeHelperGrants.length,
        items: safeHelperGrants
      },
      recentSimulatedHistory: {
        items: recentSimulatedHistory.map((event) => ({
          ...event,
          label: getEventRegistryEntry(event.eventKind).label
        }))
      },
      boundaries: [
        "Read-only dashboard snapshot.",
        "No grant, revoke, approve, reject, or moderation actions are available here.",
        "Only safe simulated/test event routing history is summarized.",
        "Raw payloads, secrets, provider credentials, tokens, and deleted-user data are not returned."
      ]
    };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "live_helper_user_unlinked" | "live_helper_forbidden";
  }> {
    const actor: LiveHelperDashboardActor | null = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "live_helper_user_unlinked"
      };
    }

    if (!canManageModerators(normalizeLiveHelperPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "live_helper_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}
