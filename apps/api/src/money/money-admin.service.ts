import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  canManageMoneyLedger,
  isValidMoneyLedgerTransactionInput
} from "@maiks-yt/domain";
import type {
  MoneyAccountingWarning,
  MoneyAccountingWarningKind,
  MoneyLedgerLine,
  MoneyLedgerTransaction,
  MoneyLedgerTransactionInput
} from "@maiks-yt/domain";

import type {
  MoneyAdminExportResult,
  MoneyAdminImportPreviewResult,
  MoneyAdminJsonReportResult,
  MoneyAdminLedgerFilters,
  MoneyAdminListResult,
  MoneyAdminMutationResult,
  MoneyAdminReceiptDownloadResult,
  MoneyAdminReceiptUploadResult,
  MoneyAdminReviewPackageExportResult,
  MoneyAdminReviewPackagePayload,
  MoneyAdminReportBucket,
  MoneyAdminRepository,
  MoneyAdminWarningExportResult,
  MoneyAdminWarningResolveResult
} from "./money-admin.types.js";
import { buildMoneyImportPreview } from "./money-import-preview.service.js";

const receiptUploadMaxBytes = 5 * 1024 * 1024;
const receiptUploadStorageDir = path.resolve(process.cwd(), ".private", "money-receipts");
const allowedReceiptContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain"
]);

type ReceiptUploadMetadata = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  uploadedAt: string;
  uploadedByUserId: string;
};

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

const normalizeMoneyPermissions = (rolePermissionValues: readonly unknown[]): string[] => {
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

const normalizeNullableText = (value: string | null | undefined, maxLength: number): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
};

const normalizeReceiptFilename = (value: string): string => {
  const cleaned = value
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();

  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "receipt-upload";
};

const getReceiptUploadPaths = (id: string): {
  filePath: string;
  metadataPath: string;
} => {
  const safeId = id.replace(/[^a-f0-9-]/g, "");

  return {
    filePath: path.join(receiptUploadStorageDir, `${safeId}.bin`),
    metadataPath: path.join(receiptUploadStorageDir, `${safeId}.json`)
  };
};

const parseReceiptUploadMetadata = (value: unknown): ReceiptUploadMetadata | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const metadata = value as Record<string, unknown>;

  if (
    typeof metadata.id !== "string"
    || typeof metadata.filename !== "string"
    || typeof metadata.contentType !== "string"
    || typeof metadata.sizeBytes !== "number"
    || typeof metadata.checksum !== "string"
    || typeof metadata.uploadedAt !== "string"
    || typeof metadata.uploadedByUserId !== "string"
  ) {
    return null;
  }

  return metadata as ReceiptUploadMetadata;
};

const normalizeCurrency = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 3) : null;
};

const normalizeLedgerFilters = (filters?: Partial<MoneyAdminLedgerFilters>): MoneyAdminLedgerFilters | null => {
  const accountingFrom = normalizeNullableText(filters?.accountingFrom, 40);
  const accountingTo = normalizeNullableText(filters?.accountingTo, 40);

  if (
    (accountingFrom && !Number.isFinite(Date.parse(accountingFrom)))
    || (accountingTo && !Number.isFinite(Date.parse(accountingTo)))
  ) {
    return null;
  }

  if (accountingFrom && accountingTo && Date.parse(accountingTo) <= Date.parse(accountingFrom)) {
    return null;
  }

  return {
    accountingFrom,
    accountingTo
  };
};

