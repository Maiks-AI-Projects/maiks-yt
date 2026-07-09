import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

const moneyModeValues = ["real", "provider_sandbox", "simulated", "test"] as const;

const moneyProviderValues = [
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

const moneyValueSourceValues = [
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

export const moneyLedgerTransactions = mysqlTable(
  "money_ledger_transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    transactionType: mysqlEnum("transaction_type", [
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
    ]).notNull(),
    moneyMode: mysqlEnum("money_mode", moneyModeValues).notNull().default("real"),
    sourceKind: mysqlEnum("source_kind", [
      "manual",
      "provider_intake",
      "provider_payment",
      "provider_payout",
      "project",
      "project_item",
      "report",
      "correction"
    ]).notNull().default("manual"),
    sourceProvider: mysqlEnum("source_provider", moneyProviderValues),
    sourceId: varchar("source_id", { length: 191 }),
    sourceEventId: varchar("source_event_id", { length: 191 }),
    postingStatus: mysqlEnum("posting_status", ["draft", "posted", "voided"]).notNull().default("draft"),
    occurredAt: timestamp("occurred_at").notNull(),
    accountingAt: timestamp("accounting_at").notNull(),
    correctsTransactionId: varchar("corrects_transaction_id", { length: 36 }),
    correctionReason: varchar("correction_reason", { length: 500 }),
    notesPrivate: text("notes_private"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("money_ledger_transactions_mode_idx").on(table.moneyMode, table.accountingAt),
    index("money_ledger_transactions_type_idx").on(table.transactionType, table.accountingAt),
    index("money_ledger_transactions_source_idx").on(table.sourceKind, table.sourceProvider, table.sourceId),
    index("money_ledger_transactions_status_idx").on(table.postingStatus, table.accountingAt),
    index("money_ledger_transactions_correction_idx").on(table.correctsTransactionId),
    check(
      "money_ledger_transactions_correction_check",
      sql`(
        (
          ${table.transactionType} = 'correction'
          and ${table.correctsTransactionId} is not null
          and ${table.correctionReason} is not null
          and trim(${table.correctionReason}) <> ''
        )
        or
        (
          ${table.transactionType} <> 'correction'
          and ${table.correctsTransactionId} is null
        )
      )`
    ),
    check(
      "money_ledger_transactions_source_provider_check",
      sql`(
        ${table.sourceKind} in ('manual', 'project', 'project_item', 'report', 'correction')
        or ${table.sourceProvider} is not null
      )`
    )
  ]
);

export const moneyReceiptReferences = mysqlTable(
  "money_receipt_references",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    referenceType: mysqlEnum("reference_type", [
      "receipt",
      "invoice",
      "provider_statement",
      "bank_statement",
      "note"
    ]).notNull(),
    storageKind: mysqlEnum("storage_kind", ["external_url", "local_reference", "future_upload"]).notNull(),
    label: varchar("label", { length: 191 }).notNull(),
    privateReference: varchar("private_reference", { length: 1024 }).notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("money_receipt_references_type_idx").on(table.referenceType),
    index("money_receipt_references_created_by_idx").on(table.createdByUserId),
    check("money_receipt_references_label_check", sql`trim(${table.label}) <> ''`),
    check("money_receipt_references_private_reference_check", sql`trim(${table.privateReference}) <> ''`)
  ]
);

