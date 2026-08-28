export type BackupHealthDatabaseFailureCategory =
  | "timeout"
  | "authentication"
  | "network"
  | "query"
  | "unknown";

export type BackupHealthTable = {
  name: string;
  present: boolean;
};

export type BackupHealthProjection = {
  checkedAt: string;
  healthOk: boolean;
  skipped: boolean;
  databaseReachable: boolean;
  databaseFailureCategory: BackupHealthDatabaseFailureCategory | null;
  requiredTables: readonly BackupHealthTable[];
  backupTool: {
    available: boolean;
    command: "mysqldump" | "mariadb-dump" | null;
    version: string | null;
  };
  warnings: readonly string[];
};

export type BackupHealthLoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

export type BackupHealthLoadResult =
  | {
    kind: "ready";
    health: BackupHealthProjection;
  }
  | {
    kind: "failed";
    state: Exclude<BackupHealthLoadState, "loading" | "ready">;
    message: string;
  };

export const backupHealthUnavailableMessage = "Backup health is unavailable. Refresh to try again.";

// These values mirror the database health producer's fixed inventory and finite copy.
export const backupHealthRequiredTables = [
  "users",
  "auth_users",
  "projects",
  "content_pages",
  "stream_schedule_entries",
  "system_notifications",
  "provider_event_intake_logs",
  "money_ledger_transactions"
] as const;

const backupToolCommands = ["mysqldump", "mariadb-dump"] as const;
const backupToolUnavailableWarning = "No mysqldump or mariadb-dump command was found.";
const skippedCheckReason = "DATABASE_URL is not configured.";
const backupHealthFailureReasons = new Set([
  "backup_health_forbidden",
  "backup_health_unavailable",
  "backup_health_user_unlinked",
  "not_authenticated"
]);

const databaseFailureCategories = new Set<BackupHealthDatabaseFailureCategory>([
  "timeout",
  "authentication",
  "network",
  "query",
  "unknown"
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): boolean => {
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  const actualKeys = Object.keys(value);

  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && actualKeys.every((key) => allowedKeys.has(key));
};

const isCanonicalTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length !== 24 || !value.endsWith("Z")) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const parseDatabaseFailureCategory = (value: unknown): BackupHealthDatabaseFailureCategory | null | undefined => {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && databaseFailureCategories.has(value as BackupHealthDatabaseFailureCategory)
    ? value as BackupHealthDatabaseFailureCategory
    : undefined;
};

const parseDumpVersion = (command: "mysqldump" | "mariadb-dump", value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return undefined;
  }

  if (value.includes("/") || value.includes("\\")) {
    return undefined;
  }

  // The producer returns command output. Keep only the bounded version token.
  const match = new RegExp(`^${command}\\s+(?:Ver\\s+)?([0-9]+(?:\\.[0-9]+){0,3}(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?)(?:\\s|$)`, "i").exec(value);
  const version = match?.[1];

  return version && version.length <= 32 ? version : undefined;
};

const parseBackupTool = (value: unknown): BackupHealthProjection["backupTool"] | null => {
  if (!isRecord(value) || !hasExactKeys(value, ["available", "command", "version"])) {
    return null;
  }

  if (typeof value.available !== "boolean") {
    return null;
  }

  if (!value.available) {
    return value.command === null && value.version === null
      ? { available: false, command: null, version: null }
      : null;
  }

  if (!backupToolCommands.includes(value.command as (typeof backupToolCommands)[number])) {
    return null;
  }

  const command = value.command as (typeof backupToolCommands)[number];
  const version = parseDumpVersion(command, value.version);

  return version === undefined
    ? null
    : { available: true, command, version };
};

const parseRequiredTables = (value: unknown): readonly BackupHealthTable[] | null => {
  if (!Array.isArray(value) || value.length !== backupHealthRequiredTables.length) {
    return null;
  }

  const tablePresence = new Map<string, boolean>();
  for (const row of value) {
    if (!isRecord(row) || !hasExactKeys(row, ["name", "present"])) {
      return null;
    }

    const name = row.name;
    if (
      typeof name !== "string"
      || !backupHealthRequiredTables.includes(name as (typeof backupHealthRequiredTables)[number])
      || tablePresence.has(name)
      || typeof row.present !== "boolean"
    ) {
      return null;
    }

    tablePresence.set(name, row.present);
  }

  return backupHealthRequiredTables.map((name) => ({
    name,
    present: tablePresence.get(name) as boolean
  }));
};

