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

export type MoneyLedgerCapability = "*" | "money:manage";
