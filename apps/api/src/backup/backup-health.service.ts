import { runBackupHealthCheck } from "@maiks-yt/database";

import { canUseBackupAdmin } from "./backup-admin-access.service.js";
import type { BackupHealthRepository, BackupHealthResult } from "./backup-health.types.js";

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

    if (!canUseBackupAdmin(actor.rolePermissionValues)) {
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