const parseWarnings = (value: unknown, backupTool: BackupHealthProjection["backupTool"]): readonly string[] | null => {
  const expectedWarnings = backupTool.available ? [] : [backupToolUnavailableWarning];
  return Array.isArray(value)
    && value.length === expectedWarnings.length
    && value.every((warning, index) => warning === expectedWarnings[index])
    ? expectedWarnings
    : null;
};

const parseSuccessfulResponse = (value: Record<string, unknown>): BackupHealthProjection | null => {
  if (
    !hasExactKeys(
      value,
      [
        "ok",
        "readOnly",
        "healthOk",
        "checkedAt",
        "skipped",
        "warnings",
        "databaseReachable",
        "databaseFailureCategory",
        "requiredTables",
        "backupTool"
      ],
      ["reason"]
    )
    || value.ok !== true
    || value.readOnly !== true
    || typeof value.healthOk !== "boolean"
    || !isCanonicalTimestamp(value.checkedAt)
    || typeof value.skipped !== "boolean"
    || typeof value.databaseReachable !== "boolean"
  ) {
    return null;
  }

  const databaseFailureCategory = parseDatabaseFailureCategory(value.databaseFailureCategory);
  const requiredTables = parseRequiredTables(value.requiredTables);
  const backupTool = parseBackupTool(value.backupTool);
  if (databaseFailureCategory === undefined || !requiredTables || !backupTool) {
    return null;
  }

  const warnings = parseWarnings(value.warnings, backupTool);
  if (!warnings) {
    return null;
  }

  const allTablesPresent = requiredTables.every((table) => table.present);
  const allTablesAbsent = requiredTables.every((table) => !table.present);
  const hasSkippedReason = Object.prototype.hasOwnProperty.call(value, "reason");
  const validProducerState = value.skipped
    ? hasSkippedReason
      && value.reason === skippedCheckReason
      && value.healthOk
      && !value.databaseReachable
      && databaseFailureCategory === null
      && allTablesAbsent
    : !hasSkippedReason
      && (value.databaseReachable
        ? databaseFailureCategory === null && value.healthOk === allTablesPresent
        : databaseFailureCategory !== null && !value.healthOk && allTablesAbsent);

  return validProducerState
    ? {
      checkedAt: value.checkedAt,
      healthOk: value.healthOk,
      skipped: value.skipped,
      databaseReachable: value.databaseReachable,
      databaseFailureCategory,
      requiredTables,
      backupTool,
      warnings
    }
    : null;
};

const parseFailureReason = (value: unknown): string | null => {
  if (!isRecord(value) || !hasExactKeys(value, ["ok", "reason"]) || value.ok !== false || typeof value.reason !== "string") {
    return null;
  }

  return backupHealthFailureReasons.has(value.reason) ? value.reason : null;
};

const failureResult = (
  state: Exclude<BackupHealthLoadState, "loading" | "ready">
): BackupHealthLoadResult => ({
  kind: "failed",
  state,
  message: state === "signed-out"
    ? "Sign in as owner to view backup health."
    : state === "forbidden"
      ? "This account cannot view backup health."
      : backupHealthUnavailableMessage
});

export const parseBackupHealthResponse = (status: number, payload: unknown): BackupHealthLoadResult => {
  if (!Number.isInteger(status) || status < 100 || status > 599 || status < 200 || status >= 300) {
    const reason = parseFailureReason(payload);
    if (status === 401 && reason === "not_authenticated") {
      return failureResult("signed-out");
    }
    if (status === 403 && (reason === "backup_health_forbidden" || reason === "backup_health_user_unlinked")) {
      return failureResult("forbidden");
    }
    return failureResult("failed");
  }

  if (!isRecord(payload)) {
    return failureResult("failed");
  }

  const health = parseSuccessfulResponse(payload);
  return health ? { kind: "ready", health } : failureResult("failed");
};

export const getBackupHealthExceptionFailure = (_error: unknown): BackupHealthLoadResult =>
  failureResult("failed");
