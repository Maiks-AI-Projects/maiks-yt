import {
  isValidMoneyLedgerTransactionInput,
  moneyAccountingWarningKinds,
  moneyAccountingWarningSeverities,
  moneyDirections,
  moneyLedgerLineKinds,
  moneyModes,
  moneyPostingStatuses,
  moneyProviders,
  moneyReceiptReferenceTypes,
  moneyReceiptStorageKinds,
  moneySourceKinds,
  moneyTransactionTypes,
  moneyValueSources,
  providerEventMechanisms
} from "@maiks-yt/domain";
import type {
  MoneyLedgerLineInput,
  MoneyLedgerTransactionInput,
  MoneyReceiptReferenceInput
} from "@maiks-yt/domain";

export type DashboardStatusTone = "loading" | "ok" | "warn" | "bad";

export type DashboardStatusCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardStatusTone;
};

export type DashboardStatusResponse = {
  status: number;
  payload: unknown;
};

export type DashboardStatusResult = PromiseSettledResult<DashboardStatusResponse>;

export type AdminDashboardStatusResults = {
  api: DashboardStatusResult;
  database: DashboardStatusResult;
  notifications: DashboardStatusResult;
  intakeHealth: DashboardStatusResult;
  sessions: DashboardStatusResult;
  backupHealth: DashboardStatusResult;
  localAgent: DashboardStatusResult;
  activity: DashboardStatusResult;
  moneyLedger: DashboardStatusResult;
};

export const adminDashboardStatusRequestPaths = {
  health: "/health",
  databaseHealth: "/health/database",
  notifications: "/admin/notifications?limit=5",
  providerIntakeHealth: "/admin/connections/intake/health",
  sessions: "/admin/sessions",
  backupHealth: "/admin/backup/health",
  localAgentStatus: "/admin/local-agent/status",
  activity: "/admin/overview/activity",
  moneyLedger: "/admin/money/ledger"
} as const;

export const createAdminDashboardLoadingCards = (): readonly DashboardStatusCard[] => [
  {
    key: "api",
    label: "API",
    value: "Checking",
    detail: "Checking service availability.",
    tone: "loading"
  },
  {
    key: "database",
    label: "Database",
    value: "Checking",
    detail: "Checking data availability.",
    tone: "loading"
  },
  {
    key: "notifications",
    label: "Notifications",
    value: "Checking",
    detail: "Checking notifications.",
    tone: "loading"
  },
  {
    key: "provider-intake",
    label: "Provider Intake",
    value: "Checking",
    detail: "Checking provider connections.",
    tone: "loading"
  },
  {
    key: "sessions",
    label: "Sessions",
    value: "Checking",
    detail: "Checking owner sessions.",
    tone: "loading"
  },
  {
    key: "backup",
    label: "Backup",
    value: "Checking",
    detail: "Checking backup readiness.",
    tone: "loading"
  },
  {
    key: "local-agent",
    label: "Local Agent",
    value: "Checking",
    detail: "Checking streaming computer.",
    tone: "loading"
  },
  {
    key: "live-alerts",
    label: "Live Alerts",
    value: "Checking",
    detail: "Checking live alerts.",
    tone: "loading"
  },
  {
    key: "helpers",
    label: "Helpers",
    value: "Checking",
    detail: "Checking helper access.",
    tone: "loading"
  },
  {
    key: "money",
    label: "Money",
    value: "Checking",
    detail: "Checking money warnings.",
    tone: "loading"
  }
];

export const adminDashboardUnavailableDetail = "Status unavailable. Refresh to try again.";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const getPayload = (result: DashboardStatusResult): unknown =>
  result.status === "fulfilled" ? result.value.payload : null;

const getSuccessRecord = (result: DashboardStatusResult): UnknownRecord | null => {
  if (
    result.status !== "fulfilled"
    || !Number.isInteger(result.value.status)
    || result.value.status < 200
    || result.value.status > 299
  ) {
    return null;
  }

  const payload = asRecord(getPayload(result));
  return payload?.ok === true ? payload : null;
};

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isStringOrNull = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

const isAllowlistedString = (value: unknown, allowlist: readonly string[]): boolean =>
  typeof value === "string" && allowlist.includes(value);

