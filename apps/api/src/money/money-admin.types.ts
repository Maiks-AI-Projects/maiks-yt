import type {
  MoneyAccountingWarning,
  MoneyDirection,
  MoneyLedgerTransaction,
  MoneyLedgerTransactionInput,
  MoneyProvider,
  MoneyReceiptReferenceInput,
  MoneyRuleVersion,
  MoneyRuleVersionInput
} from "@maiks-yt/domain";

export type MoneyAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type MoneyAdminLedgerFilters = {
  accountingFrom: string | null;
  accountingTo: string | null;
};

export type MoneyAdminListResult =
  | {
    ok: true;
    transactions: readonly MoneyLedgerTransaction[];
    warnings: readonly MoneyAccountingWarning[];
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminRuleListResult =
  | {
    ok: true;
    rules: readonly MoneyRuleVersion[];
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden";
  };

export type MoneyAdminMutationResult =
  | {
    ok: true;
    transaction: MoneyLedgerTransaction;
  }
  | {
    ok: false;
    reason:
      | "money_admin_user_unlinked"
      | "money_admin_forbidden"
      | "money_admin_invalid_input"
      | "money_admin_not_found";
  };

export type MoneyAdminRuleMutationResult =
  | {
    ok: true;
    rule: MoneyRuleVersion;
  }
  | {
    ok: false;
    reason:
      | "money_admin_user_unlinked"
      | "money_admin_forbidden"
      | "money_admin_invalid_input";
  };

export type MoneyAdminRuleImpactSuggestion = {
  ruleId: string;
  ruleKind: MoneyRuleVersion["ruleKind"];
  transactionId: string;
  lineId: string;
  basisDate: string;
  sourceProvider: MoneyProvider | null;
  sourceAmountMinor: number;
  suggestedAmountMinor: number;
  currency: string | null;
  percentageBps: number | null;
  fixedAmountMinor: number | null;
  fixedCurrency: string | null;
  reason: string;
};

export type MoneyAdminRuleImpactPreview = {
  generatedAt: string;
  filters: MoneyAdminLedgerFilters;
  suggestionCount: number;
  totalSuggestedOutMinor: number;
  suggestions: readonly MoneyAdminRuleImpactSuggestion[];
};

export type MoneyAdminRuleImpactPreviewResult =
  | {
    ok: true;
    preview: MoneyAdminRuleImpactPreview;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminRuleImpactDraftResult =
  | {
    ok: true;
    preview: MoneyAdminRuleImpactPreview;
    transactions: readonly MoneyLedgerTransaction[];
    createdSuggestionKeys: readonly string[];
    skippedSuggestionKeys: readonly string[];
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminWarningResolveResult =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason:
      | "money_admin_user_unlinked"
      | "money_admin_forbidden"
      | "money_admin_invalid_input";
  };

export type MoneyAdminCsvExport = {
  filename: string;
  contentType: "text/csv; charset=utf-8";
  csv: string;
  transactionCount: number;
  lineCount: number;
  generatedAt: string;
};

export type MoneyAdminWarningCsvExport = {
  filename: string;
  contentType: "text/csv; charset=utf-8";
  csv: string;
  warningCount: number;
  generatedAt: string;
};

export type MoneyAdminReceiptIndexEntry = {
  transactionId: string;
  lineId: string;
  referenceType: string;
  storageKind: string;
  label: string;
  privateReference: string;
  uploadId: string | null;
};

export type MoneyAdminReviewPackagePayload = {
  manifest: {
    generatedAt: string;
    accountingFrom: string | null;
    accountingTo: string | null;
    transactionCount: number;
    lineCount: number;
    warningCount: number;
    receiptReferenceCount: number;
    appliedRuleCount: number;
    includes: readonly string[];
    note: string;
  };
  summary: MoneyAdminJsonReport;
  ledgerCsv: string;
  warningsCsv: string;
  receiptIndex: readonly MoneyAdminReceiptIndexEntry[];
};

export type MoneyAdminReviewPackageExport = {
  filename: string;
  contentType: "application/json; charset=utf-8";
  json: string;
  generatedAt: string;
  transactionCount: number;
  lineCount: number;
  warningCount: number;
  receiptReferenceCount: number;
};

export type MoneyAdminReceiptUpload = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  reference: MoneyReceiptReferenceInput;
};

export type MoneyAdminReceiptDownload = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  bytes: Buffer;
};

export type MoneyAdminReportBucket = {
  key: string;
  inMinor: number;
  outMinor: number;
  neutralMinor: number;
  lineCount: number;
};

