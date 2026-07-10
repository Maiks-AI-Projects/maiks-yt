import { moneyProviders } from "@maiks-yt/domain";
import type {
  MoneyDirection,
  MoneyLedgerLineKind,
  MoneyLedgerTransactionInput,
  MoneyProvider,
  MoneyTransactionType
} from "@maiks-yt/domain";

import type {
  MoneyAdminImportPreview,
  MoneyAdminImportPreviewRow
} from "./money-admin.types.js";

const maxPreviewRows = 200;

const providerSet = new Set<string>(moneyProviders);

const headerAliases = {
  occurredAt: ["occurred_at", "occurred", "date", "datetime", "created_at", "paid_at", "transaction_date"],
  accountingAt: ["accounting_at", "booked_at", "settled_at", "available_at"],
  description: ["description", "memo", "note", "notes", "details", "title"],
  amount: ["amount", "amount_major", "value", "total", "gross", "net"],
  currency: ["currency", "currency_code"],
  direction: ["direction", "type", "kind", "debit_credit"],
  categoryKey: ["category", "category_key", "account", "label"],
  sourceProvider: ["provider", "source_provider", "source", "platform"],
  reference: ["reference", "id", "transaction_id", "payment_id", "payout_id"]
} as const;

type HeaderKey = keyof typeof headerAliases;

type ParsedCsv = {
  headers: readonly string[];
  rows: readonly string[][];
};

const normalizeHeader = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");

const normalizeText = (value: string | null | undefined, maxLength: number): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
};

const parseCsv = (csv: string): ParsedCsv | null => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    return null;
  }

  row.push(current);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }

  if (rows.length < 2) {
    return null;
  }

  const headers = rows[0];

  if (!headers) {
    return null;
  }

  const bodyRows = rows.slice(1);

  return {
    headers,
    rows: bodyRows.slice(0, maxPreviewRows)
  };
};

const findColumnIndex = (headers: readonly string[], key: HeaderKey): number | null => {
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const alias of headerAliases[key]) {
    const index = normalizedHeaders.indexOf(alias);

    if (index >= 0) {
      return index;
    }
  }

  return null;
};

const cell = (
  row: readonly string[],
  indexes: ReadonlyMap<HeaderKey, number | null>,
  key: HeaderKey
): string | undefined => {
  const index = indexes.get(key);

  return typeof index === "number" ? row[index] : undefined;
};

const parseDateValue = (value: string | undefined): string | null => {
  const text = normalizeText(value, 80);

  if (!text) {
    return null;
  }

  const timestamp = Date.parse(text);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const parseAmount = (value: string | undefined): number | null => {
  const text = normalizeText(value, 80);

  if (!text) {
    return null;
  }

  const cleaned = text
    .replace(/[^\d,.-]/gu, "")
    .replace(/,(?=\d{1,2}$)/u, ".")
    .replace(/,/gu, "");

  if (!/^-?\d+(\.\d{1,2})?$/u.test(cleaned)) {
    return null;
  }

  const amount = Number(cleaned);

  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  return Math.round(Math.abs(amount) * 100);
};

const inferDirection = (amountRaw: string | undefined, directionRaw: string | undefined): MoneyDirection | null => {
  const directionText = normalizeText(directionRaw, 40)?.toLowerCase() ?? "";

  if (["in", "income", "credit", "deposit", "received", "gross"].includes(directionText)) {
    return "in";
  }

  if (["out", "cost", "fee", "debit", "withdrawal", "spent", "paid", "payout"].includes(directionText)) {
    return "out";
  }

  const amountText = normalizeText(amountRaw, 80);

  if (amountText?.includes("-")) {
    return "out";
  }

  return amountText ? "in" : null;
};

const normalizeProvider = (value: string | undefined): MoneyProvider | null => {
  const text = normalizeText(value, 40)?.toLowerCase().replace(/[^a-z0-9]+/gu, "") ?? "";

  if (!text) {
    return null;
  }

  const mapped = text === "ko-fi" || text === "ko_fi" || text === "kofi"
    ? "kofi"
    : text;

  return providerSet.has(mapped) ? mapped as MoneyProvider : null;
};

const normalizeCurrency = (value: string | undefined): string | null => {
  const text = normalizeText(value, 10)?.toUpperCase().replace(/[^A-Z]/gu, "") ?? "";

  return text.length === 3 ? text : null;
};

export const buildMoneyImportPreview = (input: {
  csv: string;
  existingReferences?: ReadonlyMap<string, string>;
  filename?: string | null;
  generatedAt?: string;
}): MoneyAdminImportPreview | null => {
  const parsed = parseCsv(input.csv);

  if (!parsed) {
    return null;
  }

  const indexes = new Map<HeaderKey, number | null>(
    (Object.keys(headerAliases) as HeaderKey[]).map((key) => [key, findColumnIndex(parsed.headers, key)])
  );
  const rows: MoneyAdminImportPreviewRow[] = parsed.rows.map((row, index) => {
    const warnings: string[] = [];
    const amountRaw = cell(row, indexes, "amount");
    const amountMinor = parseAmount(amountRaw);
    const direction = inferDirection(amountRaw, cell(row, indexes, "direction"));
    const occurredAt = parseDateValue(cell(row, indexes, "occurredAt"));
    const accountingAt = parseDateValue(cell(row, indexes, "accountingAt")) ?? occurredAt;
    const explicitCurrency = normalizeCurrency(cell(row, indexes, "currency"));
    const sourceProvider = normalizeProvider(cell(row, indexes, "sourceProvider"));
    const categoryKey = normalizeText(cell(row, indexes, "categoryKey"), 80);
    const reference = normalizeText(cell(row, indexes, "reference"), 191);
    const duplicateTransactionId = reference
      ? input.existingReferences?.get(reference) ?? null
      : null;

    if (amountMinor === null) {
      warnings.push("amount_missing_or_invalid");
    }

    if (!direction) {
      warnings.push("direction_missing_or_invalid");
    }

    if (!occurredAt) {
      warnings.push("occurred_at_missing_or_invalid");
    }

    if (!explicitCurrency) {
      warnings.push("currency_missing_default_eur");
    }

    if (!sourceProvider && normalizeText(cell(row, indexes, "sourceProvider"), 40)) {
      warnings.push("provider_unknown");
    }

    if (!categoryKey) {
      warnings.push("category_missing");
    }

    if (duplicateTransactionId) {
      warnings.push("duplicate_reference");
    }

    const status = amountMinor === null || !direction || duplicateTransactionId
      ? "skipped"
      : warnings.length > 0
        ? "warning"
        : "ready";

    return {
      rowNumber: index + 2,
      status,
      occurredAt,
      accountingAt,
      description: normalizeText(cell(row, indexes, "description"), 280),
      amountMinor,
      currency: explicitCurrency ?? "EUR",
      direction,
      sourceProvider,
      categoryKey,
      reference,
      duplicateTransactionId,
      warnings
    };
  });

  const importableRows = rows.filter((row) => row.status !== "skipped");
  const currencies = [...new Set(importableRows.map((row) => row.currency).filter((value): value is string => Boolean(value)))].sort();

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    filename: normalizeText(input.filename ?? null, 191),
    rowCount: rows.length,
    rows,
    summary: {
      readyRows: rows.filter((row) => row.status === "ready").length,
      warningRows: rows.filter((row) => row.status === "warning").length,
      skippedRows: rows.filter((row) => row.status === "skipped").length,
      totalInMinor: importableRows
        .filter((row) => row.direction === "in")
        .reduce((total, row) => total + (row.amountMinor ?? 0), 0),
      totalOutMinor: importableRows
        .filter((row) => row.direction === "out")
        .reduce((total, row) => total + (row.amountMinor ?? 0), 0),
      currencies
    },
    notes: [
      "Preview only. No ledger rows, warnings, receipts, provider payouts, or audit records were created.",
      parsed.rows.length >= maxPreviewRows ? `Only the first ${maxPreviewRows} CSV rows are previewed.` : "All CSV rows are previewed."
    ]
  };
};

