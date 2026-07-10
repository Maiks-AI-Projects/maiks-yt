import { canUseBackupAdmin } from "./backup-admin-access.service.js";
import type {
  BackupKeyDataExportRepository,
  BackupKeyDataExportResult
} from "./backup-key-data-export.types.js";

const defaultRowLimitPerSection = 1_000;

const keyDataExportExclusions = [
  "Raw auth sessions, auth accounts, dev auth tokens, URL token hashes, and provider runtime credentials.",
  "Raw provider payloads beyond existing redacted/event-facing rows.",
  "Push subscription secrets, environment variables, server config, Cloudflare/Docker config, and filesystem uploads.",
  "Full disaster-recovery dump, encryption, retention, and restore automation."
] as const;

export class BackupKeyDataExportService {
  public constructor(
    private readonly repository: BackupKeyDataExportRepository,
    private readonly rowLimitPerSection = defaultRowLimitPerSection
  ) {}

  public async buildExport(input: { authUserId: string }): Promise<BackupKeyDataExportResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "backup_key_data_export_user_unlinked"
      };
    }

    if (!canUseBackupAdmin(actor.rolePermissionValues)) {
      return {
        ok: false,
        reason: "backup_key_data_export_forbidden"
      };
    }

    const generatedAt = new Date().toISOString();

    return {
      ok: true,
      readOnly: true,
      formatVersion: 1,
      generatedAt,
      generatedByUserId: actor.domainUserId,
      rowLimitPerSection: this.rowLimitPerSection,
      sections: await this.repository.buildExport(this.rowLimitPerSection),
      exclusions: [...keyDataExportExclusions]
    };
  }
}
