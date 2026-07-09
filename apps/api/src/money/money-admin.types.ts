import type {
  MoneyLedgerTransaction,
  MoneyLedgerTransactionInput
} from "@maiks-yt/domain";

export type MoneyAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type MoneyAdminListResult =
  | {
    ok: true;
    transactions: readonly MoneyLedgerTransaction[];
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
      | "money_admin_invalid_input";
  };

export interface MoneyAdminRepository {
  resolveActor(authUserId: string): Promise<MoneyAdminActor | null>;
  listTransactions(): Promise<readonly MoneyLedgerTransaction[]>;
  createTransaction(input: MoneyLedgerTransactionInput & {
    actorUserId: string;
  }): Promise<MoneyLedgerTransaction>;
}