const normalizeInput = (input: MoneyLedgerTransactionInput): MoneyLedgerTransactionInput => ({
  transactionType: input.transactionType,
  moneyMode: input.moneyMode,
  sourceKind: input.sourceKind,
  sourceProvider: input.sourceProvider,
  postingStatus: input.postingStatus,
  occurredAt: input.occurredAt,
  accountingAt: input.accountingAt,
  correctsTransactionId: normalizeNullableText(input.correctsTransactionId, 36),
  correctionReason: normalizeNullableText(input.correctionReason, 500),
  notesPrivate: normalizeNullableText(input.notesPrivate, 2_000),
  lines: input.lines.map((line) => ({
    lineKind: line.lineKind,
    direction: line.direction,
    amountMinor: Math.trunc(line.amountMinor),
    currency: normalizeCurrency(line.currency),
    valueSource: line.valueSource,
    isEstimate: line.isEstimate,
    categoryKey: normalizeNullableText(line.categoryKey, 80),
    projectId: normalizeNullableText(line.projectId, 36),
    projectItemId: normalizeNullableText(line.projectItemId, 36),
    receiptReference: line.receiptReference
      ? {
        referenceType: line.receiptReference.referenceType,
        storageKind: line.receiptReference.storageKind,
        label: line.receiptReference.label.trim().slice(0, 191),
        privateReference: line.receiptReference.privateReference.trim().slice(0, 1_024)
      }
      : null,
    notesPrivate: normalizeNullableText(line.notesPrivate, 2_000)
  }))
});

const csvHeaders = [
  "transaction_id",
  "line_id",
  "transaction_type",
  "money_mode",
  "posting_status",
  "source_kind",
  "source_provider",
  "occurred_at",
  "accounting_at",
  "line_kind",
  "direction",
  "amount_minor",
  "amount_major",
  "currency",
  "value_source",
  "is_estimate",
  "category_key",
  "project_id",
  "project_item_id",
  "receipt_reference_type",
  "receipt_storage_kind",
  "receipt_label",
  "receipt_private_reference",
  "corrects_transaction_id",
  "correction_reason",
  "transaction_notes_private",
  "line_notes_private",
  "created_at",
  "updated_at"
] as const;

const csvEscape = (value: string | number | boolean | null): string => {
  if (value === null) {
    return "";
  }

  const text = String(value);

  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

const formatAmountMajor = (amountMinor: number): string =>
  (amountMinor / 100).toFixed(2);

const getReportPeriod = (transactions: readonly MoneyLedgerTransaction[]): {
  periodStart: string;
  periodEnd: string;
} => {
  const accountingTimes = transactions.map((transaction) => Date.parse(transaction.accountingAt))
    .filter(Number.isFinite);

  if (accountingTimes.length === 0) {
    const now = new Date();
    const later = new Date(now.getTime() + 1_000);

    return {
      periodStart: now.toISOString(),
      periodEnd: later.toISOString()
    };
  }

  const periodStart = new Date(Math.min(...accountingTimes));
  const latest = Math.max(...accountingTimes);
  const periodEnd = new Date(latest + 1_000);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  };
};

const buildLedgerCsv = (transactions: readonly MoneyLedgerTransaction[]): {
  csv: string;
  lineCount: number;
} => {
  const rows = [csvHeaders.join(",")];
  let lineCount = 0;

  for (const transaction of transactions) {
    for (const line of transaction.lines) {
      lineCount += 1;
      rows.push([
        transaction.id,
        line.id,
        transaction.transactionType,
        transaction.moneyMode,
        transaction.postingStatus,
        transaction.sourceKind,
        transaction.sourceProvider,
        transaction.occurredAt,
        transaction.accountingAt,
        line.lineKind,
        line.direction,
        line.amountMinor,
        formatAmountMajor(line.amountMinor),
        line.currency,
        line.valueSource,
        line.isEstimate,
        line.categoryKey,
        line.projectId,
        line.projectItemId,
        line.receiptReference?.referenceType ?? null,
        line.receiptReference?.storageKind ?? null,
        line.receiptReference?.label ?? null,
        line.receiptReference?.privateReference ?? null,
        transaction.correctsTransactionId,
        transaction.correctionReason,
        transaction.notesPrivate,
        line.notesPrivate,
        transaction.createdAt,
        transaction.updatedAt
      ].map(csvEscape).join(","));
    }
  }

  return {
    csv: `${rows.join("\n")}\n`,
    lineCount
  };
};

const warningCsvHeaders = [
  "warning_id",
  "warning_kind",
  "severity",
  "target_kind",
  "target_id",
  "message"
] as const;

