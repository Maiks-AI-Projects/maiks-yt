import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  MoneyAccountingWarning,
  MoneyDirection,
  MoneyLedgerLine,
  MoneyLedgerLineKind,
  MoneyLedgerTransaction,
  MoneyMode,
  MoneyPostingStatus,
  MoneyProvider,
  MoneyReceiptReference,
  MoneyReceiptReferenceType,
  MoneyReceiptStorageKind,
  MoneyRuleDateBasis,
  MoneyRuleKind,
  MoneyRuleVersion,
  MoneySourceKind,
  MoneyTransactionType,
  MoneyValueSource
} from "@maiks-yt/domain";

import type { MoneyAdminActor, MoneyAdminRepository } from "./money-admin.types.js";
import type { MoneyAdminRuleImpactSuggestion } from "./money-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type MoneyTransactionRow = {
  id: string;
  transactionType: MoneyTransactionType;
  moneyMode: MoneyMode;
  sourceKind: MoneySourceKind;
  sourceProvider?: MoneyProvider | null;
  sourceId?: string | null;
  sourceEventId?: string | null;
  postingStatus: MoneyPostingStatus;
  occurredAt: Date | string;
  accountingAt: Date | string;
  correctsTransactionId?: string | null;
  correctionReason?: string | null;
  notesPrivate?: string | null;
  createdByUserId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type MoneyLineRow = {
  id: string;
  transactionId: string;
  lineKind: MoneyLedgerLineKind;
  direction: MoneyDirection;
  amountMinor: number | string;
  currency?: string | null;
  valueSource: MoneyValueSource;
  isEstimate: number | boolean;
  categoryKey?: string | null;
  projectId?: string | null;
  projectItemId?: string | null;
  ruleVersionId?: string | null;
  receiptReferenceId?: string | null;
  receiptReferenceType?: MoneyReceiptReferenceType | null;
  receiptStorageKind?: MoneyReceiptStorageKind | null;
  receiptLabel?: string | null;
  receiptPrivateReference?: string | null;
  receiptCreatedByUserId?: string | null;
  receiptCreatedAt?: Date | string | null;
  notesPrivate?: string | null;
  createdAt: Date | string;
};

type MoneyResolvedWarningRow = {
  targetKind: MoneyAccountingWarning["targetKind"];
  targetId: string;
  warningKind: MoneyAccountingWarning["warningKind"];
};

