import type {
  MoneyLedgerCapability,
  MoneyLedgerLineInput,
  MoneyReceiptReferenceInput,
  MoneyLedgerTransactionInput,
  MoneyMode,
  MoneyRuleVersionInput,
  MoneyValueSource
} from "./money-ledger.types.js";

export const moneyPrivateNoteMaxLength = 2_000;
export const moneyCorrectionReasonMaxLength = 500;
export const moneyCategoryKeyMaxLength = 80;
export const moneyReceiptLabelMaxLength = 191;
export const moneyReceiptReferenceMaxLength = 1_024;

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

const isValidReceiptReferenceInput = (value: MoneyReceiptReferenceInput | null): boolean =>
  value === null
  || (
    value.label.trim().length > 0
    && value.label.trim().length <= moneyReceiptLabelMaxLength
    && value.privateReference.trim().length > 0
    && value.privateReference.trim().length <= moneyReceiptReferenceMaxLength
  );

const isValidLineInput = (line: MoneyLedgerLineInput): boolean =>
  Number.isSafeInteger(line.amountMinor)
  && line.amountMinor >= 0
  && (line.valueSource !== "eur" || (line.currency !== null && /^[A-Z]{3}$/.test(line.currency)))
  && (estimateValueSources.has(line.valueSource) || !line.isEstimate)
  && isValidNullableText(line.categoryKey, moneyCategoryKeyMaxLength)
  && isValidNullableId(line.projectId)
  && isValidNullableId(line.projectItemId)
  && isValidReceiptReferenceInput(line.receiptReference)
  && isValidNullableText(line.notesPrivate, moneyPrivateNoteMaxLength);

export const normalizeMoneyMode = (value: MoneyMode): MoneyMode => value;

const isValidRulePayload = (value: Record<string, unknown> | null): boolean => {
  if (value === null) {
    return true;
  }

  try {
    return JSON.stringify(value).length <= 5_000;
  } catch {
    return false;
  }
};

export const isValidMoneyRuleVersionInput = (input: MoneyRuleVersionInput): boolean =>
  isIsoDate(input.effectiveFrom)
  && (input.effectiveUntil === null || (isIsoDate(input.effectiveUntil) && Date.parse(input.effectiveUntil) > Date.parse(input.effectiveFrom)))
  && (input.percentageBps === null || (Number.isSafeInteger(input.percentageBps) && input.percentageBps >= 0 && input.percentageBps <= 10_000))
  && (input.fixedAmountMinor === null || (Number.isSafeInteger(input.fixedAmountMinor) && input.fixedAmountMinor >= 0))
  && (
    input.fixedAmountMinor === null
    || (input.fixedCurrency !== null && /^[A-Z]{3}$/.test(input.fixedCurrency))
  )
  && (input.fixedAmountMinor !== null || input.fixedCurrency === null)
  && isValidRulePayload(input.rulePayload)
  && input.changeReason.trim().length > 0
  && input.changeReason.trim().length <= moneyCorrectionReasonMaxLength
  && isValidNullableId(input.supersedesRuleId);

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
