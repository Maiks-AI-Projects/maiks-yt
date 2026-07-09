import { createHash } from "node:crypto";

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
  MoneyAdminLedgerFilters,
  MoneyAdminListResult,
  MoneyAdminMutationResult,
  MoneyAdminRepository
} from "./money-admin.types.js";

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

    return {
      ok: true,
      transactions,
      warnings: buildAccountingWarnings(transactions)
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
    const warnings = buildAccountingWarnings(transactions);
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
