import { runBackupHealthCheck } from "@maiks-yt/database";

import type { BackupHealthRepository, BackupHealthResult } from "./backup-health.types.js";

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

const canViewBackupHealth = (rolePermissionValues: readonly unknown[]): boolean =>
  rolePermissionValues.some((rolePermissionValue) =>
    parsePermissionArray(rolePermissionValue).includes("*")
  );

export class BackupHealthService {
  public constructor(private readonly repository: BackupHealthRepository) {}

  public async getHealth(input: { authUserId: string }): Promise<BackupHealthResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "backup_health_user_unlinked"
      };
    }

    if (!canViewBackupHealth(actor.rolePermissionValues)) {
      return {
        ok: false,
        reason: "backup_health_forbidden"
      };
    }

    const health = await runBackupHealthCheck();

    return {
      ok: true,
      readOnly: true,
      healthOk: health.ok,
      checkedAt: health.checkedAt,
      skipped: health.skipped,
      ...(health.reason ? { reason: health.reason } : {}),
      warnings: health.warnings,
      databaseReachable: health.databaseReachable,
      requiredTables: health.requiredTables,
      backupTool: health.backupTool
    };
  }
}