const buildWarningCsv = (warnings: readonly MoneyAccountingWarning[]): string => {
  const rows = [warningCsvHeaders.join(",")];

  for (const warning of warnings) {
    rows.push([
      warning.id,
      warning.warningKind,
      warning.severity,
      warning.targetKind,
      warning.targetId,
      warning.message
    ].map(csvEscape).join(","));
  }

  return `${rows.join("\n")}\n`;
};

const warningId = (
  warningKind: MoneyAccountingWarningKind,
  targetId: string
): string =>
  `derived:${warningKind}:${targetId}`;

const lineNeedsReceipt = (line: MoneyLedgerLine): boolean =>
  line.direction === "out"
  && ["cost", "provider_fee", "payout_fee", "transaction_cost", "platform_split"].includes(line.lineKind);

const buildAccountingWarnings = (
  transactions: readonly MoneyLedgerTransaction[]
): readonly MoneyAccountingWarning[] => {
  const warnings: MoneyAccountingWarning[] = [];

  for (const transaction of transactions) {
    if (transaction.postingStatus === "voided") {
      continue;
    }

    for (const line of transaction.lines) {
      if (line.direction !== "neutral" && !line.categoryKey) {
        warnings.push({
          id: warningId("missing_category", line.id),
          targetKind: "line",
          targetId: line.id,
          warningKind: "missing_category",
          severity: "warning",
          status: "open",
          message: "Ledger line has no category, which makes reporting harder."
        });
      }

      if (transaction.moneyMode === "real" && lineNeedsReceipt(line) && !line.receiptReference) {
        warnings.push({
          id: warningId("missing_receipt", line.id),
          targetKind: "line",
          targetId: line.id,
          warningKind: "missing_receipt",
          severity: "warning",
          status: "open",
          message: "Real outgoing money line has no receipt, invoice, statement, or private reference."
        });
      }

      if (transaction.moneyMode === "real" && transaction.postingStatus === "posted" && line.isEstimate) {
        warnings.push({
          id: warningId("estimate_unconfirmed", line.id),
          targetKind: "line",
          targetId: line.id,
          warningKind: "estimate_unconfirmed",
          severity: "info",
          status: "open",
          message: "Posted real ledger line is still marked as an estimate."
        });
      }
    }
  }

  return warnings;
};

const countWarningsByKind = (
  warnings: readonly MoneyAccountingWarning[]
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const warning of warnings) {
    counts[warning.warningKind] = (counts[warning.warningKind] ?? 0) + 1;
  }

  return counts;
};

const warningKey = (warning: Pick<MoneyAccountingWarning, "targetKind" | "targetId" | "warningKind">): string =>
  `${warning.targetKind}:${warning.targetId}:${warning.warningKind}`;

const getWarningTargetIds = (
  transactions: readonly MoneyLedgerTransaction[]
): readonly string[] => {
  const targetIds = new Set<string>();

  for (const transaction of transactions) {
    targetIds.add(transaction.id);
    for (const line of transaction.lines) {
      targetIds.add(line.id);
    }
  }

  return [...targetIds];
};

const filterResolvedWarnings = (
  warnings: readonly MoneyAccountingWarning[],
  resolvedWarnings: readonly Pick<MoneyAccountingWarning, "targetKind" | "targetId" | "warningKind">[]
): readonly MoneyAccountingWarning[] => {
  const resolvedKeys = new Set(resolvedWarnings.map(warningKey));

  return warnings.filter((warning) => !resolvedKeys.has(warningKey(warning)));
};

const addLineToBucket = (
  buckets: Map<string, MoneyAdminReportBucket>,
  key: string,
  line: MoneyLedgerLine
): void => {
  const bucket = buckets.get(key) ?? {
    key,
    inMinor: 0,
    outMinor: 0,
    neutralMinor: 0,
    lineCount: 0
  };

  if (line.direction === "in") {
    bucket.inMinor += line.amountMinor;
  } else if (line.direction === "out") {
    bucket.outMinor += line.amountMinor;
  } else {
    bucket.neutralMinor += line.amountMinor;
  }

  bucket.lineCount += 1;
  buckets.set(key, bucket);
};

