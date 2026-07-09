import type {
  MoneyLedgerCapability,
  MoneyLedgerLineInput,
  MoneyLedgerTransactionInput,
  MoneyMode,
  MoneyValueSource
} from "./money-ledger.types.js";

export const moneyPrivateNoteMaxLength = 2_000;
export const moneyCorrectionReasonMaxLength = 500;
export const moneyCategoryKeyMaxLength = 80;

const estimateValueSources = new Set<MoneyValueSource>([
  "twitch_bits_estimate",
  "twitch_sub_estimate",
  "youtube_membership_estimate",
  "youtube_paid_message_estimate",
  "discord_boost_estimate",
  "other_estimate"
]);

export const canManageMoneyLedger = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is MoneyLedgerCapability =>
    capability === "*" || capability === "money:manage"
  );

const isIsoDate = (value: string): boolean => {
  const time = Date.parse(value);
  return Number.isFinite(time);
};

const isValidNullableText = (value: string | null, maxLength: number): boolean =>
  value === null || value.trim().length <= maxLength;

const isValidNullableId = (value: string | null): boolean =>
  value === null || (value.trim().length > 0 && value.trim().length <= 191);

const isValidLineInput = (line: MoneyLedgerLineInput): boolean =>
  Number.isSafeInteger(line.amountMinor)
  && line.amountMinor >= 0
  && (line.valueSource !== "eur" || (line.currency !== null && /^[A-Z]{3}$/.test(line.currency)))
  && (estimateValueSources.has(line.valueSource) || !line.isEstimate)
  && isValidNullableText(line.categoryKey, moneyCategoryKeyMaxLength)
  && isValidNullableId(line.projectId)
  && isValidNullableId(line.projectItemId)
  && isValidNullableText(line.notesPrivate, moneyPrivateNoteMaxLength);

export const normalizeMoneyMode = (value: MoneyMode): MoneyMode => value;

export const isValidMoneyLedgerTransactionInput = (input: MoneyLedgerTransactionInput): boolean =>
  isIsoDate(input.occurredAt)
  && isIsoDate(input.accountingAt)
  && isValidNullableText(input.notesPrivate, moneyPrivateNoteMaxLength)
  && input.lines.length > 0
  && input.lines.length <= 20
  && input.lines.every(isValidLineInput)
  && (
    input.transactionType !== "correction"
    || (
      input.correctsTransactionId !== null
      && input.correctsTransactionId.trim().length > 0
      && input.correctionReason !== null
      && input.correctionReason.trim().length > 0
      && input.correctionReason.trim().length <= moneyCorrectionReasonMaxLength
    )
  )
  && (
    input.transactionType === "correction"
    || (input.correctsTransactionId === null && input.correctionReason === null)
  )
  && (
    ["manual", "project", "project_item", "report", "correction"].includes(input.sourceKind)
    || input.sourceProvider !== null
  );
