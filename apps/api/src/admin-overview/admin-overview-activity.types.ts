import type { ModeratorTrustLevel } from "@maiks-yt/domain/community";

export type AdminOverviewActor = {
  rolePermissionValues: readonly unknown[];
};

export type AdminOverviewActiveGrantRecord = {
  roleKey: string;
  rolePermissions: readonly string[];
  trustLevel: ModeratorTrustLevel;
};

export type AdminOverviewActivityResult =
  | {
      ok: true;
      generatedAt: string;
      notifications: {
        openWarningCount: number;
        openCriticalCount: number;
      };
      activeHelperGrants: {
        count: number;
      };
    }
  | {
      ok: false;
      reason: "admin_overview_user_unlinked" | "admin_overview_forbidden";
    };

export interface AdminOverviewActivityRepository {
  resolveActor(authUserId: string): Promise<AdminOverviewActor | null>;
  countOpenWarningCriticalNotifications(): Promise<{
    openWarningCount: number;
    openCriticalCount: number;
  }>;
  listActiveHelperGrants(): Promise<readonly AdminOverviewActiveGrantRecord[]>;
}
