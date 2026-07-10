export const moneyTransactionTypes = [
  "income",
  "fee",
  "payout",
  "cost",
  "allocation",
  "refund",
  "reversal",
  "dispute",
  "conversion",
  "correction",
  "report_adjustment"
] as const;

export type MoneyTransactionType = typeof moneyTransactionTypes[number];

export const moneyModes = ["real", "provider_sandbox", "simulated", "test"] as const;

export type MoneyMode = typeof moneyModes[number];

export const moneySourceKinds = [
  "manual",
  "provider_intake",
  "provider_payment",
  "provider_payout",
  "project",
  "project_item",
  "report",
  "correction"
] as const;

export type MoneySourceKind = typeof moneySourceKinds[number];

export const moneyProviders = [
  "twitch",
  "youtube",
  "discord",
  "stripe",
  "paypal",
  "kofi",
  "bank",
  "manual",
  "other"
] as const;

export type MoneyProvider = typeof moneyProviders[number];

export const moneyPostingStatuses = ["draft", "posted", "voided"] as const;

export type MoneyPostingStatus = typeof moneyPostingStatuses[number];

export const moneyLedgerLineKinds = [
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
] as const;

export type MoneyLedgerLineKind = typeof moneyLedgerLineKinds[number];

export const moneyDirections = ["in", "out", "neutral"] as const;

export type MoneyDirection = typeof moneyDirections[number];

export const moneyValueSources = [
  "eur",
  "site_credit",
  "restricted_credit",
  "twitch_bits_estimate",
  "twitch_sub_estimate",
  "youtube_membership_estimate",
  "youtube_paid_message_estimate",
  "discord_boost_estimate",
  "other_estimate"
] as const;

export type MoneyValueSource = typeof moneyValueSources[number];

export const moneyRuleKinds = [
  "platform_fee",
  "fixed_transaction_fee",
  "payout_fee",
  "currency_conversion_fee",
  "platform_split",
  "streamer_share_estimate",
  "tax_or_vat_note",
  "manual_override"
] as const;

export type MoneyRuleKind = typeof moneyRuleKinds[number];

export const moneyRuleDateBases = ["event_date", "payout_date", "accounting_date"] as const;

export type MoneyRuleDateBasis = typeof moneyRuleDateBases[number];

export type MoneyRuleVersionInput = {
  ruleKind: MoneyRuleKind;
  provider: MoneyProvider | null;
  valueSource: MoneyValueSource | null;
  appliesToDateBasis: MoneyRuleDateBasis;
  effectiveFrom: string;
  effectiveUntil: string | null;
  percentageBps: number | null;
  fixedAmountMinor: number | null;
  fixedCurrency: string | null;
  rulePayload: Record<string, unknown> | null;
  changeReason: string;
  supersedesRuleId: string | null;
};

export type MoneyRuleVersion = MoneyRuleVersionInput & {
  id: string;
  createdByUserId: string | null;
  createdAt: string;
};

export const moneyReceiptReferenceTypes = [
  "receipt",
  "invoice",
  "provider_statement",
  "bank_statement",
  "note"
] as const;

export type MoneyReceiptReferenceType = typeof moneyReceiptReferenceTypes[number];

export const moneyReceiptStorageKinds = ["external_url", "local_reference", "future_upload"] as const;

export type MoneyReceiptStorageKind = typeof moneyReceiptStorageKinds[number];

export type MoneyReceiptReferenceInput = {
  referenceType: MoneyReceiptReferenceType;
  storageKind: MoneyReceiptStorageKind;
  label: string;
  privateReference: string;
};

export type MoneyReceiptReference = MoneyReceiptReferenceInput & {
  id: string;
  createdByUserId: string | null;
  createdAt: string;
};

export type MoneyLedgerLineInput = {
  lineKind: MoneyLedgerLineKind;
  direction: MoneyDirection;
  amountMinor: number;
  currency: string | null;
  valueSource: MoneyValueSource;
  isEstimate: boolean;
  categoryKey: string | null;
  projectId: string | null;
  projectItemId: string | null;
  receiptReference: MoneyReceiptReferenceInput | null;
  notesPrivate: string | null;
};

export type MoneyLedgerTransactionInput = {
  transactionType: MoneyTransactionType;
  moneyMode: MoneyMode;
  sourceKind: MoneySourceKind;
  sourceProvider: MoneyProvider | null;
  postingStatus: MoneyPostingStatus;
  occurredAt: string;
  accountingAt: string;
  correctsTransactionId: string | null;
  correctionReason: string | null;
  notesPrivate: string | null;
  lines: readonly MoneyLedgerLineInput[];
};

export type MoneyLedgerLine = MoneyLedgerLineInput & {
  id: string;
  transactionId: string;
  ruleVersionId: string | null;
  receiptReferenceId: string | null;
  receiptReference: MoneyReceiptReference | null;
  createdAt: string;
};

export type MoneyLedgerTransaction = Omit<MoneyLedgerTransactionInput, "lines"> & {
  id: string;
  sourceId: string | null;
  sourceEventId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lines: readonly MoneyLedgerLine[];
};

export const moneyAccountingWarningKinds = [
  "unmapped_source",
  "missing_fee",
  "missing_category",
  "missing_receipt",
  "missing_allocation",
  "rule_gap",
  "estimate_unconfirmed",
  "mixed_money_mode",
  "provider_payout_missing",
  "correction_needed"
] as const;

export type MoneyAccountingWarningKind = typeof moneyAccountingWarningKinds[number];

export const moneyAccountingWarningSeverities = ["info", "warning", "blocking"] as const;

export type MoneyAccountingWarningSeverity = typeof moneyAccountingWarningSeverities[number];

export type MoneyAccountingWarning = {
  id: string;
  targetKind: "transaction" | "line" | "rule" | "report";
  targetId: string;
  warningKind: MoneyAccountingWarningKind;
  severity: MoneyAccountingWarningSeverity;
  status: "open";
  message: string;
};

export type MoneyLedgerCapability = "*" | "money:manage";
