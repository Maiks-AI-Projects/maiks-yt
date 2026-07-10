import { execFile } from "node:child_process";
import { promisify } from "node:util";

import mysql from "mysql2/promise";

const execFileAsync = promisify(execFile);

const requiredTables = [
  "users",
  "auth_users",
  "projects",
  "content_pages",
  "stream_schedule_entries",
  "system_notifications",
  "provider_event_intake_logs",
  "money_ledger_transactions"
] as const;

type BackupToolStatus = {
  available: boolean;
  command: string | null;
  version: string | null;
};

type BackupHealthResult = {
  checkedAt: string;
  ok: boolean;
  skipped: boolean;
  reason?: string;
  warnings: string[];
  databaseReachable: boolean;
  requiredTables: Array<{
    name: string;
    present: boolean;
  }>;
  backupTool: BackupToolStatus;
};

const checkBackupTool = async (): Promise<BackupToolStatus> => {
  for (const command of ["mysqldump", "mariadb-dump"]) {
    try {
      const result = await execFileAsync(command, ["--version"], {
        timeout: 3_000,
        maxBuffer: 1024 * 1024
      });

      return {
        available: true,
        command,
        version: result.stdout.trim() || result.stderr.trim() || null
      };
    } catch {
      // Try the next common dump tool.
    }
  }

  return {
    available: false,
    command: null,
    version: null
  };
};

const checkDatabase = async (databaseUrl: string): Promise<Pick<BackupHealthResult, "databaseReachable" | "requiredTables">> => {
  const connection = await mysql.createConnection(databaseUrl);

  try {
    await connection.query("SELECT 1");
    const [rows] = await connection.query(
      `
        SELECT table_name AS tableName
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (${requiredTables.map(() => "?").join(", ")})
      `,
      [...requiredTables]
    );
    const presentTables = new Set(
      Array.isArray(rows)
        ? rows.map((row) => {
          const value = (row as { tableName?: unknown }).tableName;
          return typeof value === "string" ? value : "";
        })
        : []
    );

    return {
      databaseReachable: true,
      requiredTables: requiredTables.map((name) => ({
        name,
        present: presentTables.has(name)
      }))
    };
  } finally {
    await connection.end();
  }
};

export const runBackupHealthCheck = async (
  databaseUrl = process.env.DATABASE_URL
): Promise<BackupHealthResult> => {
  const checkedAt = new Date().toISOString();
  const backupTool = await checkBackupTool();

  if (!databaseUrl) {
    return {
      checkedAt,
      ok: true,
      skipped: true,
      reason: "DATABASE_URL is not configured.",
      warnings: backupTool.available ? [] : ["No mysqldump or mariadb-dump command was found."],
      databaseReachable: false,
      requiredTables: requiredTables.map((name) => ({
        name,
        present: false
      })),
      backupTool
    };
  }

  try {
    const database = await checkDatabase(databaseUrl);
    const hasAllTables = database.requiredTables.every((table) => table.present);
    const warnings = backupTool.available ? [] : ["No mysqldump or mariadb-dump command was found."];

    return {
      checkedAt,
      ok: hasAllTables,
      skipped: false,
      warnings,
      ...database,
      backupTool
    };
  } catch {
    return {
      checkedAt,
      ok: false,
      skipped: false,
      warnings: backupTool.available ? [] : ["No mysqldump or mariadb-dump command was found."],
      databaseReachable: false,
      requiredTables: requiredTables.map((name) => ({
        name,
        present: false
      })),
      backupTool
    };
  }
};

const main = async (): Promise<void> => {
  const result = await runBackupHealthCheck();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