const inferDraftKinds = (row: MoneyAdminImportPreviewRow): {
  transactionType: MoneyTransactionType;
  lineKind: MoneyLedgerLineKind;
} => {
  const text = `${row.categoryKey ?? ""} ${row.description ?? ""}`.toLowerCase();

  if (row.direction === "in") {
    return {
      transactionType: "income",
      lineKind: "gross_income"
    };
  }

  if (text.includes("payout")) {
    return {
      transactionType: "payout",
      lineKind: "payout"
    };
  }

  if (text.includes("fee") || text.includes("kosten") || text.includes("transaction cost")) {
    return {
      transactionType: "fee",
      lineKind: "transaction_cost"
    };
  }

  return {
    transactionType: "cost",
    lineKind: "cost"
  };
};

export const buildMoneyImportDraftInputs = (preview: MoneyAdminImportPreview): {
  transactions: readonly MoneyLedgerTransactionInput[];
  importedRowNumbers: readonly number[];
  skippedRowNumbers: readonly number[];
} => {
  const transactions: MoneyLedgerTransactionInput[] = [];
  const importedRowNumbers: number[] = [];
  const skippedRowNumbers: number[] = [];

  for (const row of preview.rows) {
    if (
      row.status === "skipped"
      || row.amountMinor === null
      || row.direction === null
      || row.occurredAt === null
      || row.accountingAt === null
      || row.currency === null
    ) {
      skippedRowNumbers.push(row.rowNumber);
      continue;
    }

    const kinds = inferDraftKinds(row);
    const noteParts = [
      "Imported as draft from CSV preview.",
      row.description ? `Description: ${row.description}` : null,
      row.reference ? `Reference: ${row.reference}` : null,
      row.warnings.length > 0 ? `Preview warnings: ${row.warnings.join(", ")}` : null
    ].filter((part): part is string => part !== null);

    importedRowNumbers.push(row.rowNumber);
    transactions.push({
      transactionType: kinds.transactionType,
      moneyMode: "real",
      sourceKind: row.sourceProvider && row.sourceProvider !== "manual" ? "provider_intake" : "manual",
      sourceProvider: row.sourceProvider ?? "manual",
      postingStatus: "draft",
      occurredAt: row.occurredAt,
      accountingAt: row.accountingAt,
      correctsTransactionId: null,
      correctionReason: null,
      notesPrivate: noteParts.join("\n").slice(0, 2_000),
      lines: [
        {
          lineKind: kinds.lineKind,
          direction: row.direction,
          amountMinor: row.amountMinor,
          currency: row.currency,
          valueSource: "eur",
          isEstimate: false,
          categoryKey: row.categoryKey,
          projectId: null,
          projectItemId: null,
          receiptReference: row.reference
            ? {
              referenceType: "provider_statement",
              storageKind: "local_reference",
              label: `${row.sourceProvider ?? "CSV"} row ${row.rowNumber}`.slice(0, 191),
              privateReference: row.reference
            }
            : null,
          notesPrivate: row.description
        }
      ]
    });
  }

  return {
    transactions,
    importedRowNumbers,
    skippedRowNumbers
  };
};
