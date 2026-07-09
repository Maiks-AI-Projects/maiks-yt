import {
  canManageMoneyLedger,
  isValidMoneyLedgerTransactionInput
} from "@maiks-yt/domain";
import type { MoneyLedgerTransactionInput } from "@maiks-yt/domain";

import type {
  MoneyAdminListResult,
  MoneyAdminMutationResult,
  MoneyAdminRepository
} from "./money-admin.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeMoneyPermissions = (rolePermissionValues: readonly unknown[]): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const normalizeNullableText = (value: string | null | undefined, maxLength: number): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
};

const normalizeCurrency = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 3) : null;
};

const normalizeInput = (input: MoneyLedgerTransactionInput): MoneyLedgerTransactionInput => ({
  transactionType: input.transactionType,
  moneyMode: input.moneyMode,
  sourceKind: input.sourceKind,
  sourceProvider: input.sourceProvider,
  postingStatus: input.postingStatus,
  occurredAt: input.occurredAt,
  accountingAt: input.accountingAt,
  correctsTransactionId: normalizeNullableText(input.correctsTransactionId, 36),
  correctionReason: normalizeNullableText(input.correctionReason, 500),
  notesPrivate: normalizeNullableText(input.notesPrivate, 2_000),
  lines: input.lines.map((line) => ({
    lineKind: line.lineKind,
    direction: line.direction,
    amountMinor: Math.trunc(line.amountMinor),
    currency: normalizeCurrency(line.currency),
    valueSource: line.valueSource,
    isEstimate: line.isEstimate,
    categoryKey: normalizeNullableText(line.categoryKey, 80),
    projectId: normalizeNullableText(line.projectId, 36),
    projectItemId: normalizeNullableText(line.projectItemId, 36),
    notesPrivate: normalizeNullableText(line.notesPrivate, 2_000)
  }))
});

export class MoneyAdminService {
  public constructor(private readonly repository: MoneyAdminRepository) {}

  public async listTransactions(input: { authUserId: string }): Promise<MoneyAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      transactions: await this.repository.listTransactions()
    };
  }

  public async createTransaction(input: {
    authUserId: string;
    transaction: MoneyLedgerTransactionInput;
  }): Promise<MoneyAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const transaction = normalizeInput(input.transaction);

    if (!isValidMoneyLedgerTransactionInput(transaction)) {
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    return {
      ok: true,
      transaction: await this.repository.createTransaction({
        ...transaction,
        actorUserId: actor.domainUserId
      })
    };
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true; domainUserId: string }
    | { ok: false; reason: "money_admin_user_unlinked" | "money_admin_forbidden" }
  > {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "money_admin_user_unlinked"
      };
    }

    if (!canManageMoneyLedger(normalizeMoneyPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "money_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}