const sortBuckets = (buckets: Map<string, MoneyAdminReportBucket>): readonly MoneyAdminReportBucket[] =>
  [...buckets.values()].sort((left, right) =>
    (right.inMinor + right.outMinor + right.neutralMinor) - (left.inMinor + left.outMinor + left.neutralMinor)
    || left.key.localeCompare(right.key)
  );

const getReceiptUploadId = (privateReference: string): string | null => {
  const match = /^money-upload:([a-f0-9-]{36}):/u.exec(privateReference);

  return match?.[1] ?? null;
};

const buildReceiptIndex = (
  transactions: readonly MoneyLedgerTransaction[]
): MoneyAdminReviewPackagePayload["receiptIndex"] =>
  transactions.flatMap((transaction) =>
    transaction.lines.flatMap((line) =>
      line.receiptReference
        ? [{
          transactionId: transaction.id,
          lineId: line.id,
          referenceType: line.receiptReference.referenceType,
          storageKind: line.receiptReference.storageKind,
          label: line.receiptReference.label,
          privateReference: line.receiptReference.privateReference,
          uploadId: getReceiptUploadId(line.receiptReference.privateReference)
        }]
        : []
    )
  );

const buildAccountingSummary = (input: {
  transactions: readonly MoneyLedgerTransaction[];
  warnings: readonly MoneyAccountingWarning[];
  filters: MoneyAdminLedgerFilters;
  generatedAt: string;
}) => {
  const warningCounts = countWarningsByKind(input.warnings);
  const period = getReportPeriod(input.transactions);
  const byTransactionType = new Map<string, MoneyAdminReportBucket>();
  const byMoneyMode = new Map<string, MoneyAdminReportBucket>();
  const byCategory = new Map<string, MoneyAdminReportBucket>();
  const bySourceProvider = new Map<string, MoneyAdminReportBucket>();
  let lineCount = 0;
  let realInMinor = 0;
  let realOutMinor = 0;
  let allInMinor = 0;
  let allOutMinor = 0;
  let realPostedTransactions = 0;
  let draftTransactions = 0;
  let voidedTransactions = 0;

  for (const transaction of input.transactions) {
    if (transaction.postingStatus === "voided") {
      voidedTransactions += 1;
    } else if (transaction.postingStatus === "draft") {
      draftTransactions += 1;
    } else if (transaction.moneyMode === "real") {
      realPostedTransactions += 1;
    }

    for (const line of transaction.lines) {
      lineCount += 1;
      addLineToBucket(byTransactionType, transaction.transactionType, line);
      addLineToBucket(byMoneyMode, transaction.moneyMode, line);
      addLineToBucket(byCategory, line.categoryKey ?? "uncategorized", line);
      addLineToBucket(bySourceProvider, transaction.sourceProvider ?? "none", line);

      if (line.direction === "in") {
        allInMinor += line.amountMinor;
        if (transaction.moneyMode === "real" && transaction.postingStatus !== "voided") {
          realInMinor += line.amountMinor;
        }
      } else if (line.direction === "out") {
        allOutMinor += line.amountMinor;
        if (transaction.moneyMode === "real" && transaction.postingStatus !== "voided") {
          realOutMinor += line.amountMinor;
        }
      }
    }
  }

  return {
    generatedAt: input.generatedAt,
    period: {
      accountingFrom: input.filters.accountingFrom,
      accountingTo: input.filters.accountingTo,
      effectiveStart: period.periodStart,
      effectiveEnd: period.periodEnd
    },
    counts: {
      transactions: input.transactions.length,
      lines: lineCount,
      warnings: input.warnings.length,
      realPostedTransactions,
      draftTransactions,
      voidedTransactions
    },
    totals: {
      realInMinor,
      realOutMinor,
      realRemainderMinor: realInMinor - realOutMinor,
      allInMinor,
      allOutMinor,
      allRemainderMinor: allInMinor - allOutMinor
    },
    warningCounts,
    byTransactionType: sortBuckets(byTransactionType),
    byMoneyMode: sortBuckets(byMoneyMode),
    byCategory: sortBuckets(byCategory),
    bySourceProvider: sortBuckets(bySourceProvider)
  };
};

export class MoneyAdminService {
  public constructor(private readonly repository: MoneyAdminRepository) {}

