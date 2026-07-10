"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MoneyAccountingWarning,
  MoneyDirection,
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

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

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

const currentMonthFilters = (): MoneyFilterState => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    accountingFrom: start.toISOString().slice(0, 10),
    accountingTo: next.toISOString().slice(0, 10)
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

const toIsoFromDateInput = (value: string): string | null =>
  value ? new Date(`${value}T00:00:00`).toISOString() : null;

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
  const [form, setForm] = useState<MoneyFormState>(() => defaultForm());
  const [ruleForm, setRuleForm] = useState<MoneyRuleFormState>(() => defaultRuleForm());
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading private money ledger...");
  const [busy, setBusy] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<MoneyImportPreview | null>(null);
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
    const accountingTo = toIsoFromDateInput(filters.accountingTo);

    if (accountingFrom) {
      params.set("accountingFrom", accountingFrom);
    }

    if (accountingTo) {
      params.set("accountingTo", accountingTo);
    }

    const query = params.toString();

    return query ? `?${query}` : "";
  }, [filters.accountingFrom, filters.accountingTo]);

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
    setMessage("Correction draft started. Enter the delta amount and save it.");
  };

  return (
    <section className="project-admin-shell">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">Private Admin</p>
          <h1>Money Ledger</h1>
          <p>Manual income, cost, fee, payout, and correction tracking before public payment behavior exists.</p>
        </div>
        <div className="admin-inline-actions">
          <button type="button" onClick={() => void exportReviewPackageJson()} disabled={busy || loadState !== "ready"}>
            Export Package
          </button>
          <button type="button" onClick={() => void exportSummaryJson()} disabled={busy || loadState !== "ready"}>
            Export Summary
          </button>
          <button type="button" onClick={() => void exportWarningsCsv()} disabled={busy || loadState !== "ready"}>
            Export Warnings
          </button>
          <button type="button" onClick={() => void exportLedgerCsv()} disabled={busy || loadState !== "ready"}>
            Export CSV
          </button>
          <button type="button" onClick={() => void loadLedger()} disabled={loadState === "loading"}>
            Refresh
          </button>
        </div>
      </header>

      <p className={`admin-status admin-status-${loadState}`}>{message}</p>

      {loadState === "ready" ? (
        <div className="project-admin-grid">
          <form className="project-admin-form" onSubmit={(event) => void createTransaction(event)}>
            <h2>Add Manual Entry</h2>
            <div className="admin-inline-actions" aria-label="Entry presets">
              {entryPresets.map((preset) => (
                <button key={preset.label} type="button" className="secondary-action" onClick={() => applyEntryPreset(preset)} disabled={busy}>
                  {preset.label}
                </button>
              ))}
            </div>
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
                {Object.entries(transactionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Mode
              <select
                value={form.moneyMode}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  moneyMode: event.target.value as MoneyMode
                }))}
              >
                <option value="real">Real</option>
                <option value="provider_sandbox">Provider sandbox</option>
                <option value="simulated">Simulated</option>
                <option value="test">Test</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={form.postingStatus}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  postingStatus: event.target.value as MoneyPostingStatus
                }))}
              >
                <option value="draft">Draft</option>
                <option value="posted">Posted</option>
              </select>
            </label>
            <label>
              Occurred
              <input
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))}
              />
            </label>
            <label>
              Accounting date
              <input
                type="datetime-local"
                value={form.accountingAt}
                onChange={(event) => setForm((current) => ({ ...current, accountingAt: event.target.value }))}
              />
            </label>
            <label>
              Line kind
              <select
                value={form.lineKind}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  lineKind: event.target.value as MoneyLedgerLineKind
                }))}
              >
                {lineKindOptions.map((kind) => (
                  <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label>
              Direction
              <select
                value={form.direction}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  direction: event.target.value as MoneyDirection
                }))}
              >
                <option value="in">In</option>
                <option value="out">Out</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>
            <label>
              Amount
              <input
                inputMode="decimal"
                value={form.amountMajor}
                onChange={(event) => setForm((current) => ({ ...current, amountMajor: event.target.value }))}
                placeholder="12.34"
              />
            </label>
            <label>
              Currency
              <input
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                maxLength={3}
              />
            </label>
            <label>
              Category
              <input
                value={form.categoryKey}
                onChange={(event) => setForm((current) => ({ ...current, categoryKey: event.target.value }))}
                placeholder="hosting, payout, support"
              />
            </label>
            {form.transactionType === "correction" ? (
              <>
                <label>
                  Corrects entry
                  <input value={form.correctsTransactionId} readOnly />
                </label>
                <label>
                  Correction reason
                  <textarea
                    value={form.correctionReason}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      correctionReason: event.target.value
                    }))}
                    rows={3}
                  />
                </label>
              </>
            ) : null}
            <label>
              Receipt type
              <select
                value={form.receiptReferenceType}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  receiptReferenceType: event.target.value as MoneyReceiptReferenceType
                }))}
              >
                <option value="receipt">Receipt</option>
                <option value="invoice">Invoice</option>
                <option value="provider_statement">Provider statement</option>
                <option value="bank_statement">Bank statement</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label>
              Receipt storage
              <select
                value={form.receiptStorageKind}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  receiptStorageKind: event.target.value as MoneyReceiptStorageKind
                }))}
              >
                <option value="external_url">External URL</option>
                <option value="local_reference">Local reference</option>
                <option value="future_upload">Future upload</option>
              </select>
            </label>
            <label>
              Receipt label
              <input
                value={form.receiptLabel}
                onChange={(event) => setForm((current) => ({ ...current, receiptLabel: event.target.value }))}
                placeholder="Ko-fi payout July, hosting invoice"
              />
            </label>
            <label>
              Upload receipt file
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
            <label>
              Private receipt reference
              <input
                value={form.receiptPrivateReference}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  receiptPrivateReference: event.target.value
                }))}
                placeholder="URL, invoice number, local folder path"
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isEstimate}
                onChange={(event) => setForm((current) => ({ ...current, isEstimate: event.target.checked }))}
              />
              Estimate
            </label>
            <label>
              Private notes
              <textarea
                value={form.notesPrivate}
                onChange={(event) => setForm((current) => ({ ...current, notesPrivate: event.target.value }))}
                rows={4}
              />
            </label>
            <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save entry"}</button>
          </form>

          <section className="project-admin-preview">
            <h2>Ledger Summary</h2>
            <div className="admin-inline-actions">
              <label>
                From
                <input
                  type="date"
                  value={filters.accountingFrom}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    accountingFrom: event.target.value
                  }))}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.accountingTo}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    accountingTo: event.target.value
                  }))}
                />
              </label>
              <button type="button" onClick={() => void loadLedger()} disabled={busy}>
                Apply dates
              </button>
              <button type="button" onClick={() => setFilters(currentMonthFilters())}>
                This month
              </button>
              <button type="button" onClick={() => setFilters({ accountingFrom: "", accountingTo: "" })}>
                Clear dates
              </button>
            </div>
            <div className="admin-metric-grid">
              <div><strong>{formatAmount(totals.incomeMinor, "EUR")}</strong><span>Real in</span></div>
              <div><strong>{formatAmount(totals.outMinor, "EUR")}</strong><span>Real out</span></div>
              <div><strong>{formatAmount(totals.remainderMinor, "EUR")}</strong><span>Remainder</span></div>
              <div><strong>{warnings.length}</strong><span>Open warnings</span></div>
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
            {warnings.length > 0 ? (
              <div className="admin-list">
                <h3>Accounting Warnings</h3>
                {warnings.map((warning) => (
                  <article className="admin-list-item" key={warning.id}>
                    <div>
                      <strong>{warning.warningKind.replaceAll("_", " ")}</strong>
                      <span>{warning.severity} · {warning.targetKind}</span>
                    </div>
                    <p>{warning.message}</p>
                    <button type="button" onClick={() => void resolveWarning(warning)} disabled={busy}>
                      Mark resolved
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="admin-list">
              <h3>Import Preview</h3>
              <p>{importMessage}</p>
              <label>
                Provider CSV
                <textarea
                  value={importCsvText}
                  onChange={(event) => setImportCsvText(event.target.value)}
                  rows={7}
                  placeholder="date,description,amount,currency,direction,category,provider,reference"
                />
              </label>
              <div className="admin-inline-actions">
                <button type="button" onClick={() => void previewImportCsv()} disabled={busy}>
                  Preview CSV
                </button>
                <button type="button" onClick={() => void importDraftEntries()} disabled={busy || !importPreview}>
                  Create draft entries
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setImportCsvText(importPreviewExample);
                    setImportPreview(null);
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
                    setImportMessage("Paste a provider CSV to preview it without writing ledger rows.");
                  }}
                  disabled={busy}
                >
                  Clear preview
                </button>
              </div>
              {importPreview ? (
                <>
                  <div className="admin-metric-grid">
                    <div><strong>{importPreview.summary.readyRows}</strong><span>Ready</span></div>
                    <div><strong>{importPreview.summary.warningRows}</strong><span>Warnings</span></div>
                    <div><strong>{importPreview.summary.skippedRows}</strong><span>Skipped</span></div>
                    <div><strong>{importPreview.summary.currencies.join(", ") || "None"}</strong><span>Currencies</span></div>
                    <div><strong>{formatAmount(importPreview.summary.totalInMinor, "EUR")}</strong><span>Preview in</span></div>
                    <div><strong>{formatAmount(importPreview.summary.totalOutMinor, "EUR")}</strong><span>Preview out</span></div>
                  </div>
                  {importPreview.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  <div className="admin-list">
                    {importPreview.rows.slice(0, 12).map((row) => (
                      <article className="admin-list-item" key={`${row.rowNumber}-${row.reference ?? row.description ?? row.status}`}>
                        <div>
                          <strong>Row {row.rowNumber}: {row.status}</strong>
                          <span>
                            {row.direction ?? "?"} {row.amountMinor === null ? "invalid amount" : formatAmount(row.amountMinor, row.currency)}
                            {row.sourceProvider ? ` · ${row.sourceProvider}` : ""}
                            {row.categoryKey ? ` · ${row.categoryKey}` : ""}
                          </span>
                        </div>
                        {row.description ? <p>{row.description}</p> : null}
                        {row.duplicateTransactionId ? <p>Existing entry: {row.duplicateTransactionId}</p> : null}
                        {row.possibleDuplicateTransactionId ? <p>Possible match: {row.possibleDuplicateTransactionId}</p> : null}
                        {row.warnings.length > 0 ? <p>{row.warnings.join(", ")}</p> : null}
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="admin-list">
              {transactions.length === 0 ? (
                <p>No entries yet.</p>
              ) : transactions.map((transaction) => (
                <article className="admin-list-item" key={transaction.id}>
                  <div>
                    <strong>{transactionTypeLabels[transaction.transactionType]}</strong>
                    <span>{transaction.moneyMode} · {transaction.postingStatus} · {formatDate(transaction.accountingAt)}</span>
                  </div>
                  {transaction.postingStatus !== "voided" ? (
                    <div className="admin-inline-actions">
                      <button type="button" onClick={() => startCorrection(transaction)} disabled={busy}>
                        Correct entry
                      </button>
                      <button type="button" onClick={() => void voidTransaction(transaction)} disabled={busy}>
                        Void entry
                      </button>
                    </div>
                  ) : null}
                  {transaction.lines.map((line) => (
                    <div key={line.id}>
                      <p>
                        {line.direction} {formatAmount(line.amountMinor, line.currency)} · {line.lineKind.replaceAll("_", " ")}
                        {line.categoryKey ? ` · ${line.categoryKey}` : ""}
                        {line.isEstimate ? " · estimate" : ""}
                      </p>
                      {line.receiptReference ? (
                        <p>
                          Receipt: {line.receiptReference.label}
                          {" "}
                          ({line.receiptReference.referenceType.replaceAll("_", " ")})
                          {getReceiptUploadId(line.receiptReference.privateReference) ? (
                            <>
                              {" "}
                              <button
                                type="button"
                                onClick={() => {
                                  const uploadId = getReceiptUploadId(line.receiptReference?.privateReference ?? "");

                                  if (uploadId) {
                                    void downloadReceiptFile(uploadId);
                                  }
                                }}
                                disabled={busy}
                              >
                                Open file
                              </button>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {transaction.notesPrivate ? <p>{transaction.notesPrivate}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
};

export default MoneyAdminClient;