export type MoneyAdminJsonReport = {
  generatedAt: string;
  period: {
    accountingFrom: string | null;
    accountingTo: string | null;
    effectiveStart: string;
    effectiveEnd: string;
  };
  appliedRules: readonly MoneyRuleVersion[];
  counts: {
    transactions: number;
    lines: number;
    warnings: number;
    realPostedTransactions: number;
    draftTransactions: number;
    voidedTransactions: number;
  };
  totals: {
    realInMinor: number;
    realOutMinor: number;
    realRemainderMinor: number;
    allInMinor: number;
    allOutMinor: number;
    allRemainderMinor: number;
  };
  warningCounts: Record<string, number>;
  byTransactionType: readonly MoneyAdminReportBucket[];
  byMoneyMode: readonly MoneyAdminReportBucket[];
  byCategory: readonly MoneyAdminReportBucket[];
  bySourceProvider: readonly MoneyAdminReportBucket[];
};

export type MoneyAdminImportPreviewRowStatus = "ready" | "warning" | "skipped";

export type MoneyAdminImportPreviewRow = {
  rowNumber: number;
  status: MoneyAdminImportPreviewRowStatus;
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

export type MoneyAdminImportPreview = {
  generatedAt: string;
  filename: string | null;
  rowCount: number;
  rows: readonly MoneyAdminImportPreviewRow[];
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

export type MoneyAdminImportPreviewResult =
  | {
    ok: true;
    preview: MoneyAdminImportPreview;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminImportDraftResult =
  | {
    ok: true;
    preview: MoneyAdminImportPreview;
    transactions: readonly MoneyLedgerTransaction[];
    importedRowNumbers: readonly number[];
    skippedRowNumbers: readonly number[];
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminExportResult =
  | {
    ok: true;
    export: MoneyAdminCsvExport;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminWarningExportResult =
  | {
    ok: true;
    export: MoneyAdminWarningCsvExport;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminReceiptUploadResult =
  | {
    ok: true;
    upload: MoneyAdminReceiptUpload;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminReceiptDownloadResult =
  | {
    ok: true;
    download: MoneyAdminReceiptDownload;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input" | "money_admin_not_found";
  };

export type MoneyAdminJsonReportResult =
  | {
    ok: true;
    report: MoneyAdminJsonReport;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export type MoneyAdminReviewPackageExportResult =
  | {
    ok: true;
    export: MoneyAdminReviewPackageExport;
  }
  | {
    ok: false;
    reason: "money_admin_user_unlinked" | "money_admin_forbidden" | "money_admin_invalid_input";
  };

export interface MoneyAdminRepository {
  resolveActor(authUserId: string): Promise<MoneyAdminActor | null>;
  listTransactions(filters: MoneyAdminLedgerFilters): Promise<readonly MoneyLedgerTransaction[]>;
  listResolvedWarnings(targetIds: readonly string[]): Promise<readonly {
    targetKind: MoneyAccountingWarning["targetKind"];
    targetId: string;
    warningKind: MoneyAccountingWarning["warningKind"];
  }[]>;
  getTransaction(id: string): Promise<MoneyLedgerTransaction | null>;
  resolveWarning(input: {
    targetKind: MoneyAccountingWarning["targetKind"];
    targetId: string;
    warningKind: MoneyAccountingWarning["warningKind"];
    actorUserId: string;
  }): Promise<void>;
  recordReportExport(input: {
    reportKind: "accounting_summary" | "tax_review_export" | "warning_review";
    periodStart: string;
    periodEnd: string;
    filters: Record<string, unknown>;
    warningCounts: Record<string, number>;
    ruleVersionIds?: readonly string[];
    fileKind: "csv" | "none";
    fileReference: string | null;
    fileChecksum: string | null;
    generatedByUserId: string;
  }): Promise<void>;
  voidTransaction(input: {
    id: string;
    reason: string;
    actorUserId: string;
  }): Promise<MoneyLedgerTransaction | null>;
  postDraftTransaction(input: {
    id: string;
    note: string | null;
    actorUserId: string;
  }): Promise<MoneyLedgerTransaction | null>;
  createTransaction(input: MoneyLedgerTransactionInput & {
    actorUserId: string;
  }): Promise<MoneyLedgerTransaction>;
  listRuleVersions(): Promise<readonly MoneyRuleVersion[]>;
  createRuleVersion(input: MoneyRuleVersionInput & {
    actorUserId: string;
  }): Promise<MoneyRuleVersion>;
  listActiveRuleImpactSourceIds(sourceIds: readonly string[]): Promise<readonly string[]>;
  createRuleImpactDraftTransactions(input: {
    actorUserId: string;
    suggestions: readonly MoneyAdminRuleImpactSuggestion[];
  }): Promise<readonly MoneyLedgerTransaction[]>;
}
