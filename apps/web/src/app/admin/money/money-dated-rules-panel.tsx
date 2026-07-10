"use client";

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type {
  MoneyProvider,
  MoneyRuleDateBasis,
  MoneyRuleKind,
  MoneyRuleVersion,
  MoneyValueSource
} from "@maiks-yt/domain";

export type MoneyRuleFormState = {
  ruleKind: MoneyRuleKind;
  provider: MoneyProvider | "";
  valueSource: MoneyValueSource | "";
  appliesToDateBasis: MoneyRuleDateBasis;
  effectiveFrom: string;
  effectiveUntil: string;
  percentagePercent: string;
  fixedAmountMajor: string;
  fixedCurrency: string;
  changeReason: string;
};

type MoneyDatedRulesPanelProps = {
  rules: readonly MoneyRuleVersion[];
  ruleForm: MoneyRuleFormState;
  busy: boolean;
  onRuleFormChange: Dispatch<SetStateAction<MoneyRuleFormState>>;
  onCreateRule: (event: FormEvent<HTMLFormElement>) => void;
};

const ruleKindOptions: readonly MoneyRuleKind[] = [
  "platform_fee",
  "fixed_transaction_fee",
  "payout_fee",
  "currency_conversion_fee",
  "platform_split",
  "streamer_share_estimate",
  "tax_or_vat_note",
  "manual_override"
];

const providerOptions: readonly MoneyProvider[] = [
  "twitch",
  "youtube",
  "discord",
  "stripe",
  "paypal",
  "kofi",
  "bank",
  "manual",
  "other"
];

const valueSourceOptions: readonly MoneyValueSource[] = [
  "eur",
  "site_credit",
  "restricted_credit",
  "twitch_bits_estimate",
  "twitch_sub_estimate",
  "youtube_membership_estimate",
  "youtube_paid_message_estimate",
  "discord_boost_estimate",
  "other_estimate"
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

export const MoneyDatedRulesPanel = ({
  rules,
  ruleForm,
  busy,
  onRuleFormChange,
  onCreateRule
}: MoneyDatedRulesPanelProps): ReactNode => (
  <form className="admin-list" onSubmit={onCreateRule}>
    <h3>Dated Rules</h3>
    <p>Record fee, split, and tax-note rule changes by date. These rules are listed for review now; automatic ledger application is a later accounting step.</p>
    <div className="project-admin-form-grid">
      <label>
        Rule
        <select
          value={ruleForm.ruleKind}
          onChange={(event) => onRuleFormChange((current) => ({
            ...current,
            ruleKind: event.target.value as MoneyRuleKind
          }))}
        >
          {ruleKindOptions.map((kind) => (
            <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
          ))}
        </select>
      </label>
      <label>
        Provider
        <select
          value={ruleForm.provider}
          onChange={(event) => onRuleFormChange((current) => ({
            ...current,
            provider: event.target.value as MoneyProvider | ""
          }))}
        >
          <option value="">Any</option>
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>
      </label>
      <label>
        Value source
        <select
          value={ruleForm.valueSource}
          onChange={(event) => onRuleFormChange((current) => ({
            ...current,
            valueSource: event.target.value as MoneyValueSource | ""
          }))}
        >
          <option value="">Any</option>
          {valueSourceOptions.map((valueSource) => (
            <option key={valueSource} value={valueSource}>{valueSource.replaceAll("_", " ")}</option>
          ))}
        </select>
      </label>
      <label>
        Date basis
        <select
          value={ruleForm.appliesToDateBasis}
          onChange={(event) => onRuleFormChange((current) => ({
            ...current,
            appliesToDateBasis: event.target.value as MoneyRuleDateBasis
          }))}
        >
          <option value="event_date">Event date</option>
          <option value="payout_date">Payout date</option>
          <option value="accounting_date">Accounting date</option>
        </select>
      </label>
      <label>
        Effective from
        <input
          type="datetime-local"
          value={ruleForm.effectiveFrom}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, effectiveFrom: event.target.value }))}
        />
      </label>
      <label>
        Effective until
        <input
          type="datetime-local"
          value={ruleForm.effectiveUntil}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, effectiveUntil: event.target.value }))}
        />
      </label>
      <label>
        Percentage
        <input
          inputMode="decimal"
          value={ruleForm.percentagePercent}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, percentagePercent: event.target.value }))}
          placeholder="10"
        />
      </label>
      <label>
        Fixed amount
        <input
          inputMode="decimal"
          value={ruleForm.fixedAmountMajor}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, fixedAmountMajor: event.target.value }))}
          placeholder="0.35"
        />
      </label>
      <label>
        Fixed currency
        <input
          value={ruleForm.fixedCurrency}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, fixedCurrency: event.target.value.toUpperCase() }))}
          maxLength={3}
        />
      </label>
    </div>
    <label>
      Change reason
      <textarea
        value={ruleForm.changeReason}
        onChange={(event) => onRuleFormChange((current) => ({ ...current, changeReason: event.target.value }))}
        rows={3}
        placeholder="Provider fee changed from this date."
      />
    </label>
    <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save rule"}</button>
    <div className="admin-list">
      {rules.length === 0 ? (
        <p>No dated money rules yet.</p>
      ) : rules.slice(0, 12).map((rule) => (
        <article className="admin-list-item" key={rule.id}>
          <div>
            <strong>{rule.ruleKind.replaceAll("_", " ")}</strong>
            <span>
              {rule.provider ?? "any provider"} · {rule.valueSource ?? "any value"} · {rule.appliesToDateBasis.replaceAll("_", " ")}
            </span>
          </div>
          <p>
            From {formatDate(rule.effectiveFrom)}
            {rule.effectiveUntil ? ` until ${formatDate(rule.effectiveUntil)}` : ""}
            {rule.percentageBps !== null ? ` · ${(rule.percentageBps / 100).toFixed(2)}%` : ""}
            {rule.fixedAmountMinor !== null ? ` · ${formatAmount(rule.fixedAmountMinor, rule.fixedCurrency)}` : ""}
          </p>
          <p>{rule.changeReason}</p>
        </article>
      ))}
    </div>
  </form>
);