  public async listTransactions(input: {
    authUserId: string;
    filters?: Partial<MoneyAdminLedgerFilters>;
  }): Promise<MoneyAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const filters = normalizeLedgerFilters(input.filters);

    if (!filters) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const transactions = await this.repository.listTransactions(filters);
    const resolvedWarnings = await this.repository.listResolvedWarnings(getWarningTargetIds(transactions));

    return {
      ok: true,
      transactions,
      warnings: filterResolvedWarnings(buildAccountingWarnings(transactions), resolvedWarnings)
    };
  }

  public async exportLedgerCsv(input: {
    authUserId: string;
    filters?: Partial<MoneyAdminLedgerFilters>;
  }): Promise<MoneyAdminExportResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const filters = normalizeLedgerFilters(input.filters);

    if (!filters) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const transactions = await this.repository.listTransactions(filters);
    const generatedAt = new Date().toISOString();
    const resolvedWarnings = await this.repository.listResolvedWarnings(getWarningTargetIds(transactions));
    const warnings = filterResolvedWarnings(buildAccountingWarnings(transactions), resolvedWarnings);
    const { csv, lineCount } = buildLedgerCsv(transactions);
    const checksum = createHash("sha256").update(csv).digest("hex");
    const filename = `maiks-money-ledger-${generatedAt.slice(0, 10)}.csv`;
    const period = getReportPeriod(transactions);

    await this.repository.recordReportExport({
      reportKind: "tax_review_export",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      filters: {
        export: "manual-ledger-csv",
        transactionLimit: 100,
        accountingFrom: filters.accountingFrom,
        accountingTo: filters.accountingTo
      },
      warningCounts: countWarningsByKind(warnings),
      fileKind: "csv",
      fileReference: filename,
      fileChecksum: checksum,
      generatedByUserId: actor.domainUserId
    });

    return {
      ok: true,
      export: {
        filename,
        contentType: "text/csv; charset=utf-8",
        csv,
        transactionCount: transactions.length,
        lineCount,
        generatedAt
      }
    };
  }

  public async buildJsonReport(input: {
    authUserId: string;
    filters?: Partial<MoneyAdminLedgerFilters>;
  }): Promise<MoneyAdminJsonReportResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const filters = normalizeLedgerFilters(input.filters);

    if (!filters) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const transactions = await this.repository.listTransactions(filters);
    const generatedAt = new Date().toISOString();
    const resolvedWarnings = await this.repository.listResolvedWarnings(getWarningTargetIds(transactions));
    const warnings = filterResolvedWarnings(buildAccountingWarnings(transactions), resolvedWarnings);
    const period = getReportPeriod(transactions);
    const report = buildAccountingSummary({
      transactions,
      warnings,
      filters,
      generatedAt
    });

    await this.repository.recordReportExport({
      reportKind: "accounting_summary",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      filters: {
        export: "manual-accounting-json-summary",
        transactionLimit: 100,
        accountingFrom: filters.accountingFrom,
        accountingTo: filters.accountingTo
      },
      warningCounts: report.warningCounts,
      fileKind: "none",
      fileReference: null,
      fileChecksum: null,
      generatedByUserId: actor.domainUserId
    });

    return {
      ok: true,
      report
    };
  }

  public async exportWarningsCsv(input: {
    authUserId: string;
    filters?: Partial<MoneyAdminLedgerFilters>;
  }): Promise<MoneyAdminWarningExportResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const filters = normalizeLedgerFilters(input.filters);

    if (!filters) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const transactions = await this.repository.listTransactions(filters);
    const generatedAt = new Date().toISOString();
    const resolvedWarnings = await this.repository.listResolvedWarnings(getWarningTargetIds(transactions));
    const warnings = filterResolvedWarnings(buildAccountingWarnings(transactions), resolvedWarnings);
    const csv = buildWarningCsv(warnings);
    const checksum = createHash("sha256").update(csv).digest("hex");
    const filename = `maiks-money-warnings-${generatedAt.slice(0, 10)}.csv`;
    const period = getReportPeriod(transactions);

    await this.repository.recordReportExport({
      reportKind: "warning_review",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      filters: {
        export: "manual-warning-review-csv",
        transactionLimit: 100,
        accountingFrom: filters.accountingFrom,
        accountingTo: filters.accountingTo
      },
      warningCounts: countWarningsByKind(warnings),
      fileKind: "csv",
      fileReference: filename,
      fileChecksum: checksum,
      generatedByUserId: actor.domainUserId
    });

    return {
      ok: true,
      export: {
        filename,
        contentType: "text/csv; charset=utf-8",
        csv,
        warningCount: warnings.length,
        generatedAt
      }
    };
  }

  public async exportReviewPackageJson(input: {
    authUserId: string;
    filters?: Partial<MoneyAdminLedgerFilters>;
  }): Promise<MoneyAdminReviewPackageExportResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const filters = normalizeLedgerFilters(input.filters);

    if (!filters) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const transactions = await this.repository.listTransactions(filters);
    const generatedAt = new Date().toISOString();
    const resolvedWarnings = await this.repository.listResolvedWarnings(getWarningTargetIds(transactions));
    const warnings = filterResolvedWarnings(buildAccountingWarnings(transactions), resolvedWarnings);
    const { csv: ledgerCsv, lineCount } = buildLedgerCsv(transactions);
    const warningsCsv = buildWarningCsv(warnings);
    const receiptIndex = buildReceiptIndex(transactions);
    const summary = buildAccountingSummary({
      transactions,
      warnings,
      filters,
      generatedAt
    });
    const payload: MoneyAdminReviewPackagePayload = {
      manifest: {
        generatedAt,
        accountingFrom: filters.accountingFrom,
        accountingTo: filters.accountingTo,
        transactionCount: transactions.length,
        lineCount,
        warningCount: warnings.length,
        receiptReferenceCount: receiptIndex.length,
        includes: [
          "summary",
          "ledgerCsv",
          "warningsCsv",
          "receiptIndex"
        ],
        note: "Private accounting review aid only. This is not official tax advice or an official filing."
      },
      summary,
      ledgerCsv,
      warningsCsv,
      receiptIndex
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    const checksum = createHash("sha256").update(json).digest("hex");
    const filename = `maiks-money-review-package-${generatedAt.slice(0, 10)}.json`;
    const period = getReportPeriod(transactions);

    await this.repository.recordReportExport({
      reportKind: "tax_review_export",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      filters: {
        export: "manual-accounting-review-package-json",
        transactionLimit: 100,
        accountingFrom: filters.accountingFrom,
        accountingTo: filters.accountingTo
      },
      warningCounts: summary.warningCounts,
      fileKind: "none",
      fileReference: filename,
      fileChecksum: checksum,
      generatedByUserId: actor.domainUserId
    });

    return {
      ok: true,
      export: {
        filename,
        contentType: "application/json; charset=utf-8",
        json,
        generatedAt,
        transactionCount: transactions.length,
        lineCount,
        warningCount: warnings.length,
        receiptReferenceCount: receiptIndex.length
      }
    };
  }

  public async uploadReceiptEvidence(input: {
    authUserId: string;
    filename: string;
    contentType: string;
    dataBase64: string;
    label?: string | null;
  }): Promise<MoneyAdminReceiptUploadResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const contentType = input.contentType.trim().toLowerCase();

    if (!allowedReceiptContentTypes.has(contentType) || input.dataBase64.trim().length === 0) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const bytes = Buffer.from(input.dataBase64, "base64");
    const normalizedBase64 = bytes.toString("base64").replace(/=+$/u, "");
    const providedBase64 = input.dataBase64.trim().replace(/=+$/u, "");

    if (bytes.length === 0 || bytes.length > receiptUploadMaxBytes || normalizedBase64 !== providedBase64) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const id = randomUUID();
    const filename = normalizeReceiptFilename(input.filename);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const uploadedAt = new Date().toISOString();
    const metadata: ReceiptUploadMetadata = {
      id,
      filename,
      contentType,
      sizeBytes: bytes.length,
      checksum,
      uploadedAt,
      uploadedByUserId: actor.domainUserId
    };
    const paths = getReceiptUploadPaths(id);

    await mkdir(receiptUploadStorageDir, { recursive: true, mode: 0o700 });
    await writeFile(paths.filePath, bytes, { mode: 0o600 });
    await writeFile(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });

    return {
      ok: true,
      upload: {
        id,
        filename,
        contentType,
        sizeBytes: bytes.length,
        checksum,
        reference: {
          referenceType: "receipt",
          storageKind: "future_upload",
          label: normalizeNullableText(input.label, 191) ?? filename,
          privateReference: `money-upload:${id}:${filename}`
        }
      }
    };
  }

  public async downloadReceiptEvidence(input: {
    authUserId: string;
    uploadId: string;
  }): Promise<MoneyAdminReceiptDownloadResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (!/^[a-f0-9-]{36}$/u.test(input.uploadId)) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const paths = getReceiptUploadPaths(input.uploadId);

    try {
      const [metadataRaw, bytes] = await Promise.all([
        readFile(paths.metadataPath, "utf8"),
        readFile(paths.filePath)
      ]);
      const parsed = parseReceiptUploadMetadata(JSON.parse(metadataRaw) as unknown);

      if (!parsed || parsed.id !== input.uploadId || parsed.sizeBytes !== bytes.length) {
        return {
          ok: false,
          reason: "money_admin_not_found"
        };
      }

      return {
        ok: true,
        download: {
          filename: parsed.filename,
          contentType: parsed.contentType,
          sizeBytes: parsed.sizeBytes,
          bytes
        }
      };
    } catch {
      return {
        ok: false,
        reason: "money_admin_not_found"
      };
    }
  }

  public async createTransaction(input: {
    authUserId: string;
    transaction: MoneyLedgerTransactionInput;
  }): Promise<MoneyAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const transaction = normalizeInput(input.transaction);

    if (!isValidMoneyLedgerTransactionInput(transaction)) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    if (transaction.transactionType === "correction") {
      const correctedTransaction = await this.repository.getTransaction(transaction.correctsTransactionId ?? "");

      if (!correctedTransaction) {
        return {
          ok: false,
          reason: "money_admin_not_found"
        };
      }
    }

    return {
      ok: true,
      transaction: await this.repository.createTransaction({
        ...transaction,
        actorUserId: actor.domainUserId
      })
    };
  }

  public async previewImportCsv(input: {
    authUserId: string;
    csv: string;
    filename?: string | null;
  }): Promise<MoneyAdminImportPreviewResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (input.csv.trim().length === 0 || input.csv.length > 200_000) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const preview = buildMoneyImportPreview({
      csv: input.csv,
      filename: input.filename ?? null
    });

    if (!preview) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    return {
      ok: true,
      preview
    };
  }

  public async resolveWarning(input: {
    authUserId: string;
    targetKind: MoneyAccountingWarning["targetKind"];
    targetId: string;
    warningKind: MoneyAccountingWarning["warningKind"];
  }): Promise<MoneyAdminWarningResolveResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const targetId = normalizeNullableText(input.targetId, 36);

    if (!targetId) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    await this.repository.resolveWarning({
      targetKind: input.targetKind,
      targetId,
      warningKind: input.warningKind,
      actorUserId: actor.domainUserId
    });

    return {
      ok: true
    };
  }

  public async voidTransaction(input: {
    authUserId: string;
    id: string;
    reason: string;
  }): Promise<MoneyAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const id = normalizeNullableText(input.id, 36);
    const reason = normalizeNullableText(input.reason, 500);

    if (!id || !reason) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    const transaction = await this.repository.voidTransaction({
      id,
      reason,
      actorUserId: actor.domainUserId
    });

    if (!transaction) {
      return {
        ok: false,
        reason: "money_admin_not_found"
      };
    }

    return {
      ok: true,
      transaction
    };
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true; domainUserId: string }
    | { ok: false; reason: "money_admin_user_unlinked" | "money_admin_forbidden" }
  > {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "money_admin_user_unlinked"
      };
    }

    if (!canManageMoneyLedger(normalizeMoneyPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "money_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}
