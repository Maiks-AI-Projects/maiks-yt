"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiChevronDown,
  FiDownload,
  FiFileText,
  FiLink,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX
} from "react-icons/fi";
import type {
  MoneyAccountingWarning,
  MoneyDirection,
  MoneyLedgerLine,
  MoneyLedgerLineKind,
  MoneyLedgerTransaction,
  MoneyMode,
  MoneyPostingStatus,
  MoneyProvider,
  MoneyReceiptReferenceType,
  MoneyReceiptStorageKind,
  MoneyRuleVersion,
  MoneyTransactionType,
  MoneyValueSource
} from "@maiks-yt/domain";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { MoneyDatedRulesPanel } from "./money-dated-rules-panel";
import type { MoneyRuleFormState, MoneyRuleImpactPreview } from "./money-dated-rules-panel";
import styles from "./money-admin.module.css";

type MoneyLedgerResponse =
  | {
    ok: true;
    transactions: readonly MoneyLedgerTransaction[];
    warnings: readonly MoneyAccountingWarning[];
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyRuleResponse =
  | {
    ok: true;
    rules: readonly MoneyRuleVersion[];
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyRuleMutationResponse =
  | {
    ok: true;
    rule: MoneyRuleVersion;
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyRuleImpactResponse =
  | {
    ok: true;
    preview: MoneyRuleImpactPreview;
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyRuleImpactDraftResponse =
  | {
    ok: true;
    preview: MoneyRuleImpactPreview;
    transactions: readonly MoneyLedgerTransaction[];
    createdSuggestionKeys: readonly string[];
    skippedSuggestionKeys: readonly string[];
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyMutationResponse =
  | {
    ok: true;
    transaction: MoneyLedgerTransaction;
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyOkResponse =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyReceiptUploadResponse =
  | {
    ok: true;
    upload: {
      id: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      checksum: string;
      reference: {
        referenceType: MoneyReceiptReferenceType;
        storageKind: MoneyReceiptStorageKind;
        label: string;
        privateReference: string;
      };
    };
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyImportPreviewRow = {
  rowNumber: number;
  status: "ready" | "warning" | "skipped";
  occurredAt: string | null;
  accountingAt: string | null;
  description: string | null;
  amountMinor: number | null;
  currency: string | null;
  direction: MoneyDirection | null;
  sourceProvider: MoneyProvider | null;
  categoryKey: string | null;
  reference: string | null;
  duplicateTransactionId: string | null;
  possibleDuplicateTransactionId: string | null;
  warnings: readonly string[];
};

type MoneyImportPreview = {
  generatedAt: string;
  filename: string | null;
  rowCount: number;
  rows: readonly MoneyImportPreviewRow[];
  summary: {
    readyRows: number;
    warningRows: number;
    skippedRows: number;
    totalInMinor: number;
    totalOutMinor: number;
    currencies: readonly string[];
  };
  notes: readonly string[];
};

type MoneyImportPreviewResponse =
  | {
    ok: true;
    preview: MoneyImportPreview;
  }
  | {
    ok: false;
    reason: string;
  };

type MoneyImportDraftResponse =
  | {
    ok: true;
    preview: MoneyImportPreview;
    transactions: readonly MoneyLedgerTransaction[];
    importedRowNumbers: readonly number[];
    skippedRowNumbers: readonly number[];
  }
  | {
    ok: false;
    reason: string;
  };

type ImportPreviewStatusFilter = "all" | MoneyImportPreviewRow["status"];

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type MoneySection = "ledger" | "add-entry" | "warnings" | "dated-rules" | "import";

type LedgerRow = {
  key: string;
  transaction: MoneyLedgerTransaction;
  line: MoneyLedgerLine;
  warnings: readonly MoneyAccountingWarning[];
};

type MoneyFormState = {
  transactionType: MoneyTransactionType;
  moneyMode: MoneyMode;
  postingStatus: MoneyPostingStatus;
  occurredAt: string;
  accountingAt: string;
  lineKind: MoneyLedgerLineKind;
  direction: MoneyDirection;
  amountMajor: string;
  currency: string;
  valueSource: MoneyValueSource;
  isEstimate: boolean;
  categoryKey: string;
  receiptReferenceType: MoneyReceiptReferenceType;
  receiptStorageKind: MoneyReceiptStorageKind;
  receiptLabel: string;
  receiptPrivateReference: string;
  correctsTransactionId: string;
  correctionReason: string;
  notesPrivate: string;
};

type MoneyFilterState = {
  accountingFrom: string;
  accountingTo: string;
  postingStatus: MoneyPostingStatus | "";
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const nowLocalInputValue = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const defaultForm = (): MoneyFormState => ({
  transactionType: "income",
  moneyMode: "real",
  postingStatus: "draft",
  occurredAt: nowLocalInputValue(),
  accountingAt: nowLocalInputValue(),
  lineKind: "gross_income",
  direction: "in",
  amountMajor: "",
  currency: "EUR",
  valueSource: "eur",
  isEstimate: false,
  categoryKey: "manual",
  receiptReferenceType: "receipt",
  receiptStorageKind: "external_url",
  receiptLabel: "",
  receiptPrivateReference: "",
  correctsTransactionId: "",
  correctionReason: "",
  notesPrivate: ""
});

const defaultRuleForm = (): MoneyRuleFormState => ({
  ruleKind: "platform_fee",
  provider: "kofi",
  valueSource: "eur",
  appliesToDateBasis: "event_date",
  effectiveFrom: nowLocalInputValue(),
  effectiveUntil: "",
  percentagePercent: "",
  fixedAmountMajor: "",
  fixedCurrency: "EUR",
  changeReason: ""
});

const toDateInputValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const currentMonthFilters = (): MoneyFilterState => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    accountingFrom: toDateInputValue(start),
    accountingTo: toDateInputValue(end),
    postingStatus: ""
  };
};

const entryPresets = [
  {
    label: "Income",
    transactionType: "income",
    lineKind: "gross_income",
    direction: "in",
    categoryKey: "manual-income"
  },
  {
    label: "Spending",
    transactionType: "cost",
    lineKind: "cost",
    direction: "out",
    categoryKey: "manual-cost"
  },
  {
    label: "Fee",
    transactionType: "fee",
    lineKind: "transaction_cost",
    direction: "out",
    categoryKey: "manual-fee"
  },
  {
    label: "Payout",
    transactionType: "payout",
    lineKind: "payout",
    direction: "out",
    categoryKey: "manual-payout"
  }
] satisfies Array<{
  label: string;
  transactionType: MoneyTransactionType;
  lineKind: MoneyLedgerLineKind;
  direction: MoneyDirection;
  categoryKey: string;
}>;

const transactionTypeLabels: Record<MoneyTransactionType, string> = {
  income: "Income",
  fee: "Fee",
  payout: "Payout",
  cost: "Cost",
  allocation: "Allocation",
  refund: "Refund",
  reversal: "Reversal",
  dispute: "Dispute",
  conversion: "Conversion",
  correction: "Correction",
  report_adjustment: "Report adjustment"
};

const lineKindOptions: readonly MoneyLedgerLineKind[] = [
  "gross_income",
  "provider_fee",
  "payout_fee",
  "transaction_cost",
  "platform_split",
  "streamer_share_estimate",
  "cost",
  "payout",
  "allocation",
  "refund",
  "chargeback",
  "reversal",
  "currency_conversion",
  "correction_delta"
];

const importPreviewExample = [
  "date,description,amount,currency,direction,category,provider,reference",
  "2026-07-10,Ko-fi support payout,25.00,EUR,in,support,kofi,kofi-001",
  "2026-07-10,Payment provider fee,-2.50,EUR,out,provider-fee,kofi,kofi-fee-001",
  "2026-07-10,Hosting bill,-12.99,EUR,out,hosting,manual,invoice-001"
].join("\n");

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const formatDateOnly = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));

const formatLabel = (value: string): string =>
  value.replaceAll("_", " ");

const formatAmount = (amountMinor: number, currency: string | null): string =>
  currency
    ? new Intl.NumberFormat(undefined, {
      style: "currency",
      currency
    }).format(amountMinor / 100)
    : `${amountMinor} units`;

const parseAmountMinor = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
};

const toIsoFromLocalInput = (value: string): string =>
  new Date(value).toISOString();

const toIsoFromDateInput = (value: string, inclusiveEnd = false): string | null => {
  if (!value) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");

  if (!yearText || !monthText || !dayText) {
    return null;
  }

  const localDate = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));

  if (inclusiveEnd) {
    localDate.setDate(localDate.getDate() + 1);
  }

  return localDate.toISOString();
};

const readFileAsBase64 = async (file: File): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",", 2)[1];

      if (base64) {
        resolve(base64);
      } else {
        reject(new Error("Could not read receipt file."));
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read receipt file.")));
    reader.readAsDataURL(file);
  });