export const moneyRuleVersions = mysqlTable(
  "money_rule_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ruleKind: mysqlEnum("rule_kind", [
      "platform_fee",
      "fixed_transaction_fee",
      "payout_fee",
      "currency_conversion_fee",
      "platform_split",
      "streamer_share_estimate",
      "tax_or_vat_note",
      "manual_override"
    ]).notNull(),
    provider: mysqlEnum("provider", moneyProviderValues),
    valueSource: mysqlEnum("value_source", moneyValueSourceValues),
    appliesToDateBasis: mysqlEnum("applies_to_date_basis", ["event_date", "payout_date", "accounting_date"]).notNull(),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveUntil: timestamp("effective_until"),
    percentageBps: bigint("percentage_bps", { mode: "number" }),
    fixedAmountMinor: bigint("fixed_amount_minor", { mode: "number" }),
    fixedCurrency: varchar("fixed_currency", { length: 3 }),
    rulePayload: json("rule_payload").$type<Record<string, unknown>>(),
    changeReason: varchar("change_reason", { length: 500 }).notNull(),
    supersedesRuleId: varchar("supersedes_rule_id", { length: 36 }),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("money_rule_versions_lookup_idx").on(table.ruleKind, table.provider, table.valueSource, table.effectiveFrom),
    index("money_rule_versions_supersedes_idx").on(table.supersedesRuleId),
    check(
      "money_rule_versions_window_check",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`
    ),
    check(
      "money_rule_versions_percentage_check",
      sql`${table.percentageBps} is null or (${table.percentageBps} >= 0 and ${table.percentageBps} <= 10000)`
    ),
    check(
      "money_rule_versions_fixed_amount_check",
      sql`${table.fixedAmountMinor} is null or ${table.fixedAmountMinor} >= 0`
    ),
    check("money_rule_versions_change_reason_check", sql`trim(${table.changeReason}) <> ''`)
  ]
);

export const moneyLedgerLines = mysqlTable(
  "money_ledger_lines",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    transactionId: varchar("transaction_id", { length: 36 }).notNull(),
    lineKind: mysqlEnum("line_kind", [
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
    ]).notNull(),
    direction: mysqlEnum("direction", ["in", "out", "neutral"]).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }),
    valueSource: mysqlEnum("value_source", moneyValueSourceValues).notNull().default("eur"),
    isEstimate: boolean("is_estimate").notNull().default(false),
    categoryKey: varchar("category_key", { length: 80 }),
    projectId: varchar("project_id", { length: 36 }),
    projectItemId: varchar("project_item_id", { length: 36 }),
    ruleVersionId: varchar("rule_version_id", { length: 36 }),
    receiptReferenceId: varchar("receipt_reference_id", { length: 36 }),
    notesPrivate: text("notes_private"),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("money_ledger_lines_transaction_idx").on(table.transactionId),
    index("money_ledger_lines_kind_idx").on(table.lineKind),
    index("money_ledger_lines_category_idx").on(table.categoryKey),
    index("money_ledger_lines_project_idx").on(table.projectId, table.projectItemId),
    index("money_ledger_lines_rule_idx").on(table.ruleVersionId),
    index("money_ledger_lines_receipt_idx").on(table.receiptReferenceId),
    check("money_ledger_lines_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "money_ledger_lines_currency_check",
      sql`(
        (${table.valueSource} = 'eur' and ${table.currency} is not null and length(${table.currency}) = 3)
        or
        (${table.valueSource} <> 'eur')
      )`
    ),
    check(
      "money_ledger_lines_estimate_check",
      sql`(
        ${table.valueSource} in (
          'twitch_bits_estimate',
          'twitch_sub_estimate',
          'youtube_membership_estimate',
          'youtube_paid_message_estimate',
          'discord_boost_estimate',
          'other_estimate'
        )
        or ${table.isEstimate} = false
      )`
    )
  ]
);

export const moneyReportExports = mysqlTable(
  "money_report_exports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    reportKind: mysqlEnum("report_kind", [
      "accounting_summary",
      "source_breakdown",
      "project_breakdown",
      "tax_review_export",
      "warning_review"
    ]).notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    filtersJson: json("filters_json").$type<Record<string, unknown>>().notNull(),
    ruleVersionIdsJson: json("rule_version_ids_json").$type<string[]>().notNull(),
    warningCountsJson: json("warning_counts_json").$type<Record<string, number>>().notNull(),
    fileKind: mysqlEnum("file_kind", ["csv", "xlsx", "pdf_summary", "none"]).notNull().default("none"),
    fileReference: varchar("file_reference", { length: 1024 }),
    fileChecksum: varchar("file_checksum", { length: 191 }),
    generatedByUserId: varchar("generated_by_user_id", { length: 36 }),
    generatedAt: timestamp("generated_at").notNull().defaultNow()
  },
  (table) => [
    index("money_report_exports_period_idx").on(table.reportKind, table.periodStart, table.periodEnd),
    index("money_report_exports_generated_by_idx").on(table.generatedByUserId),
    check("money_report_exports_period_check", sql`${table.periodEnd} > ${table.periodStart}`),
    check(
      "money_report_exports_file_check",
      sql`(
        ${table.fileKind} = 'none'
        or ${table.fileReference} is not null
        or ${table.fileChecksum} is not null
      )`
    )
  ]
);

export const moneyAccountingWarnings = mysqlTable(
  "money_accounting_warnings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    targetKind: mysqlEnum("target_kind", ["transaction", "line", "rule", "report"]).notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    warningKind: mysqlEnum("warning_kind", [
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
    ]).notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "blocking"]).notNull().default("warning"),
    status: mysqlEnum("status", ["open", "acknowledged", "resolved"]).notNull().default("open"),
    resolvedByUserId: varchar("resolved_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at")
  },
  (table) => [
    index("money_accounting_warnings_target_idx").on(table.targetKind, table.targetId),
    index("money_accounting_warnings_status_idx").on(table.status, table.severity, table.createdAt),
    check(
      "money_accounting_warnings_resolution_check",
      sql`(
        (${table.status} = 'resolved' and ${table.resolvedAt} is not null)
        or
        (${table.status} <> 'resolved' and ${table.resolvedAt} is null)
      )`
    )
  ]
);
