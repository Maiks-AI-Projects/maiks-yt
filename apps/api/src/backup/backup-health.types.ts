import type { runBackupHealthCheck } from "@maiks-yt/database";

export type BackupHealthActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type BackupHealthSnapshot = Awaited<ReturnType<typeof runBackupHealthCheck>>;

export type BackupHealthResult =
  | ({
    ok: true;
    readOnly: true;
    healthOk: boolean;
  } & Omit<BackupHealthSnapshot, "ok">)
  | {
    ok: false;
    reason: "backup_health_user_unlinked" | "backup_health_forbidden";
  };

export interface BackupHealthRepository {
  resolveActor(authUserId: string): Promise<BackupHealthActor | null>;
}