const getReceiptUploadId = (privateReference: string): string | null => {
  const match = /^money-upload:([a-f0-9-]{36}):/u.exec(privateReference);

  return match?.[1] ?? null;
};

const inferReceiptContentType = (file: File): string => {
  if (file.type) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerName.endsWith(".csv")) {
    return "text/csv";
  }

  if (lowerName.endsWith(".txt")) {
    return "text/plain";
  }

  return "application/octet-stream";
};

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing the private money ledger.";
  }

  if (response.status === 403 || reason === "money_admin_forbidden") {
    return "Your account does not have money ledger permission.";
  }

  if (reason === "money_admin_invalid_input") {
    return "The money entry has invalid or missing fields.";
  }

  if (reason === "money_admin_not_found") {
    return "That money entry could not be found.";
  }

  return `Money ledger request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "money_admin_forbidden" || reason === "money_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const MoneyAdminClient = (): React.ReactNode => {
  const [transactions, setTransactions] = useState<readonly MoneyLedgerTransaction[]>([]);
  const [warnings, setWarnings] = useState<readonly MoneyAccountingWarning[]>([]);
  const [rules, setRules] = useState<readonly MoneyRuleVersion[]>([]);
  const [ruleImpactPreview, setRuleImpactPreview] = useState<MoneyRuleImpactPreview | null>(null);
  const [filters, setFilters] = useState<MoneyFilterState>(() => currentMonthFilters());
  const [filterDraft, setFilterDraft] = useState<MoneyFilterState>(() => currentMonthFilters());
  const [modeFilter, setModeFilter] = useState<MoneyMode | "">("real");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<MoneySection>("ledger");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [form, setForm] = useState<MoneyFormState>(() => defaultForm());
  const [ruleForm, setRuleForm] = useState<MoneyRuleFormState>(() => defaultRuleForm());
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading private money ledger...");
  const [busy, setBusy] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<MoneyImportPreview | null>(null);
  const [importPreviewStatusFilter, setImportPreviewStatusFilter] = useState<ImportPreviewStatusFilter>("all");
  const [importPreviewRowLimit, setImportPreviewRowLimit] = useState(25);
  const [importMessage, setImportMessage] = useState("Paste a provider CSV to preview it without writing ledger rows.");

  const totals = useMemo(() => {
    const realLines = transactions.flatMap((transaction) =>
      transaction.moneyMode === "real" && transaction.postingStatus !== "voided" ? transaction.lines : []
    );
    const incomeMinor = realLines
      .filter((line) => line.direction === "in")
      .reduce((total, line) => total + line.amountMinor, 0);
    const outMinor = realLines
      .filter((line) => line.direction === "out")
      .reduce((total, line) => total + line.amountMinor, 0);

    return {
      incomeMinor,
      outMinor,
      remainderMinor: incomeMinor - outMinor
    };
  }, [transactions]);

  const ledgerRows = useMemo<readonly LedgerRow[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.flatMap((transaction) =>
      transaction.lines
        .map((line): LedgerRow => ({
          key: `${transaction.id}:${line.id}`,
          transaction,
          line,
          warnings: warnings.filter((warning) =>
            (warning.targetKind === "transaction" && warning.targetId === transaction.id)
            || (warning.targetKind === "line" && warning.targetId === line.id)
          )
        }))
        .filter(({ transaction, line }) => {
          if (modeFilter && transaction.moneyMode !== modeFilter) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            transaction.id,
            transaction.transactionType,
            transaction.sourceProvider,
            transaction.notesPrivate,
            line.id,
            line.lineKind,
            line.categoryKey,
            line.receiptReference?.label,
            line.receiptReference?.privateReference,
            line.ruleVersionId,
            line.notesPrivate
          ].some((value) => value?.toLowerCase().includes(query));
        })
    );
  }, [modeFilter, searchQuery, transactions, warnings]);

  const selectedRow = useMemo<LedgerRow | null>(() =>
    ledgerRows.find((row) => row.key === selectedRowKey) ?? ledgerRows[0] ?? null,
  [ledgerRows, selectedRowKey]);

  const ledgerCounts = useMemo(() => ({
    draft: transactions.filter((transaction) => transaction.postingStatus === "draft").length,
    posted: transactions.filter((transaction) => transaction.postingStatus === "posted").length,
    voided: transactions.filter((transaction) => transaction.postingStatus === "voided").length
  }), [transactions]);

  const warningSummary = useMemo(() => ({
    missingReceipt: warnings.filter((warning) => warning.warningKind === "missing_receipt").length,
    estimateUnconfirmed: warnings.filter((warning) => warning.warningKind === "estimate_unconfirmed").length,
    other: warnings.filter((warning) => warning.warningKind !== "missing_receipt" && warning.warningKind !== "estimate_unconfirmed").length
  }), [warnings]);

  const filteredImportPreviewRows = useMemo(() => {
    if (!importPreview) {
      return [];
    }

    return importPreview.rows.filter((row) =>
      importPreviewStatusFilter === "all" || row.status === importPreviewStatusFilter
    );
  }, [importPreview, importPreviewStatusFilter]);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const buildLedgerQuery = useCallback((): string => {
    const params = new URLSearchParams();
    const accountingFrom = toIsoFromDateInput(filters.accountingFrom);
    const accountingTo = toIsoFromDateInput(filters.accountingTo, true);

    if (accountingFrom) {
      params.set("accountingFrom", accountingFrom);
    }

    if (accountingTo) {
      params.set("accountingTo", accountingTo);
    }

    if (filters.postingStatus) {
      params.set("postingStatus", filters.postingStatus);
    }

    const query = params.toString();

    return query ? `?${query}` : "";
  }, [filters.accountingFrom, filters.accountingTo, filters.postingStatus]);

  const loadRules = useCallback(async (): Promise<void> => {
    const [rulesResponse, impactResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/admin/money/rules`, {
        headers: createApiHeaders(),
        credentials: "include"
      }),
      fetch(`${apiBaseUrl}/admin/money/rule-impact${buildLedgerQuery()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      })
    ]);
    const rulesPayload = await parseJson<MoneyRuleResponse>(rulesResponse);
    const impactPayload = await parseJson<MoneyRuleImpactResponse>(impactResponse);

    if (rulesResponse.ok && rulesPayload?.ok && impactResponse.ok && impactPayload?.ok) {
      setRules(rulesPayload.rules);
      setRuleImpactPreview(impactPayload.preview);
      return;
    }

    const reason = rulesPayload?.ok === false
      ? rulesPayload.reason
      : impactPayload?.ok === false
        ? impactPayload.reason
        : undefined;
    throw new Error(getFailureMessage(rulesResponse.ok ? impactResponse : rulesResponse, reason));
  }, [buildLedgerQuery]);

  const loadLedger = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading private money ledger...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/ledger${buildLedgerQuery()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<MoneyLedgerResponse>(response);

      if (response.ok && payload?.ok) {
        setTransactions(payload.transactions);
        setWarnings(payload.warnings);
        await loadRules();
        setLoadState("ready");
        setMessage(payload.transactions.length === 0 ? "No private money entries yet." : "Private money ledger loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setWarnings([]);
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setWarnings([]);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Money ledger request failed.");
    }
  }, [buildLedgerQuery, loadRules]);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadLedger();
  }, [loadLedger]);

  const applyEntryPreset = (preset: typeof entryPresets[number]): void => {
    setForm((current) => ({
      ...current,
      transactionType: preset.transactionType,
      lineKind: preset.lineKind,
      direction: preset.direction,
      categoryKey: preset.categoryKey,
      valueSource: "eur",
      currency: current.currency || "EUR",
      isEstimate: false,
      correctsTransactionId: "",
      correctionReason: ""
    }));
    setMessage(`${preset.label} preset applied.`);
  };

  const createTransaction = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const amountMinor = parseAmountMinor(form.amountMajor);

    if (amountMinor === null) {
      setMessage("Use a positive amount with up to two decimals.");
      return;
    }

    if (form.transactionType === "correction" && (!form.correctsTransactionId || !form.correctionReason.trim())) {
      setMessage("Correction entries need a target entry and a reason.");
      return;
    }

    setBusy(true);
    setMessage("Saving private money entry...");

    const receiptLabel = form.receiptLabel.trim();
    const receiptPrivateReference = form.receiptPrivateReference.trim();
    const receiptReference = receiptLabel || receiptPrivateReference
      ? {
        referenceType: form.receiptReferenceType,
        storageKind: form.receiptStorageKind,
        label: receiptLabel || "Private reference",
        privateReference: receiptPrivateReference || receiptLabel
      }
      : null;

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/transactions`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          transactionType: form.transactionType,
          moneyMode: form.moneyMode,
          sourceKind: form.transactionType === "correction" ? "correction" : "manual",
          sourceProvider: form.transactionType === "correction" ? null : "manual",
          postingStatus: form.postingStatus,
          occurredAt: toIsoFromLocalInput(form.occurredAt),
          accountingAt: toIsoFromLocalInput(form.accountingAt),
          correctsTransactionId: form.transactionType === "correction" ? form.correctsTransactionId : null,
          correctionReason: form.transactionType === "correction" ? form.correctionReason.trim() : null,
          notesPrivate: form.notesPrivate.trim() || null,
          lines: [
            {
              lineKind: form.lineKind,
              direction: form.direction,
              amountMinor,
              currency: form.valueSource === "eur" ? form.currency.trim().toUpperCase() : null,
              valueSource: form.valueSource,
              isEstimate: form.isEstimate,
              categoryKey: form.categoryKey.trim() || null,
              projectId: null,
              projectItemId: null,
              receiptReference,
              notesPrivate: form.notesPrivate.trim() || null
            }
          ]
        })
      });
      const payload = await parseJson<MoneyMutationResponse>(response);

      if (response.ok && payload?.ok) {
        await loadLedger();
        setForm(defaultForm());
        setActiveSection("ledger");
        setMessage("Private money entry saved.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money ledger save failed.");
    } finally {
      setBusy(false);
    }
  };

  const uploadReceiptFile = async (file: File | null): Promise<void> => {
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Receipt uploads are limited to 5 MB.");
      return;
    }

    setReceiptUploading(true);
    setMessage("Uploading private receipt evidence...");

    try {
      const dataBase64 = await readFileAsBase64(file);
      const response = await fetch(`${apiBaseUrl}/admin/money/receipts/upload`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          contentType: inferReceiptContentType(file),
          dataBase64,
          label: form.receiptLabel.trim() || file.name
        })
      });
      const payload = await parseJson<MoneyReceiptUploadResponse>(response);

      if (response.ok && payload?.ok) {
        setForm((current) => ({
          ...current,
          receiptReferenceType: payload.upload.reference.referenceType,
          receiptStorageKind: payload.upload.reference.storageKind,
          receiptLabel: payload.upload.reference.label,
          receiptPrivateReference: payload.upload.reference.privateReference
        }));
        setMessage(`Private receipt uploaded: ${payload.upload.filename}. Save the entry to attach it.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Receipt upload failed.");
    } finally {
      setReceiptUploading(false);
    }
  };

  const exportLedgerCsv = async (): Promise<void> => {
    setBusy(true);
    setMessage("Preparing private money CSV export...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/ledger.csv${buildLedgerQuery()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        const payload = await parseJson<{ ok: false; reason?: string }>(response);
        setMessage(getFailureMessage(response, payload?.reason));
        return;
      }

      const csv = await response.text();
      const filename = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? "maiks-money-ledger.csv";
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Private money CSV export downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money CSV export failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportSummaryJson = async (): Promise<void> => {
    setBusy(true);
    setMessage("Preparing private money summary report...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/report.json${buildLedgerQuery()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        const payload = await parseJson<{ ok: false; reason?: string }>(response);
        setMessage(getFailureMessage(response, payload?.reason));
        return;
      }

      const report = await response.text();
      const filename = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? "maiks-money-summary.json";
      const url = URL.createObjectURL(new Blob([report], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Private money summary report downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money summary report failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportReviewPackageJson = async (): Promise<void> => {
    setBusy(true);
    setMessage("Preparing private accounting review package...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/review-package.json${buildLedgerQuery()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        const payload = await parseJson<{ ok: false; reason?: string }>(response);
        setMessage(getFailureMessage(response, payload?.reason));
        return;
      }

      const report = await response.text();
      const filename = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? "maiks-money-review-package.json";
      const url = URL.createObjectURL(new Blob([report], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Private accounting review package downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money review package export failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportWarningsCsv = async (): Promise<void> => {
    setBusy(true);
    setMessage("Preparing accounting warnings CSV export...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/warnings.csv${buildLedgerQuery()}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        const payload = await parseJson<{ ok: false; reason?: string }>(response);
        setMessage(getFailureMessage(response, payload?.reason));
        return;
      }

      const csv = await response.text();
      const filename = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? "maiks-money-warnings.csv";
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Accounting warnings CSV export downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money warnings CSV export failed.");
    } finally {
      setBusy(false);
    }
  };

  const previewImportCsv = async (): Promise<void> => {
    if (!importCsvText.trim()) {
      setImportMessage("Paste CSV text before previewing.");
      return;
    }

    setBusy(true);
    setImportMessage("Previewing CSV import...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/import-preview`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          filename: "manual-preview.csv",
          csv: importCsvText
        })
      });
      const payload = await parseJson<MoneyImportPreviewResponse>(response);

      if (response.ok && payload?.ok) {
        setImportPreview(payload.preview);
        setImportPreviewStatusFilter("all");
        setImportPreviewRowLimit(25);
        setImportMessage(`Preview ready: ${payload.preview.summary.readyRows} ready, ${payload.preview.summary.warningRows} with warnings, ${payload.preview.summary.skippedRows} skipped.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setImportPreview(null);
      setImportMessage(getFailureMessage(response, reason));
    } catch (error) {
      setImportPreview(null);
      setImportMessage(error instanceof Error ? error.message : "Money import preview failed.");
    } finally {
      setBusy(false);
    }
  };

  const importDraftEntries = async (): Promise<void> => {
    if (!importCsvText.trim()) {
      setImportMessage("Paste and preview CSV text before creating draft entries.");
      return;
    }

    if (!importPreview) {
      setImportMessage("Preview the CSV before creating draft entries.");
      return;
    }

    const importableRows = importPreview.rows.filter((row) =>
      row.status !== "skipped"
      && row.amountMinor !== null
      && row.direction !== null
      && row.occurredAt !== null
      && row.accountingAt !== null
      && row.currency !== null
    );

    if (importableRows.length === 0) {
      setImportMessage("No preview rows have enough data to create draft entries.");
      return;
    }

    if (!window.confirm(`Create ${importableRows.length} draft ledger entr${importableRows.length === 1 ? "y" : "ies"} from this preview? They will stay draft until you review them.`)) {
      return;
    }

    setBusy(true);
    setImportMessage("Creating draft ledger entries...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/import-drafts`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          filename: "manual-preview.csv",
          csv: importCsvText
        })
      });
      const payload = await parseJson<MoneyImportDraftResponse>(response);

      if (response.ok && payload?.ok) {
        setImportPreview(payload.preview);
        setImportPreviewStatusFilter("all");
        setImportPreviewRowLimit(25);
        await loadLedger();
        setImportMessage(`Created ${payload.transactions.length} draft entr${payload.transactions.length === 1 ? "y" : "ies"} from rows ${payload.importedRowNumbers.join(", ")}${payload.skippedRowNumbers.length > 0 ? `; skipped rows ${payload.skippedRowNumbers.join(", ")}` : ""}.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setImportMessage(getFailureMessage(response, reason));
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Money draft import failed.");
    } finally {
      setBusy(false);
    }
  };

  const createRuleVersion = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const percentageBps = ruleForm.percentagePercent.trim()
      ? Math.round(Number(ruleForm.percentagePercent.trim().replace(",", ".")) * 100)
      : null;
    const fixedAmountMinor = ruleForm.fixedAmountMajor.trim()
      ? parseAmountMinor(ruleForm.fixedAmountMajor)
      : null;

    if (percentageBps !== null && (!Number.isFinite(percentageBps) || percentageBps < 0 || percentageBps > 10_000)) {
      setMessage("Rule percentage must be between 0 and 100.");
      return;
    }

    if (ruleForm.fixedAmountMajor.trim() && fixedAmountMinor === null) {
      setMessage("Rule fixed amount must use up to two decimals.");
      return;
    }

    if (!ruleForm.changeReason.trim()) {
      setMessage("Rule changes need a reason.");
      return;
    }

    setBusy(true);
    setMessage("Saving dated money rule...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/rules`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          ruleKind: ruleForm.ruleKind,
          provider: ruleForm.provider || null,
          valueSource: ruleForm.valueSource || null,
          appliesToDateBasis: ruleForm.appliesToDateBasis,
          effectiveFrom: toIsoFromLocalInput(ruleForm.effectiveFrom),
          effectiveUntil: ruleForm.effectiveUntil ? toIsoFromLocalInput(ruleForm.effectiveUntil) : null,
          percentageBps,
          fixedAmountMinor,
          fixedCurrency: fixedAmountMinor === null ? null : ruleForm.fixedCurrency.trim().toUpperCase(),
          rulePayload: null,
          changeReason: ruleForm.changeReason.trim(),
          supersedesRuleId: null
        })
      });
      const payload = await parseJson<MoneyRuleMutationResponse>(response);

      if (response.ok && payload?.ok) {
        await loadRules();
        setRuleForm(defaultRuleForm());
        setMessage("Dated money rule saved.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money rule save failed.");
    } finally {
      setBusy(false);
    }
  };

  const createRuleImpactDrafts = async (): Promise<void> => {
    if (!ruleImpactPreview || ruleImpactPreview.suggestions.length === 0) {
      setMessage("No rule impact suggestions are available for the current filter.");
      return;
    }

    if (!window.confirm(`Create draft entries for ${ruleImpactPreview.suggestions.length} rule-impact suggestion${ruleImpactPreview.suggestions.length === 1 ? "" : "s"}? They will stay draft until you review them.`)) {
      return;
    }

    setBusy(true);
    setMessage("Creating draft entries from rule impact preview...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/rule-impact-drafts${buildLedgerQuery()}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<MoneyRuleImpactDraftResponse>(response);

      if (response.ok && payload?.ok) {
        setRuleImpactPreview(payload.preview);
        await loadLedger();
        setMessage(`Created ${payload.transactions.length} draft entr${payload.transactions.length === 1 ? "y" : "ies"} from rule impact preview${payload.skippedSuggestionKeys.length > 0 ? `; skipped ${payload.skippedSuggestionKeys.length} already-created suggestion${payload.skippedSuggestionKeys.length === 1 ? "" : "s"}` : ""}.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rule impact draft creation failed.");
    } finally {
      setBusy(false);
    }
  };

  const voidTransaction = async (transaction: MoneyLedgerTransaction): Promise<void> => {
    const reason = window.prompt("Why should this private money entry be voided?");

    if (!reason?.trim()) {
      return;
    }

    setBusy(true);
    setMessage("Voiding private money entry...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/transactions/${transaction.id}/void`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          reason: reason.trim()
        })
      });
      const payload = await parseJson<MoneyMutationResponse>(response);

      if (response.ok && payload?.ok) {
        await loadLedger();
        setMessage("Private money entry voided.");
        return;
      }

      const failureReason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, failureReason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money entry void failed.");
    } finally {
      setBusy(false);
    }
  };

  const resolveWarning = async (warning: MoneyAccountingWarning): Promise<void> => {
    setBusy(true);
    setMessage("Resolving accounting warning...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/warnings/resolve`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          targetKind: warning.targetKind,
          targetId: warning.targetId,
          warningKind: warning.warningKind
        })
      });
      const payload = await parseJson<MoneyOkResponse>(response);

      if (response.ok && payload?.ok) {
        await loadLedger();
        setMessage("Accounting warning marked resolved.");
        return;
      }

      const failureReason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, failureReason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money warning resolution failed.");
    } finally {
      setBusy(false);
    }
  };

  const downloadReceiptFile = async (uploadId: string): Promise<void> => {
    setBusy(true);
    setMessage("Opening private receipt evidence...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/receipts/${uploadId}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        const payload = await parseJson<{ ok: false; reason?: string }>(response);
        setMessage(getFailureMessage(response, payload?.reason));
        return;
      }

      const blob = await response.blob();
      const filename = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? "receipt-evidence";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Private receipt evidence downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Receipt download failed.");
    } finally {
      setBusy(false);
    }
  };

  const postDraftTransaction = async (transaction: MoneyLedgerTransaction): Promise<void> => {
    if (transaction.postingStatus !== "draft") {
      setMessage("Only draft private money entries can be posted.");
      return;
    }

    const note = window.prompt("Optional review note before posting this draft entry:", "Reviewed for testing.");

    if (note === null) {
      return;
    }

    if (!window.confirm("Post this draft entry? It will stay reversible through the void action, but it will count as posted in private reports.")) {
      return;
    }

    setBusy(true);
    setMessage("Posting private money draft...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/transactions/${transaction.id}/post`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          note: note.trim() || null
        })
      });
      const payload = await parseJson<MoneyMutationResponse>(response);

      if (response.ok && payload?.ok) {
        await loadLedger();
        setMessage("Private money draft posted.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Money draft post failed.");
    } finally {
      setBusy(false);
    }
  };

  const startCorrection = (transaction: MoneyLedgerTransaction): void => {
    setForm((current) => ({
      ...current,
      transactionType: "correction",
      moneyMode: transaction.moneyMode,
      postingStatus: "draft",
      occurredAt: nowLocalInputValue(),
      accountingAt: nowLocalInputValue(),
      lineKind: "correction_delta",
      direction: "out",
      amountMajor: "",
      currency: "EUR",
      valueSource: "eur",
      isEstimate: false,
      categoryKey: "correction",
      correctsTransactionId: transaction.id,
      correctionReason: `Correction for ${transactionTypeLabels[transaction.transactionType]} from ${formatDate(transaction.accountingAt)}`,
      notesPrivate: current.notesPrivate
    }));
    setActiveSection("add-entry");
    setMessage("Correction draft started. Enter the delta amount and save it.");
  };

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Private Admin</p>
          <h1>Money Ledger</h1>
          <p>Every cent in and out, with dated rules and evidence.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            aria-label="Refresh private money ledger"
            className={styles.iconButton}
            type="button"
            onClick={() => void loadLedger()}
            disabled={loadState === "loading"}
            title="Refresh ledger"
          >
            <FiRefreshCw aria-hidden="true" />
          </button>
          <details className={styles.exportMenu}>
            <summary>
              <FiDownload aria-hidden="true" />
              Exports
              <FiChevronDown aria-hidden="true" />
            </summary>
            <div className={styles.exportMenuItems}>
              <button type="button" onClick={() => void exportReviewPackageJson()} disabled={busy || loadState !== "ready"}>
                Review package <span>JSON</span>
              </button>
              <button type="button" onClick={() => void exportSummaryJson()} disabled={busy || loadState !== "ready"}>
                Accounting summary <span>JSON</span>
              </button>
              <button type="button" onClick={() => void exportWarningsCsv()} disabled={busy || loadState !== "ready"}>
                Warning review <span>CSV</span>
              </button>
              <button type="button" onClick={() => void exportLedgerCsv()} disabled={busy || loadState !== "ready"}>
                Ledger rows <span>CSV</span>
              </button>
            </div>
          </details>
          <button type="button" onClick={() => setActiveSection("add-entry")} disabled={loadState !== "ready"}>
            <FiPlus aria-hidden="true" />
            Add entry
          </button>
          <small className={styles.exportHint}>Package · Summary · Warnings · Ledger CSV</small>
        </div>
      </header>

      <p className={styles.status} data-state={loadState} aria-live="polite">{message}</p>

      {loadState === "ready" ? (
        <>
          <nav className={styles.tabs} aria-label="Money ledger sections">
            <button type="button" data-active={activeSection === "ledger"} onClick={() => setActiveSection("ledger")}>Ledger</button>
            <button type="button" data-active={activeSection === "add-entry"} onClick={() => setActiveSection("add-entry")}>Add entry</button>
            <button type="button" data-active={activeSection === "warnings"} onClick={() => setActiveSection("warnings")}>
              Warnings {warnings.length > 0 ? <span>{warnings.length}</span> : null}
            </button>
            <button type="button" data-active={activeSection === "dated-rules"} onClick={() => setActiveSection("dated-rules")}>Dated rules</button>
            <button type="button" data-active={activeSection === "import"} onClick={() => setActiveSection("import")}>Import CSV</button>
          </nav>

          <section className={styles.warningBanner} data-clear={warnings.length === 0}>
            <FiAlertTriangle aria-hidden="true" />
            <strong>{warnings.length === 0 ? "No open accounting warnings" : warnings.length + " accounting warning" + (warnings.length === 1 ? "" : "s") + " need review"}</strong>
            {warnings.length > 0 ? (
              <span>
                {warningSummary.missingReceipt} missing receipt {warningSummary.missingReceipt === 1 ? "reference" : "references"}
                {" · "}
                {warningSummary.estimateUnconfirmed} unconfirmed {warningSummary.estimateUnconfirmed === 1 ? "estimate" : "estimates"}
                {warningSummary.other > 0 ? " · " + warningSummary.other + " other" : ""}
              </span>
            ) : null}
            {warnings.length > 0 ? (
              <button type="button" onClick={() => setActiveSection("warnings")}>Review warnings</button>
            ) : null}
          </section>

          {activeSection === "ledger" ? (
            <section className={styles.ledgerSection}>
              <form
                className={styles.filters}
                onSubmit={(event) => {
                  event.preventDefault();
                  setFilters(filterDraft);
                }}
              >
                <label>
                  From
                  <input
                    type="date"
                    value={filterDraft.accountingFrom}
                    onChange={(event) => setFilterDraft((current) => ({ ...current, accountingFrom: event.target.value }))}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={filterDraft.accountingTo}
                    onChange={(event) => setFilterDraft((current) => ({ ...current, accountingTo: event.target.value }))}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={filterDraft.postingStatus}
                    onChange={(event) => setFilterDraft((current) => ({
                      ...current,
                      postingStatus: event.target.value as MoneyFilterState["postingStatus"]
                    }))}
                  >
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="posted">Posted</option>
                    <option value="voided">Voided</option>
                  </select>
                </label>
                <label>
                  Mode
                  <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as MoneyMode | "")}>
                    <option value="">All modes</option>
                    <option value="real">Real</option>
                    <option value="provider_sandbox">Provider sandbox</option>
                    <option value="simulated">Simulated</option>
                    <option value="test">Test</option>
                  </select>
                </label>
                <label className={styles.searchField}>
                  <span className={styles.srOnly}>Search ledger</span>
                  <FiSearch aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search entry, category, evidence..."
                  />
                </label>
                <button type="submit">Apply</button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    const cleared = { accountingFrom: "", accountingTo: "", postingStatus: "" } satisfies MoneyFilterState;
                    setFilterDraft(cleared);
                    setFilters(cleared);
                    setModeFilter("");
                    setSearchQuery("");
                  }}
                >
                  Clear <FiX aria-hidden="true" />
                </button>
              </form>

              <div className={styles.summary} aria-label="Accounting period summary">
                <div><span>Recorded income</span><strong>{formatAmount(totals.incomeMinor, "EUR")}</strong></div>
                <div><span>Costs & fees</span><strong className={styles.outAmount}>{formatAmount(totals.outMinor, "EUR")}</strong></div>
                <div><span>Bookkeeping remainder</span><strong>{formatAmount(totals.remainderMinor, "EUR")}</strong></div>
                <div><span>Open warnings</span><strong className={warnings.length > 0 ? styles.warningAmount : undefined}>{warnings.length}</strong></div>
              </div>

              <div className={styles.workspace}>
                <div className={styles.ledgerPane}>
                  <div className={styles.taxCaution}>
                    <span aria-hidden="true">i</span>
                    <strong>Remainder is not spendable profit.</strong>
                    Tax is not calculated here.
                  </div>
                  <div className={styles.tablePanel}>
                  <div className={styles.tableScroller}>
                    <table className={styles.ledgerTable}>
                      <thead>
                        <tr>
                          <th>Accounting date</th>
                          <th>Type / line</th>
                          <th>Mode & status</th>
                          <th>Category / evidence</th>
                          <th>In</th>
                          <th>Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerRows.map((row) => {
                          const hasWarning = row.warnings.length > 0;
                          const evidence = row.line.receiptReference;

                          return (
                            <tr
                              key={row.key}
                              data-selected={selectedRow?.key === row.key}
                              data-voided={row.transaction.postingStatus === "voided"}
                              onClick={() => setSelectedRowKey(row.key)}
                            >
                              <td>
                                <button type="button" className={styles.rowSelect} onClick={() => setSelectedRowKey(row.key)}>
                                  {formatDateOnly(row.transaction.accountingAt)}
                                </button>
                              </td>
                              <td>
                                <strong>{transactionTypeLabels[row.transaction.transactionType]}</strong>
                                <span> · {formatLabel(row.line.lineKind)}</span>
                                {row.transaction.correctsTransactionId ? <FiLink aria-label="Correction entry" /> : null}
                              </td>
                              <td>
                                <span>{formatLabel(row.transaction.moneyMode)}</span>
                                <span className={styles.statusChip} data-status={row.transaction.postingStatus}>
                                  {formatLabel(row.transaction.postingStatus)}
                                </span>
                              </td>
                              <td>
                                <div className={styles.evidenceCell}>
                                  {hasWarning ? <FiAlertTriangle aria-label="Open warning" /> : <FiFileText aria-hidden="true" />}
                                  <span>{row.line.categoryKey ?? "Uncategorized"}</span>
                                  <span> · {evidence?.label ?? (hasWarning ? "Missing receipt" : "No reference")}</span>
                                </div>
                                {row.line.ruleVersionId ? <small>Rule {row.line.ruleVersionId}</small> : null}
                              </td>
                              <td className={styles.inAmount}>{row.line.direction === "in" ? formatAmount(row.line.amountMinor, row.line.currency) : "—"}</td>
                              <td className={styles.outAmount}>{row.line.direction === "out" ? formatAmount(row.line.amountMinor, row.line.currency) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {ledgerRows.length === 0 ? <p className={styles.emptyState}>No ledger lines match these filters.</p> : null}
                    <footer className={styles.tableFooter}>
                      <span>{transactions.length} entries · {ledgerCounts.draft} draft · {ledgerCounts.posted} posted{ledgerCounts.voided > 0 ? " · " + ledgerCounts.voided + " voided" : ""}</span>
                      <strong className={styles.inAmount}>{formatAmount(totals.incomeMinor, "EUR")}</strong>
                      <strong className={styles.outAmount}>{formatAmount(totals.outMinor, "EUR")}</strong>
                      <strong>{formatAmount(totals.remainderMinor, "EUR")}</strong>
                    </footer>
                  </div>
                </div>

                <aside className={styles.detailsPanel}>
                  {selectedRow ? (
                    <>
                      <div className={styles.detailsHeading}>
                        <h2>Entry details</h2>
                        <div>
                          <span className={styles.modeChip}>{formatLabel(selectedRow.transaction.moneyMode)}</span>
                          <span className={styles.statusChip} data-status={selectedRow.transaction.postingStatus}>{formatLabel(selectedRow.transaction.postingStatus)}</span>
                        </div>
                      </div>
                      <dl className={styles.detailsList}>
                        <div><dt>Accounting date</dt><dd>{formatDateOnly(selectedRow.transaction.accountingAt)}</dd></div>
                        <div><dt>Occurred</dt><dd>{formatDateOnly(selectedRow.transaction.occurredAt)}</dd></div>
                        <div><dt>Type</dt><dd>{transactionTypeLabels[selectedRow.transaction.transactionType]}</dd></div>
                        <div><dt>Line kind</dt><dd>{formatLabel(selectedRow.line.lineKind)}</dd></div>
                        <div><dt>Direction</dt><dd>{formatLabel(selectedRow.line.direction)}</dd></div>
                        <div><dt>Amount</dt><dd className={selectedRow.line.direction === "out" ? styles.outAmount : styles.inAmount}>{formatAmount(selectedRow.line.amountMinor, selectedRow.line.currency)}</dd></div>
                        <div><dt>Currency</dt><dd>{selectedRow.line.currency ?? "Value units"}</dd></div>
                        <div><dt>Category</dt><dd>{selectedRow.line.categoryKey ?? "Not set"}</dd></div>
                        <div><dt>Estimate</dt><dd>{selectedRow.line.isEstimate ? "Yes" : "No"}</dd></div>
                        <div>
                          <dt>Rule evidence</dt>
                          <dd>{selectedRow.line.ruleVersionId ? <><code>{selectedRow.line.ruleVersionId}</code> <FiLink aria-hidden="true" /></> : "None"}</dd>
                        </div>
                        <div>
                          <dt>Receipt</dt>
                          <dd className={!selectedRow.line.receiptReference ? styles.outAmount : undefined}>
                            {selectedRow.line.receiptReference?.label ?? "No receipt reference"}
                          </dd>
                        </div>
                        <div><dt>Private notes</dt><dd>{selectedRow.line.notesPrivate ?? selectedRow.transaction.notesPrivate ?? "None"}</dd></div>
                      </dl>

                      {selectedRow.line.receiptReference && getReceiptUploadId(selectedRow.line.receiptReference.privateReference) ? (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => {
                            const uploadId = getReceiptUploadId(selectedRow.line.receiptReference?.privateReference ?? "");
                            if (uploadId) {
                              void downloadReceiptFile(uploadId);
                            }
                          }}
                          disabled={busy}
                        >
                          <FiFileText aria-hidden="true" /> Open evidence file
                        </button>
                      ) : null}

                      {selectedRow.warnings.map((warning) => (
                        <div className={styles.detailWarning} key={warning.id}>
                          <FiAlertTriangle aria-hidden="true" />
                          <span>{warning.message}</span>
                          <button type="button" onClick={() => void resolveWarning(warning)} disabled={busy}>Mark resolved</button>
                        </div>
                      ))}

                      {selectedRow.transaction.postingStatus !== "voided" ? (
                        <div className={styles.detailActions}>
                          {selectedRow.transaction.postingStatus === "draft" ? (
                            <button type="button" onClick={() => void postDraftTransaction(selectedRow.transaction)} disabled={busy}>Post draft</button>
                          ) : null}
                          <button type="button" className="secondary-action" onClick={() => startCorrection(selectedRow.transaction)} disabled={busy}>
                            <FiLink aria-hidden="true" /> Correct entry
                          </button>
                          <button type="button" className={styles.voidButton} onClick={() => void voidTransaction(selectedRow.transaction)} disabled={busy}>
                            Void entry
                          </button>
                        </div>
                      ) : null}
                      <p className={styles.safetyNote}>Posting changes bookkeeping status only. It does not move money.</p>
                    </>
                  ) : (
                    <p className={styles.emptyState}>Select a ledger line to inspect its evidence and actions.</p>
                  )}
                </aside>
              </div>
            </section>
          ) : null}

          {activeSection === "add-entry" ? (
            <section className={styles.sectionPanel}>
              <div className={styles.sectionHeading}>
                <div><p className="eyebrow">Manual record</p><h2>Add entry</h2></div>
                <p>Record income, spending, fees, payouts, or append-only corrections.</p>
              </div>
              <form className={styles.entryForm} onSubmit={(event) => void createTransaction(event)}>
                <div className={styles.presets} aria-label="Entry presets">
                  {entryPresets.map((preset) => (
                    <button key={preset.label} type="button" className="secondary-action" onClick={() => applyEntryPreset(preset)} disabled={busy}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className={styles.formGrid}>
                  <label>
                    Type
                    <select
                      value={form.transactionType}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        transactionType: event.target.value as MoneyTransactionType,
                        correctsTransactionId: event.target.value === "correction" ? current.correctsTransactionId : "",
                        correctionReason: event.target.value === "correction" ? current.correctionReason : ""
                      }))}
                    >
                      {Object.entries(transactionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    Mode
                    <select value={form.moneyMode} onChange={(event) => setForm((current) => ({ ...current, moneyMode: event.target.value as MoneyMode }))}>
                      <option value="real">Real</option><option value="provider_sandbox">Provider sandbox</option><option value="simulated">Simulated</option><option value="test">Test</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={form.postingStatus} onChange={(event) => setForm((current) => ({ ...current, postingStatus: event.target.value as MoneyPostingStatus }))}>
                      <option value="draft">Draft</option><option value="posted">Posted</option>
                    </select>
                  </label>
                  <label>Occurred<input type="datetime-local" value={form.occurredAt} onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} /></label>
                  <label>Accounting date<input type="datetime-local" value={form.accountingAt} onChange={(event) => setForm((current) => ({ ...current, accountingAt: event.target.value }))} /></label>
                  <label>
                    Line kind
                    <select value={form.lineKind} onChange={(event) => setForm((current) => ({ ...current, lineKind: event.target.value as MoneyLedgerLineKind }))}>
                      {lineKindOptions.map((kind) => <option key={kind} value={kind}>{formatLabel(kind)}</option>)}
                    </select>
                  </label>
                  <label>
                    Direction
                    <select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as MoneyDirection }))}>
                      <option value="in">In</option><option value="out">Out</option><option value="neutral">Neutral</option>
                    </select>
                  </label>
                  <label>Amount<input inputMode="decimal" value={form.amountMajor} onChange={(event) => setForm((current) => ({ ...current, amountMajor: event.target.value }))} placeholder="12.34" /></label>
                  <label>Currency<input value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} maxLength={3} /></label>
                  <label>Category<input value={form.categoryKey} onChange={(event) => setForm((current) => ({ ...current, categoryKey: event.target.value }))} placeholder="hosting, payout, support" /></label>
                  {form.transactionType === "correction" ? (
                    <>
                      <label>Corrects entry<input value={form.correctsTransactionId} readOnly /></label>
                      <label className={styles.wideField}>Correction reason<textarea value={form.correctionReason} onChange={(event) => setForm((current) => ({ ...current, correctionReason: event.target.value }))} rows={3} /></label>
                    </>
                  ) : null}
                  <label>
                    Receipt type
                    <select value={form.receiptReferenceType} onChange={(event) => setForm((current) => ({ ...current, receiptReferenceType: event.target.value as MoneyReceiptReferenceType }))}>
                      <option value="receipt">Receipt</option><option value="invoice">Invoice</option><option value="provider_statement">Provider statement</option><option value="bank_statement">Bank statement</option><option value="note">Note</option>
                    </select>
                  </label>
                  <label>
                    Receipt storage
                    <select value={form.receiptStorageKind} onChange={(event) => setForm((current) => ({ ...current, receiptStorageKind: event.target.value as MoneyReceiptStorageKind }))}>
                      <option value="external_url">External URL</option><option value="local_reference">Local reference</option><option value="future_upload">Private upload</option>
                    </select>
                  </label>
                  <label>Receipt label<input value={form.receiptLabel} onChange={(event) => setForm((current) => ({ ...current, receiptLabel: event.target.value }))} placeholder="Ko-fi payout July, hosting invoice" /></label>
                  <label>
                    Upload evidence
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,application/pdf,image/png,image/jpeg,image/webp,text/csv,text/plain"
                      disabled={receiptUploading || busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = "";
                        void uploadReceiptFile(file);
                      }}
                    />
                  </label>
                  <label className={styles.wideField}>Private receipt reference<input value={form.receiptPrivateReference} onChange={(event) => setForm((current) => ({ ...current, receiptPrivateReference: event.target.value }))} placeholder="URL, invoice number, local folder path" /></label>
                  <label className={styles.checkboxField}><input type="checkbox" checked={form.isEstimate} onChange={(event) => setForm((current) => ({ ...current, isEstimate: event.target.checked }))} /> Estimate</label>
                  <label className={styles.wideField}>Private notes<textarea value={form.notesPrivate} onChange={(event) => setForm((current) => ({ ...current, notesPrivate: event.target.value }))} rows={4} /></label>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save entry"}</button>
                  <button type="button" className="secondary-action" onClick={() => setActiveSection("ledger")}>Cancel</button>
                </div>
              </form>
            </section>
          ) : null}

          {activeSection === "warnings" ? (
            <section className={styles.sectionPanel}>
              <div className={styles.sectionHeading}>
                <div><p className="eyebrow">Review queue</p><h2>Accounting warnings</h2></div>
                <p>Warnings identify incomplete evidence, estimates, categories, and rule gaps. Resolving one does not change its ledger row.</p>
              </div>
              <div className={styles.warningList}>
                {warnings.map((warning) => (
                  <article key={warning.id}>
                    <FiAlertTriangle aria-hidden="true" />
                    <div>
                      <strong>{formatLabel(warning.warningKind)}</strong>
                      <span>{warning.severity} · {warning.targetKind}</span>
                      <p>{warning.message}</p>
                      <code>{warning.targetId}</code>
                    </div>
                    <button type="button" onClick={() => void resolveWarning(warning)} disabled={busy}>Mark resolved</button>
                  </article>
                ))}
                {warnings.length === 0 ? <p className={styles.emptyState}>No open accounting warnings for this period.</p> : null}
              </div>
            </section>
          ) : null}

          {activeSection === "dated-rules" ? (
            <section className={styles.sectionPanel}>
              <div className={styles.sectionHeading}>
                <div><p className="eyebrow">Effective dates</p><h2>Income splits and transaction costs</h2></div>
                <p>Keep fee, split, conversion, and estimate rules tied to the dates when they applied.</p>
              </div>
              <MoneyDatedRulesPanel
                rules={rules}
                impactPreview={ruleImpactPreview}
                ruleForm={ruleForm}
                busy={busy}
                onRuleFormChange={setRuleForm}
                onCreateRule={(event) => void createRuleVersion(event)}
                onCreateImpactDrafts={() => void createRuleImpactDrafts()}
              />
            </section>
          ) : null}

          {activeSection === "import" ? (
            <section className={styles.sectionPanel}>
              <div className={styles.sectionHeading}>
                <div><p className="eyebrow">No-write preview first</p><h2>Import provider CSV</h2></div>
                <p>Preview rows, warnings, and duplicates before explicitly creating draft ledger entries.</p>
              </div>
              <p className={styles.importMessage}>{importMessage}</p>
              <label className={styles.csvField}>
                Provider CSV
                <textarea value={importCsvText} onChange={(event) => setImportCsvText(event.target.value)} rows={8} placeholder="date,description,amount,currency,direction,category,provider,reference" />
              </label>
              <div className={styles.formActions}>
                <button type="button" onClick={() => void previewImportCsv()} disabled={busy}>Preview CSV</button>
                <button type="button" onClick={() => void importDraftEntries()} disabled={busy || !importPreview}>Create draft entries</button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setImportCsvText(importPreviewExample);
                    setImportPreview(null);
                    setImportPreviewStatusFilter("all");
                    setImportPreviewRowLimit(25);
                    setImportMessage("Example CSV loaded. Preview it to inspect the rows.");
                  }}
                  disabled={busy}
                >
                  Load example
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setImportCsvText("");
                    setImportPreview(null);
                    setImportPreviewStatusFilter("all");
                    setImportPreviewRowLimit(25);
                    setImportMessage("Paste a provider CSV to preview it without writing ledger rows.");
                  }}
                  disabled={busy}
                >
                  Clear preview
                </button>
              </div>
              {importPreview ? (
                <div className={styles.importPreview}>
                  <div className={styles.importSummary}>
                    <div><strong>{importPreview.summary.readyRows}</strong><span>Ready</span></div>
                    <div><strong>{importPreview.summary.warningRows}</strong><span>Warnings</span></div>
                    <div><strong>{importPreview.summary.skippedRows}</strong><span>Skipped</span></div>
                    <div><strong>{formatAmount(importPreview.summary.totalInMinor, "EUR")}</strong><span>Preview in</span></div>
                    <div><strong>{formatAmount(importPreview.summary.totalOutMinor, "EUR")}</strong><span>Preview out</span></div>
                  </div>
                  {importPreview.notes.map((note) => <p key={note}>{note}</p>)}
                  <div className={styles.previewToolbar}>
                    <label>
                      Preview rows
                      <select
                        value={importPreviewStatusFilter}
                        onChange={(event) => {
                          setImportPreviewStatusFilter(event.target.value as ImportPreviewStatusFilter);
                          setImportPreviewRowLimit(25);
                        }}
                      >
                        <option value="all">All</option><option value="ready">Ready</option><option value="warning">Warnings</option><option value="skipped">Skipped</option>
                      </select>
                    </label>
                    <span>Showing {Math.min(importPreviewRowLimit, filteredImportPreviewRows.length)} of {filteredImportPreviewRows.length}</span>
                    {importPreviewRowLimit < filteredImportPreviewRows.length ? (
                      <>
                        <button type="button" className="secondary-action" onClick={() => setImportPreviewRowLimit((current) => current + 25)}>Show 25 more</button>
                        <button type="button" className="secondary-action" onClick={() => setImportPreviewRowLimit(filteredImportPreviewRows.length)}>Show all</button>
                      </>
                    ) : null}
                  </div>
                  <div className={styles.previewRows}>
                    {filteredImportPreviewRows.slice(0, importPreviewRowLimit).map((row) => (
                      <article key={String(row.rowNumber) + (row.reference ?? row.description ?? row.status)} data-status={row.status}>
                        <div>
                          <strong>Row {row.rowNumber}: {row.status}</strong>
                          <span>{row.direction ?? "?"} {row.amountMinor === null ? "invalid amount" : formatAmount(row.amountMinor, row.currency)}{row.sourceProvider ? " · " + row.sourceProvider : ""}{row.categoryKey ? " · " + row.categoryKey : ""}</span>
                        </div>
                        {row.description ? <p>{row.description}</p> : null}
                        {row.duplicateTransactionId ? <p>Existing entry: {row.duplicateTransactionId}</p> : null}
                        {row.possibleDuplicateTransactionId ? <p>Possible match: {row.possibleDuplicateTransactionId}</p> : null}
                        {row.warnings.length > 0 ? <p>{row.warnings.join(", ")}</p> : null}
                      </article>
                    ))}
                    {filteredImportPreviewRows.length === 0 ? <p className={styles.emptyState}>No preview rows match this filter.</p> : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
};

export default MoneyAdminClient;