const isAllowlistedStringOrNull = (value: unknown, allowlist: readonly string[]): boolean =>
  value === null || isAllowlistedString(value, allowlist);

const dashboardCountLimit = 999;

const formatDashboardCount = (count: number, lowerBound = false): string =>
  count > dashboardCountLimit
    ? `${dashboardCountLimit}+`
    : `${count}${lowerBound ? "+" : ""}`;

const formatDashboardRatio = (numerator: number, denominator: number, label: string): string =>
  `${formatDashboardCount(numerator)} of ${formatDashboardCount(denominator)} ${label}`;

const isApiHealth = (result: DashboardStatusResult): boolean => {
  const payload = getSuccessRecord(result);
  return payload !== null && payload.surface === "api";
};

const isDatabaseHealth = (result: DashboardStatusResult): boolean => {
  const payload = getSuccessRecord(result);
  return payload !== null
    && payload.surface === "api"
    && isStringOrNull(payload.database);
};

const getNotificationCounts = (result: DashboardStatusResult): {
  unread: number;
  critical: number;
} | null => {
  const payload = getSuccessRecord(result);

  if (!payload || !isCount(payload.unreadCount) || !isCount(payload.criticalUnreadCount)) {
    return null;
  }

  if (payload.criticalUnreadCount > payload.unreadCount) {
    return null;
  }

  return {
    unread: payload.unreadCount,
    critical: payload.criticalUnreadCount
  };
};

const providerIntakeStatuses = new Set(["healthy", "stale", "missing"]);

const providerIntakeInventory = {
  "twitch-eventsub": { label: "Twitch EventSub", provider: "twitch" },
  "twitch-irc": { label: "Twitch Chat", provider: "twitch" },
  "youtube-live-chat": { label: "YouTube Live Chat", provider: "youtube" },
  "youtube-activity": { label: "YouTube Activities", provider: "youtube" },
  "youtube-pubsub": { label: "YouTube PubSub", provider: "youtube" },
  "discord-gateway": { label: "Discord Gateway", provider: "discord" },
  "discord-webhook": { label: "Discord Webhooks", provider: "discord" }
} as const satisfies Record<
  (typeof providerEventMechanisms)[number],
  { label: string; provider: "twitch" | "youtube" | "discord" }
>;

const getIntakeStatuses = (result: DashboardStatusResult): readonly string[] | null => {
  const payload = getSuccessRecord(result);

  if (
    !payload
    || payload.readOnly !== true
    || typeof payload.generatedAt !== "string"
    || !isCount(payload.staleAfterMinutes)
    || !Array.isArray(payload.entries)
    || payload.entries.length !== providerEventMechanisms.length
  ) {
    return null;
  }

  const statuses = new Map<string, string>();

  for (const value of payload.entries) {
    const entry = asRecord(value);
    const mechanism = entry?.mechanism;

    if (
      !entry
      || typeof mechanism !== "string"
      || !providerEventMechanisms.includes(mechanism as (typeof providerEventMechanisms)[number])
      || statuses.has(mechanism)
    ) {
      return null;
    }

    const expected = providerIntakeInventory[mechanism as (typeof providerEventMechanisms)[number]];
    if (
      entry.provider !== expected.provider
      || entry.label !== expected.label
      || !isStringOrNull(entry.lastProviderEventName)
      || !isStringOrNull(entry.lastReceivedAt)
      || !isCount(entry.rowCount)
      || typeof entry.status !== "string"
      || !providerIntakeStatuses.has(entry.status)
    ) {
      return null;
    }

    statuses.set(mechanism, entry.status);
  }

  return providerEventMechanisms.map((mechanism) => statuses.get(mechanism) as string);
};

const isSessionRow = (value: unknown): boolean => {
  const row = asRecord(value);

  return row !== null
    && typeof row.id === "string"
    && isStringOrNull(row.ipAddress)
    && isStringOrNull(row.userAgent)
    && typeof row.createdAt === "string"
    && typeof row.updatedAt === "string"
    && typeof row.expiresAt === "string"
    && typeof row.isCurrent === "boolean"
    && typeof row.isExpired === "boolean";
};

type SessionSnapshot = {
  shownCount: number;
  hasMore: boolean;
};