type MoneyRuleVersionRow = {
  id: string;
  ruleKind: MoneyRuleKind;
  provider?: MoneyProvider | null;
  valueSource?: MoneyValueSource | null;
  appliesToDateBasis: MoneyRuleDateBasis;
  effectiveFrom: Date | string;
  effectiveUntil?: Date | string | null;
  percentageBps?: number | string | null;
  fixedAmountMinor?: number | string | null;
  fixedCurrency?: string | null;
  rulePayload?: Record<string, unknown> | string | null;
  changeReason: string;
  supersedesRuleId?: string | null;
  createdByUserId?: string | null;
  createdAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toSqlTimestamp = (value: string): string =>
  new Date(value).toISOString().slice(0, 19).replace("T", " ");

const toJsonString = (value: unknown): string =>
  JSON.stringify(value);

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const mapReceiptReference = (row: MoneyLineRow): MoneyReceiptReference | null => {
  if (!row.receiptReferenceId || !row.receiptReferenceType || !row.receiptStorageKind || !row.receiptLabel || !row.receiptPrivateReference || !row.receiptCreatedAt) {
    return null;
  }

  return {
    id: row.receiptReferenceId,
    referenceType: row.receiptReferenceType,
    storageKind: row.receiptStorageKind,
    label: row.receiptLabel,
    privateReference: row.receiptPrivateReference,
    createdByUserId: row.receiptCreatedByUserId ?? null,
    createdAt: toIsoString(row.receiptCreatedAt)
  };
};

const mapLine = (row: MoneyLineRow): MoneyLedgerLine => ({
  id: row.id,
  transactionId: row.transactionId,
  lineKind: row.lineKind,
  direction: row.direction,
  amountMinor: Number(row.amountMinor),
  currency: row.currency ?? null,
  valueSource: row.valueSource,
  isEstimate: Boolean(row.isEstimate),
  categoryKey: row.categoryKey ?? null,
  projectId: row.projectId ?? null,
  projectItemId: row.projectItemId ?? null,
  ruleVersionId: row.ruleVersionId ?? null,
  receiptReferenceId: row.receiptReferenceId ?? null,
  receiptReference: mapReceiptReference(row),
  notesPrivate: row.notesPrivate ?? null,
  createdAt: toIsoString(row.createdAt)
});

const mapRuleVersion = (row: MoneyRuleVersionRow): MoneyRuleVersion => ({
  id: row.id,
  ruleKind: row.ruleKind,
  provider: row.provider ?? null,
  valueSource: row.valueSource ?? null,
  appliesToDateBasis: row.appliesToDateBasis,
  effectiveFrom: toIsoString(row.effectiveFrom),
  effectiveUntil: row.effectiveUntil ? toIsoString(row.effectiveUntil) : null,
  percentageBps: row.percentageBps === null || row.percentageBps === undefined ? null : Number(row.percentageBps),
  fixedAmountMinor: row.fixedAmountMinor === null || row.fixedAmountMinor === undefined ? null : Number(row.fixedAmountMinor),
  fixedCurrency: row.fixedCurrency ?? null,
  rulePayload: parseJsonObject(row.rulePayload),
  changeReason: row.changeReason,
  supersedesRuleId: row.supersedesRuleId ?? null,
  createdByUserId: row.createdByUserId ?? null,
  createdAt: toIsoString(row.createdAt)
});

const getRuleImpactSuggestionKey = (suggestion: MoneyAdminRuleImpactSuggestion): string =>
  `rule-impact:${suggestion.ruleId}:${suggestion.lineId}`;

const getRuleImpactLineKind = (suggestion: MoneyAdminRuleImpactSuggestion): MoneyLedgerLineKind => {
  if (suggestion.ruleKind === "platform_split") {
    return "platform_split";
  }

  if (suggestion.ruleKind === "payout_fee") {
    return "payout_fee";
  }

  if (suggestion.ruleKind === "currency_conversion_fee") {
    return "currency_conversion";
  }

  return "provider_fee";
};

const mapTransaction = (
  row: MoneyTransactionRow,
  lines: readonly MoneyLedgerLine[]
): MoneyLedgerTransaction => ({
  id: row.id,
  transactionType: row.transactionType,
  moneyMode: row.moneyMode,
  sourceKind: row.sourceKind,
  sourceProvider: row.sourceProvider ?? null,
  sourceId: row.sourceId ?? null,
  sourceEventId: row.sourceEventId ?? null,
  postingStatus: row.postingStatus,
  occurredAt: toIsoString(row.occurredAt),
  accountingAt: toIsoString(row.accountingAt),
  correctsTransactionId: row.correctsTransactionId ?? null,
  correctionReason: row.correctionReason ?? null,
  notesPrivate: row.notesPrivate ?? null,
  createdByUserId: row.createdByUserId ?? null,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
  lines
});

const selectTransactionFields = `
  id,
  transaction_type AS transactionType,
  money_mode AS moneyMode,
  source_kind AS sourceKind,
  source_provider AS sourceProvider,
  source_id AS sourceId,
  source_event_id AS sourceEventId,
  posting_status AS postingStatus,
  occurred_at AS occurredAt,
  accounting_at AS accountingAt,
  corrects_transaction_id AS correctsTransactionId,
  correction_reason AS correctionReason,
  notes_private AS notesPrivate,
  created_by_user_id AS createdByUserId,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const selectLineFields = `
  money_ledger_lines.id,
  money_ledger_lines.transaction_id AS transactionId,
  money_ledger_lines.line_kind AS lineKind,
  money_ledger_lines.direction,
  money_ledger_lines.amount_minor AS amountMinor,
  money_ledger_lines.currency,
  money_ledger_lines.value_source AS valueSource,
  money_ledger_lines.is_estimate AS isEstimate,
  money_ledger_lines.category_key AS categoryKey,
  money_ledger_lines.project_id AS projectId,
  money_ledger_lines.project_item_id AS projectItemId,
  money_ledger_lines.rule_version_id AS ruleVersionId,
  money_ledger_lines.receipt_reference_id AS receiptReferenceId,
  money_receipt_references.reference_type AS receiptReferenceType,
  money_receipt_references.storage_kind AS receiptStorageKind,
  money_receipt_references.label AS receiptLabel,
  money_receipt_references.private_reference AS receiptPrivateReference,
  money_receipt_references.created_by_user_id AS receiptCreatedByUserId,
  money_receipt_references.created_at AS receiptCreatedAt,
  money_ledger_lines.notes_private AS notesPrivate,
  money_ledger_lines.created_at AS createdAt
`;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<MoneyAdminActor | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      LEFT JOIN user_roles ON user_roles.user_id = users.id
      LEFT JOIN roles ON roles.id = user_roles.role_id
      WHERE auth_user_links.auth_user_id = ?
        AND users.deleted_at IS NULL
      ORDER BY roles.key
    `,
    [authUserId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const actorRows = rows as Array<{
    domainUserId: string;
    rolePermissions: unknown;
  }>;
  const domainUserId = actorRows[0]?.domainUserId;

  if (!domainUserId) {
    return null;
  }

  return {
    domainUserId,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

const readTransaction = async (
  executor: QueryExecutor,
  id: string
): Promise<MoneyLedgerTransaction> => {
  const [transactionRows] = await executor.execute(
    `
      SELECT ${selectTransactionFields}
      FROM money_ledger_transactions
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!Array.isArray(transactionRows) || transactionRows.length === 0) {
    throw new Error("money_transaction_reread_failed");
  }

  const [lineRows] = await executor.execute(
    `
      SELECT ${selectLineFields}
      FROM money_ledger_lines
      LEFT JOIN money_receipt_references ON money_receipt_references.id = money_ledger_lines.receipt_reference_id
      WHERE transaction_id = ?
      ORDER BY money_ledger_lines.created_at, money_ledger_lines.id
    `,
    [id]
  );

  return mapTransaction(
    transactionRows[0] as MoneyTransactionRow,
    Array.isArray(lineRows) ? (lineRows as MoneyLineRow[]).map(mapLine) : []
  );
};

const getTransaction = async (
  executor: QueryExecutor,
  id: string
): Promise<MoneyLedgerTransaction | null> => {
  try {
    return await readTransaction(executor, id);
  } catch (error) {
    if (error instanceof Error && error.message === "money_transaction_reread_failed") {
      return null;
    }

    throw error;
  }
};

export const createMoneyAdminRepository = (
  pool: DatabasePool
): MoneyAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listTransactions(filters) {
    const whereClauses: string[] = [];
    const params: string[] = [];

    if (filters.accountingFrom) {
      whereClauses.push("accounting_at >= ?");
      params.push(toSqlTimestamp(filters.accountingFrom));
    }

    if (filters.accountingTo) {
      whereClauses.push("accounting_at < ?");
      params.push(toSqlTimestamp(filters.accountingTo));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const [transactionRows] = await pool.execute(
      `
        SELECT ${selectTransactionFields}
        FROM money_ledger_transactions
        ${whereSql}
        ORDER BY accounting_at DESC, created_at DESC
        LIMIT 100
      `,
      params
    );

    if (!Array.isArray(transactionRows) || transactionRows.length === 0) {
      return [];
    }

    const transactions = transactionRows as MoneyTransactionRow[];
    const transactionIds = transactions.map((transaction) => transaction.id);
    const placeholders = transactionIds.map(() => "?").join(", ");
    const [lineRows] = await pool.execute(
      `
        SELECT ${selectLineFields}
        FROM money_ledger_lines
        LEFT JOIN money_receipt_references ON money_receipt_references.id = money_ledger_lines.receipt_reference_id
        WHERE transaction_id IN (${placeholders})
        ORDER BY money_ledger_lines.created_at, money_ledger_lines.id
      `,
      transactionIds
    );
    const linesByTransaction = new Map<string, MoneyLedgerLine[]>();

    for (const line of Array.isArray(lineRows) ? (lineRows as MoneyLineRow[]).map(mapLine) : []) {
      linesByTransaction.set(line.transactionId, [...(linesByTransaction.get(line.transactionId) ?? []), line]);
    }

    return transactions.map((transaction) =>
      mapTransaction(transaction, linesByTransaction.get(transaction.id) ?? [])
    );
  },

  async getTransaction(id) {
    return await getTransaction(pool, id);
  },

  async listRuleVersions() {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          rule_kind AS ruleKind,
          provider,
          value_source AS valueSource,
          applies_to_date_basis AS appliesToDateBasis,
          effective_from AS effectiveFrom,
          effective_until AS effectiveUntil,
          percentage_bps AS percentageBps,
          fixed_amount_minor AS fixedAmountMinor,
          fixed_currency AS fixedCurrency,
          rule_payload AS rulePayload,
          change_reason AS changeReason,
          supersedes_rule_id AS supersedesRuleId,
          created_by_user_id AS createdByUserId,
          created_at AS createdAt
        FROM money_rule_versions
        ORDER BY effective_from DESC, created_at DESC
        LIMIT 100
      `
    );

    return Array.isArray(rows) ? (rows as MoneyRuleVersionRow[]).map(mapRuleVersion) : [];
  },

  async createRuleVersion(input) {
    const ruleId = randomUUID();

    await pool.execute(
      `
        INSERT INTO money_rule_versions
          (id, rule_kind, provider, value_source, applies_to_date_basis, effective_from, effective_until,
            percentage_bps, fixed_amount_minor, fixed_currency, rule_payload, change_reason,
            supersedes_rule_id, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ruleId,
        input.ruleKind,
        input.provider,
        input.valueSource,
        input.appliesToDateBasis,
        toSqlTimestamp(input.effectiveFrom),
        input.effectiveUntil ? toSqlTimestamp(input.effectiveUntil) : null,
        input.percentageBps,
        input.fixedAmountMinor,
        input.fixedCurrency,
        input.rulePayload ? toJsonString(input.rulePayload) : null,
        input.changeReason,
        input.supersedesRuleId,
        input.actorUserId
      ]
    );

    const [rows] = await pool.execute(
      `
        SELECT
          id,
          rule_kind AS ruleKind,
          provider,
          value_source AS valueSource,
          applies_to_date_basis AS appliesToDateBasis,
          effective_from AS effectiveFrom,
          effective_until AS effectiveUntil,
          percentage_bps AS percentageBps,
          fixed_amount_minor AS fixedAmountMinor,
          fixed_currency AS fixedCurrency,
          rule_payload AS rulePayload,
          change_reason AS changeReason,
          supersedes_rule_id AS supersedesRuleId,
          created_by_user_id AS createdByUserId,
          created_at AS createdAt
        FROM money_rule_versions
        WHERE id = ?
        LIMIT 1
      `,
      [ruleId]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("money_rule_reread_failed");
    }

    return mapRuleVersion(rows[0] as MoneyRuleVersionRow);
  },

  async listActiveRuleImpactSourceIds(sourceIds) {
    if (sourceIds.length === 0) {
      return [];
    }

    const placeholders = sourceIds.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      `
        SELECT source_id AS sourceId
        FROM money_ledger_transactions
        WHERE source_kind = 'report'
          AND posting_status <> 'voided'
          AND source_id IN (${placeholders})
      `,
      [...sourceIds]
    );

    return Array.isArray(rows)
      ? (rows as Array<{ sourceId?: string | null }>).flatMap((row) => row.sourceId ? [row.sourceId] : [])
      : [];
  },

  async createRuleImpactDraftTransactions(input) {
    if (input.suggestions.length === 0) {
      return [];
    }

    const connection = await pool.getConnection();
    const transactionIds: string[] = [];

    try {
      await connection.beginTransaction();

      for (const suggestion of input.suggestions) {
        const transactionId = randomUUID();
        const sourceId = getRuleImpactSuggestionKey(suggestion);

        await connection.execute(
          `
            INSERT INTO money_ledger_transactions
              (id, transaction_type, money_mode, source_kind, source_provider, source_id,
                posting_status, occurred_at, accounting_at, notes_private, created_by_user_id)
            VALUES (?, 'fee', 'real', 'report', ?, ?, 'draft', ?, ?, ?, ?)
          `,
          [
            transactionId,
            suggestion.sourceProvider ?? "manual",
            sourceId,
            toSqlTimestamp(suggestion.basisDate),
            toSqlTimestamp(suggestion.basisDate),
            `Draft from dated rule ${suggestion.ruleId} for source line ${suggestion.lineId}. ${suggestion.reason}`,
            input.actorUserId
          ]
        );

        await connection.execute(
          `
            INSERT INTO money_ledger_lines
              (id, transaction_id, line_kind, direction, amount_minor, currency, value_source,
                is_estimate, category_key, rule_version_id, notes_private)
            VALUES (?, ?, ?, 'out', ?, ?, 'eur', true, ?, ?, ?)
          `,
          [
            randomUUID(),
            transactionId,
            getRuleImpactLineKind(suggestion),
            suggestion.suggestedAmountMinor,
            suggestion.currency ?? "EUR",
            suggestion.ruleKind.replaceAll("_", "-"),
            suggestion.ruleId,
            `Suggested by ${sourceId}. Source amount ${suggestion.sourceAmountMinor}.`
          ]
        );

        transactionIds.push(transactionId);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return await Promise.all(transactionIds.map((id) => readTransaction(pool, id)));
  },

  async listResolvedWarnings(targetIds) {
    if (targetIds.length === 0) {
      return [];
    }

    const placeholders = targetIds.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      `
        SELECT
          target_kind AS targetKind,
          target_id AS targetId,
          warning_kind AS warningKind
        FROM money_accounting_warnings
        WHERE status = 'resolved'
          AND target_id IN (${placeholders})
      `,
      [...targetIds]
    );

    return Array.isArray(rows) ? rows as MoneyResolvedWarningRow[] : [];
  },

  async resolveWarning(input) {
    const [result] = await pool.execute(
      `
        UPDATE money_accounting_warnings
        SET
          status = 'resolved',
          resolved_by_user_id = ?,
          resolved_at = CURRENT_TIMESTAMP
        WHERE target_kind = ?
          AND target_id = ?
          AND warning_kind = ?
      `,
      [
        input.actorUserId,
        input.targetKind,
        input.targetId,
        input.warningKind
      ]
    );
    const affectedRows = typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && typeof result.affectedRows === "number"
      ? result.affectedRows
      : 0;

    if (affectedRows > 0) {
      return;
    }

    await pool.execute(
      `
        INSERT INTO money_accounting_warnings
          (id, target_kind, target_id, warning_kind, severity, status, resolved_by_user_id, resolved_at)
        VALUES (?, ?, ?, ?, 'warning', 'resolved', ?, CURRENT_TIMESTAMP)
      `,
      [
        randomUUID(),
        input.targetKind,
        input.targetId,
        input.warningKind,
        input.actorUserId
      ]
    );
  },

  async createTransaction(input) {
    const connection = await pool.getConnection();
    const transactionId = randomUUID();

    try {
      await connection.beginTransaction();
      await connection.execute(
        `
          INSERT INTO money_ledger_transactions
            (id, transaction_type, money_mode, source_kind, source_provider, posting_status, occurred_at, accounting_at,
              corrects_transaction_id, correction_reason, notes_private, created_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          transactionId,
          input.transactionType,
          input.moneyMode,
          input.sourceKind,
          input.sourceProvider,
          input.postingStatus,
          toSqlTimestamp(input.occurredAt),
          toSqlTimestamp(input.accountingAt),
          input.correctsTransactionId,
          input.correctionReason,
          input.notesPrivate,
          input.actorUserId
        ]
      );

      for (const line of input.lines) {
        const receiptReferenceId = line.receiptReference ? randomUUID() : null;

        if (line.receiptReference && receiptReferenceId) {
          await connection.execute(
            `
              INSERT INTO money_receipt_references
                (id, reference_type, storage_kind, label, private_reference, created_by_user_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              receiptReferenceId,
              line.receiptReference.referenceType,
              line.receiptReference.storageKind,
              line.receiptReference.label,
              line.receiptReference.privateReference,
              input.actorUserId
            ]
          );
        }

        await connection.execute(
          `
            INSERT INTO money_ledger_lines
              (id, transaction_id, line_kind, direction, amount_minor, currency, value_source, is_estimate,
                category_key, project_id, project_item_id, receipt_reference_id, notes_private)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            transactionId,
            line.lineKind,
            line.direction,
            line.amountMinor,
            line.currency,
            line.valueSource,
            line.isEstimate,
            line.categoryKey,
            line.projectId,
            line.projectItemId,
            receiptReferenceId,
            line.notesPrivate
          ]
        );
      }

      await connection.commit();
      return await readTransaction(connection, transactionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async voidTransaction(input) {
    const voidNote = `[voided ${new Date().toISOString()} by ${input.actorUserId}] ${input.reason}`;
    await pool.execute(
      `
        UPDATE money_ledger_transactions
        SET
          posting_status = 'voided',
          notes_private = CASE
            WHEN notes_private IS NULL OR trim(notes_private) = '' THEN ?
            ELSE concat(notes_private, '\n', ?)
          END
        WHERE id = ?
          AND posting_status <> 'voided'
      `,
      [
        voidNote,
        voidNote,
        input.id
      ]
    );

    const [rows] = await pool.execute(
      `
        SELECT id
        FROM money_ledger_transactions
        WHERE id = ?
        LIMIT 1
      `,
      [input.id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    return await readTransaction(pool, input.id);
  },

  async recordReportExport(input) {
    await pool.execute(
      `
        INSERT INTO money_report_exports
          (id, report_kind, period_start, period_end, filters_json, rule_version_ids_json,
            warning_counts_json, file_kind, file_reference, file_checksum, generated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        input.reportKind,
        toSqlTimestamp(input.periodStart),
        toSqlTimestamp(input.periodEnd),
        toJsonString(input.filters),
        toJsonString(input.ruleVersionIds ?? []),
        toJsonString(input.warningCounts),
        input.fileKind,
        input.fileReference,
        input.fileChecksum,
        input.generatedByUserId
      ]
    );
  }
});
