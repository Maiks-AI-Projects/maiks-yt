import type {
  MoneyAccountingWarning,
  MoneyLedgerTransaction,
  MoneyLedgerTransactionInput
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

export type MoneyAdminJsonReportResult =
  | {
    ok: true;
    report: MoneyAdminJsonReport;
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
  createTransaction(input: MoneyLedgerTransactionInput & {
    actorUserId: string;
  }): Promise<MoneyLedgerTransaction>;
}