const getSessionSnapshot = (result: DashboardStatusResult): SessionSnapshot | null => {
  const payload = getSuccessRecord(result);

  if (
    !payload
    || !Array.isArray(payload.sessions)
    || !payload.sessions.every(isSessionRow)
    || !isCount(payload.shownCount)
    || payload.shownCount !== payload.sessions.length
    || typeof payload.hasMore !== "boolean"
  ) {
    return null;
  }

  return {
    shownCount: payload.shownCount,
    hasMore: payload.hasMore
  };
};

type BackupSnapshot = {
  healthOk: boolean;
  databaseReachable: boolean;
  skipped: boolean;
  tableCount: number;
  missingTableCount: number;
  warningCount: number;
};

const requiredBackupTableInventory = [
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

const getBackupSnapshot = (result: DashboardStatusResult): BackupSnapshot | null => {
  const payload = getSuccessRecord(result);

  if (
    !payload
    || typeof payload.healthOk !== "boolean"
    || typeof payload.databaseReachable !== "boolean"
    || typeof payload.skipped !== "boolean"
    || !Array.isArray(payload.requiredTables)
    || !Array.isArray(payload.warnings)
    || !payload.warnings.every((warning) => typeof warning === "string")
  ) {
    return null;
  }

  const backupTool = asRecord(payload.backupTool);
  if (
    !backupTool
    || typeof backupTool.available !== "boolean"
    || (
      backupTool.available
        ? !isAllowlistedString(backupTool.command, backupToolCommands)
          || !isStringOrNull(backupTool.version)
        : backupTool.command !== null || backupTool.version !== null
    )
  ) {
    return null;
  }

  const expectedWarnings = backupTool.available ? [] : [backupToolUnavailableWarning];
  if (
    payload.warnings.length !== expectedWarnings.length
    || payload.warnings.some((warning, index) => warning !== expectedWarnings[index])
  ) {
    return null;
  }

  if (payload.requiredTables.length !== requiredBackupTableInventory.length) {
    return null;
  }

  const tablePresence = new Map<string, boolean>();

  for (const value of payload.requiredTables) {
    const table = asRecord(value);

    if (
      !table
      || typeof table.name !== "string"
      || !requiredBackupTableInventory.includes(table.name as (typeof requiredBackupTableInventory)[number])
      || tablePresence.has(table.name)
      || typeof table.present !== "boolean"
    ) {
      return null;
    }

    tablePresence.set(table.name, table.present);
  }

  const orderedTablePresence = requiredBackupTableInventory.map(
    (tableName) => tablePresence.get(tableName) as boolean
  );
  const allTablesPresent = orderedTablePresence.every(Boolean);
  const allTablesAbsent = orderedTablePresence.every((present) => !present);
  const validProducerState = payload.skipped
    ? payload.healthOk && !payload.databaseReachable && allTablesAbsent
    : payload.databaseReachable
      ? payload.healthOk === allTablesPresent
      : !payload.healthOk && allTablesAbsent;

  if (!validProducerState) {
    return null;
  }

  return {
    healthOk: payload.healthOk,
    databaseReachable: payload.databaseReachable,
    skipped: payload.skipped,
    tableCount: orderedTablePresence.length,
    missingTableCount: orderedTablePresence.filter((present) => !present).length,
    warningCount: payload.warnings.length
  };
};

const localAgentStates = new Set(["not_configured", "disconnected", "connected", "degraded"]);
const localAgentAvailabilities = new Set(["available", "degraded", "unavailable"]);

type LocalAgentSnapshot = {
  state: "not_configured" | "disconnected" | "connected" | "degraded";
  moduleCount: number;
  availableModuleCount: number;
};

const getLocalAgentSnapshot = (result: DashboardStatusResult): LocalAgentSnapshot | null => {
  const payload = getSuccessRecord(result);
  const connection = asRecord(payload?.connection);

  if (
    !payload
    || !connection
    || typeof connection.state !== "string"
    || !localAgentStates.has(connection.state)
    || !isStringOrNull(connection.serviceVersion)
    || !Array.isArray(payload.modules)
  ) {
    return null;
  }

  const availabilities = payload.modules.map((module) => asRecord(module)?.availability);
  if (!availabilities.every(
    (availability): availability is string =>
      typeof availability === "string" && localAgentAvailabilities.has(availability)
  )) {
    return null;
  }

  return {
    state: connection.state as LocalAgentSnapshot["state"],
    moduleCount: availabilities.length,
    availableModuleCount: availabilities.filter((availability) => availability === "available").length
  };
};

type ActivitySnapshot = {
  warningCount: number;
  criticalCount: number;
  helperCount: number;
};

const getActivitySnapshot = (result: DashboardStatusResult): ActivitySnapshot | null => {
  const payload = getSuccessRecord(result);
  const notifications = asRecord(payload?.notifications);
  const helperGrants = asRecord(payload?.activeHelperGrants);

  if (
    !notifications
    || !helperGrants
    || !isCount(notifications.openWarningCount)
    || !isCount(notifications.openCriticalCount)
    || !isCount(helperGrants.count)
  ) {
    return null;
  }

  return {
    warningCount: notifications.openWarningCount,
    criticalCount: notifications.openCriticalCount,
    helperCount: helperGrants.count
  };
};

const isBoundedIdentifier = (value: unknown, maxLength: number): value is string =>
  typeof value === "string"
  && value.trim().length > 0
  && value.trim().length <= maxLength;

const isBoundedIdentifierOrNull = (value: unknown, maxLength: number): value is string | null =>
  value === null || isBoundedIdentifier(value, maxLength);

const isDateString = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const getMoneyReceiptReferenceInput = (
  value: unknown
): MoneyReceiptReferenceInput | null | undefined => {
  if (value === null) {
    return null;
  }

  const row = asRecord(value);

  if (
    !row
    || !isBoundedIdentifier(row.id, 36)
    || !isAllowlistedString(row.referenceType, moneyReceiptReferenceTypes)
    || !isAllowlistedString(row.storageKind, moneyReceiptStorageKinds)
    || typeof row.label !== "string"
    || typeof row.privateReference !== "string"
    || !isBoundedIdentifierOrNull(row.createdByUserId, 36)
    || !isDateString(row.createdAt)
  ) {
    return undefined;
  }

  return {
    referenceType: row.referenceType as MoneyReceiptReferenceInput["referenceType"],
    storageKind: row.storageKind as MoneyReceiptReferenceInput["storageKind"],
    label: row.label,
    privateReference: row.privateReference
  };
};

const getMoneyLineInput = (
  value: unknown,
  transactionId: string
): MoneyLedgerLineInput | null => {
  const row = asRecord(value);
  const receiptReference = getMoneyReceiptReferenceInput(row?.receiptReference);

  if (
    !row
    || !isBoundedIdentifier(row.id, 36)
    || row.transactionId !== transactionId
    || !isBoundedIdentifier(row.transactionId, 36)
    || !isAllowlistedString(row.lineKind, moneyLedgerLineKinds)
    || !isAllowlistedString(row.direction, moneyDirections)
    || typeof row.amountMinor !== "number"
    || !isStringOrNull(row.currency)
    || !isAllowlistedString(row.valueSource, moneyValueSources)
    || typeof row.isEstimate !== "boolean"
    || !isStringOrNull(row.categoryKey)
    || !isStringOrNull(row.projectId)
    || !isStringOrNull(row.projectItemId)
    || !isBoundedIdentifierOrNull(row.ruleVersionId, 36)
    || !isBoundedIdentifierOrNull(row.receiptReferenceId, 36)
    || receiptReference === undefined
    || !isStringOrNull(row.notesPrivate)
    || !isDateString(row.createdAt)
  ) {
    return null;
  }

  return {
    lineKind: row.lineKind as MoneyLedgerLineInput["lineKind"],
    direction: row.direction as MoneyLedgerLineInput["direction"],
    amountMinor: row.amountMinor,
    currency: row.currency,
    valueSource: row.valueSource as MoneyLedgerLineInput["valueSource"],
    isEstimate: row.isEstimate,
    categoryKey: row.categoryKey,
    projectId: row.projectId,
    projectItemId: row.projectItemId,
    receiptReference,
    notesPrivate: row.notesPrivate
  };
};

const isMoneyTransactionRow = (value: unknown): boolean => {
  const row = asRecord(value);

  if (
    !row
    || !isBoundedIdentifier(row.id, 36)
    || !isAllowlistedString(row.transactionType, moneyTransactionTypes)
    || !isAllowlistedString(row.moneyMode, moneyModes)
    || !isAllowlistedString(row.sourceKind, moneySourceKinds)
    || !isAllowlistedStringOrNull(row.sourceProvider, moneyProviders)
    || !isAllowlistedString(row.postingStatus, moneyPostingStatuses)
    || typeof row.occurredAt !== "string"
    || typeof row.accountingAt !== "string"
    || !isBoundedIdentifierOrNull(row.correctsTransactionId, 36)
    || !isStringOrNull(row.correctionReason)
    || !isStringOrNull(row.notesPrivate)
    || !isBoundedIdentifierOrNull(row.sourceId, 191)
    || !isBoundedIdentifierOrNull(row.sourceEventId, 191)
    || !isBoundedIdentifierOrNull(row.createdByUserId, 36)
    || !isDateString(row.createdAt)
    || !isDateString(row.updatedAt)
    || !Array.isArray(row.lines)
  ) {
    return false;
  }

  const lines = row.lines.map((line) => getMoneyLineInput(line, row.id as string));
  if (lines.some((line) => line === null)) {
    return false;
  }

  const input: MoneyLedgerTransactionInput = {
    transactionType: row.transactionType as MoneyLedgerTransactionInput["transactionType"],
    moneyMode: row.moneyMode as MoneyLedgerTransactionInput["moneyMode"],
    sourceKind: row.sourceKind as MoneyLedgerTransactionInput["sourceKind"],
    sourceProvider: row.sourceProvider as MoneyLedgerTransactionInput["sourceProvider"],
    postingStatus: row.postingStatus as MoneyLedgerTransactionInput["postingStatus"],
    occurredAt: row.occurredAt,
    accountingAt: row.accountingAt,
    correctsTransactionId: row.correctsTransactionId,
    correctionReason: row.correctionReason,
    notesPrivate: row.notesPrivate,
    lines: lines as MoneyLedgerLineInput[]
  };

  return isValidMoneyLedgerTransactionInput(input);
};

const moneyWarningTargetKinds = ["transaction", "line", "rule", "report"] as const;

const isMoneyWarningRow = (value: unknown): boolean => {
  const row = asRecord(value);

  return row !== null
    && typeof row.id === "string"
    && isAllowlistedString(row.targetKind, moneyWarningTargetKinds)
    && typeof row.targetId === "string"
    && isAllowlistedString(row.warningKind, moneyAccountingWarningKinds)
    && isAllowlistedString(row.severity, moneyAccountingWarningSeverities)
    && row.status === "open"
    && typeof row.message === "string";
};

const getMoneyWarningCount = (result: DashboardStatusResult): number | null => {
  const payload = getSuccessRecord(result);

  return payload
    && Array.isArray(payload.transactions)
    && payload.transactions.every(isMoneyTransactionRow)
    && Array.isArray(payload.warnings)
    && payload.warnings.every(isMoneyWarningRow)
    ? payload.warnings.length
    : null;
};

export const createAdminDashboardStatusCards = (
  results: AdminDashboardStatusResults
): readonly DashboardStatusCard[] => {
  const apiAvailable = isApiHealth(results.api);
  const databaseAvailable = isDatabaseHealth(results.database);
  const notificationCounts = getNotificationCounts(results.notifications);
  const intakeEntries = getIntakeStatuses(results.intakeHealth);
  const staleOrMissingIntakes = intakeEntries?.filter((status) => status !== "healthy").length ?? 0;
  const session = getSessionSnapshot(results.sessions);
  const backup = getBackupSnapshot(results.backupHealth);
  const localAgent = getLocalAgentSnapshot(results.localAgent);
  const activity = getActivitySnapshot(results.activity);
  const moneyWarningCount = getMoneyWarningCount(results.moneyLedger);

  return [
    {
      key: "api",
      label: "API",
      value: apiAvailable ? "Online" : "Offline",
      detail: apiAvailable ? "Service is responding." : adminDashboardUnavailableDetail,
      tone: apiAvailable ? "ok" : "bad"
    },
    {
      key: "database",
      label: "Database",
      value: databaseAvailable ? "Connected" : "Unavailable",
      detail: databaseAvailable ? "Data store is responding." : adminDashboardUnavailableDetail,
      tone: databaseAvailable ? "ok" : "bad"
    },
    {
      key: "notifications",
      label: "Notifications",
      value: notificationCounts ? `${formatDashboardCount(notificationCounts.unread)} unread` : "Unavailable",
      detail: notificationCounts
        ? `${formatDashboardCount(notificationCounts.critical)} critical`
        : adminDashboardUnavailableDetail,
      tone: !notificationCounts
        ? "bad"
        : notificationCounts.critical > 0
          ? "bad"
          : notificationCounts.unread > 0
            ? "warn"
            : "ok"
    },
    {
      key: "provider-intake",
      label: "Provider Intake",
      value: intakeEntries
        ? formatDashboardRatio(intakeEntries.length - staleOrMissingIntakes, intakeEntries.length, "healthy")
        : "Unavailable",
      detail: intakeEntries
        ? `${formatDashboardCount(staleOrMissingIntakes)} stale/missing`
        : adminDashboardUnavailableDetail,
      tone: !intakeEntries
        ? "bad"
        : staleOrMissingIntakes === 0
          ? "ok"
          : "warn"
    },
    {
      key: "sessions",
      label: "Sessions",
      value: session === null
        ? "Unavailable"
        : `${formatDashboardCount(session.shownCount, session.hasMore)} active`,
      detail: session === null ? adminDashboardUnavailableDetail : "Session list is available.",
      tone: session === null ? "bad" : "ok"
    },
    {
      key: "backup",
      label: "Backup",
      value: !backup
        ? "Unavailable"
        : backup.skipped
          ? "Not configured"
          : backup.databaseReachable
            ? formatDashboardRatio(backup.tableCount - backup.missingTableCount, backup.tableCount, "tables")
            : "Unavailable",
      detail: !backup
        ? adminDashboardUnavailableDetail
        : backup.skipped
          ? "Backup readiness is not configured."
          : backup.healthOk
            ? `${formatDashboardCount(backup.warningCount)} warning${backup.warningCount === 1 ? "" : "s"}`
            : backup.databaseReachable
              ? "Required data is missing. Review backup readiness."
              : "Data is unavailable. Review backup readiness.",
      tone: !backup || (!backup.skipped && !backup.healthOk)
        ? "bad"
        : backup.skipped || backup.warningCount > 0
          ? "warn"
          : "ok"
    },
    {
      key: "local-agent",
      label: "Local Agent",
      value: localAgent?.state === "connected"
        ? "Connected"
        : localAgent?.state === "degraded"
          ? "Degraded"
          : localAgent?.state === "disconnected"
            ? "Disconnected"
            : localAgent?.state === "not_configured"
              ? "Not configured"
              : "Unavailable",
      detail: localAgent
        ? formatDashboardRatio(localAgent.availableModuleCount, localAgent.moduleCount, "modules available")
        : adminDashboardUnavailableDetail,
      tone: localAgent?.state === "connected"
        ? "ok"
        : localAgent?.state === "degraded"
          ? "warn"
          : "bad"
    },
    {
      key: "live-alerts",
      label: "Live Alerts",
      value: activity ? `${formatDashboardCount(activity.warningCount + activity.criticalCount)} open` : "Unavailable",
      detail: activity
        ? `${formatDashboardCount(activity.warningCount)} warning · ${formatDashboardCount(activity.criticalCount)} critical`
        : adminDashboardUnavailableDetail,
      tone: !activity
        ? "bad"
        : activity.criticalCount > 0
          ? "bad"
          : activity.warningCount > 0
            ? "warn"
            : "ok"
    },
    {
      key: "helpers",
      label: "Helpers",
      value: activity ? `${formatDashboardCount(activity.helperCount)} active` : "Unavailable",
      detail: activity
        ? "Non-owner helper/moderator grants currently active."
        : adminDashboardUnavailableDetail,
      tone: activity ? "ok" : "bad"
    },
    {
      key: "money",
      label: "Money",
      value: moneyWarningCount === null
        ? "Unavailable"
        : `${formatDashboardCount(moneyWarningCount)} warning${moneyWarningCount === 1 ? "" : "s"}`,
      detail: moneyWarningCount === null
        ? adminDashboardUnavailableDetail
        : moneyWarningCount === 0
          ? "No money warnings"
          : "Money ledger warning state requires review",
      tone: moneyWarningCount === null
        ? "bad"
        : moneyWarningCount > 0
          ? "warn"
          : "ok"
    }
  ];
};
