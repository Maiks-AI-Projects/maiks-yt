export type BackupKeyDataExportActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type BackupKeyDataExportRow = Record<string, unknown>;

export type BackupKeyDataExportSection = {
  name: string;
  rowCount: number;
  truncated: boolean;
  rows: BackupKeyDataExportRow[];
};

export type BackupKeyDataExportPayload = {
  ok: true;
  readOnly: true;
  formatVersion: 1;
  generatedAt: string;
  generatedByUserId: string;
  rowLimitPerSection: number;
  sections: BackupKeyDataExportSection[];
  exclusions: string[];
};

export type BackupKeyDataExportResult =
  | BackupKeyDataExportPayload
  | {
    ok: false;
    reason: "backup_key_data_export_user_unlinked" | "backup_key_data_export_forbidden";
  };

export interface BackupKeyDataExportRepository {
  resolveActor(authUserId: string): Promise<BackupKeyDataExportActor | null>;
  buildExport(rowLimitPerSection: number): Promise<BackupKeyDataExportSection[]>;
}
