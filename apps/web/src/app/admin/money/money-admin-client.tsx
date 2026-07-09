"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MoneyDirection,
  MoneyLedgerLineKind,
  MoneyLedgerTransaction,
  MoneyMode,
  MoneyPostingStatus,
  MoneyTransactionType,
  MoneyValueSource
} from "@maiks-yt/domain";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type MoneyLedgerResponse =
  | {
    ok: true;
    transactions: readonly MoneyLedgerTransaction[];
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
  notesPrivate: string;
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
  notesPrivate: ""
});

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
  const [form, setForm] = useState<MoneyFormState>(() => defaultForm());
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading private money ledger...");
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const realLines = transactions.flatMap((transaction) =>
      transaction.moneyMode === "real" ? transaction.lines : []
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

  const loadLedger = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading private money ledger...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/ledger`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<MoneyLedgerResponse>(response);

      if (response.ok && payload?.ok) {
        setTransactions(payload.transactions);
        setLoadState("ready");
        setMessage(payload.transactions.length === 0 ? "No private money entries yet." : "Private money ledger loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Money ledger request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadLedger();
  }, [loadLedger]);

  const createTransaction = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const amountMinor = parseAmountMinor(form.amountMajor);

    if (amountMinor === null) {
      setMessage("Use a positive amount with up to two decimals.");
      return;
    }

    setBusy(true);
    setMessage("Saving private money entry...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/money/transactions`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include",
        body: JSON.stringify({
          transactionType: form.transactionType,
          moneyMode: form.moneyMode,
          sourceKind: "manual",
          sourceProvider: "manual",
          postingStatus: form.postingStatus,
          occurredAt: toIsoFromLocalInput(form.occurredAt),
          accountingAt: toIsoFromLocalInput(form.accountingAt),
          correctsTransactionId: null,
          correctionReason: null,
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
              notesPrivate: form.notesPrivate.trim() || null
            }
          ]
        })
      });
      const payload = await parseJson<MoneyMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setTransactions((current) => [payload.transaction, ...current]);
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

  return (
    <section className="project-admin-shell">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">Private Admin</p>
          <h1>Money Ledger</h1>
          <p>Manual income, cost, fee, payout, and correction tracking before public payment behavior exists.</p>
        </div>
        <button type="button" onClick={() => void loadLedger()} disabled={loadState === "loading"}>
          Refresh
        </button>
      </header>

      <p className={`admin-status admin-status-${loadState}`}>{message}</p>

      {loadState === "ready" ? (
        <div className="project-admin-grid">
          <form className="project-admin-form" onSubmit={(event) => void createTransaction(event)}>
            <h2>Add Manual Entry</h2>
            <label>
              Type
              <select
                value={form.transactionType}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  transactionType: event.target.value as MoneyTransactionType
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
            <div className="admin-metric-grid">
              <div><strong>{formatAmount(totals.incomeMinor, "EUR")}</strong><span>Real in</span></div>
              <div><strong>{formatAmount(totals.outMinor, "EUR")}</strong><span>Real out</span></div>
              <div><strong>{formatAmount(totals.remainderMinor, "EUR")}</strong><span>Remainder</span></div>
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
                  {transaction.lines.map((line) => (
                    <p key={line.id}>
                      {line.direction} {formatAmount(line.amountMinor, line.currency)} · {line.lineKind.replaceAll("_", " ")}
                      {line.categoryKey ? ` · ${line.categoryKey}` : ""}
                      {line.isEstimate ? " · estimate" : ""}
                    </p>
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
