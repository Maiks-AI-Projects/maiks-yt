import type { MoneyLedgerTransaction, MoneyLedgerTransactionInput } from "@maiks-yt/domain";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerMoneyAdminRoutes } from "../../src/money/money-admin.route.js";
import { MoneyAdminService } from "../../src/money/money-admin.service.js";
import type {
  MoneyAdminActor,
  MoneyAdminRepository
} from "../../src/money/money-admin.types.js";

const createTransaction = (overrides: Partial<MoneyLedgerTransaction> = {}): MoneyLedgerTransaction => ({
  id: "transaction-1",
  transactionType: "income",
  moneyMode: "real",
  sourceKind: "manual",
  sourceProvider: "manual",
  sourceId: null,
  sourceEventId: null,
  postingStatus: "posted",
  occurredAt: "2026-07-09T10:00:00.000Z",
  accountingAt: "2026-07-09T10:00:00.000Z",
  correctsTransactionId: null,
  correctionReason: null,
  notesPrivate: "Monthly payout, first test",
  createdByUserId: "domain-user",
  createdAt: "2026-07-09T10:05:00.000Z",
  updatedAt: "2026-07-09T10:05:00.000Z",
  lines: [
    {
      id: "line-1",
      transactionId: "transaction-1",
      lineKind: "gross_income",
      direction: "in",
      amountMinor: 12345,
      currency: "EUR",
      valueSource: "eur",
      isEstimate: false,
      categoryKey: "support,manual",
      projectId: null,
      projectItemId: null,
      ruleVersionId: null,
      receiptReferenceId: null,
      receiptReference: null,
      notesPrivate: "Line note with comma",
      createdAt: "2026-07-09T10:05:00.000Z"
    }
  ],
  ...overrides
});

class FakeMoneyAdminRepository implements MoneyAdminRepository {
  public actor: MoneyAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly transactions: MoneyLedgerTransaction[] = [createTransaction()];
  public exportAuditCount = 0;
  public lastExportAudit: Parameters<MoneyAdminRepository["recordReportExport"]>[0] | null = null;

  public async resolveActor(): Promise<MoneyAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listTransactions(): Promise<readonly MoneyLedgerTransaction[]> {
    return structuredClone(this.transactions);
  }

  public async createTransaction(input: MoneyLedgerTransactionInput & {
    actorUserId: string;
  }): Promise<MoneyLedgerTransaction> {
    const transaction = createTransaction({
      id: "created-transaction",
      ...input,
      sourceId: null,
      sourceEventId: null,
      createdByUserId: input.actorUserId,
      createdAt: "2026-07-09T11:00:00.000Z",
      updatedAt: "2026-07-09T11:00:00.000Z",
      lines: input.lines.map((line, index) => ({
        ...line,
        id: `created-line-${index}`,
        transactionId: "created-transaction",
        ruleVersionId: null,
        receiptReferenceId: line.receiptReference ? `receipt-${index}` : null,
        receiptReference: line.receiptReference
          ? {
            id: `receipt-${index}`,
            ...line.receiptReference,
            createdByUserId: input.actorUserId,
            createdAt: "2026-07-09T11:00:00.000Z"
          }
          : null,
        createdAt: "2026-07-09T11:00:00.000Z"
      }))
    });
    this.transactions.unshift(transaction);

    return structuredClone(transaction);
  }

  public async recordReportExport(input: Parameters<MoneyAdminRepository["recordReportExport"]>[0]): Promise<void> {
    this.exportAuditCount += 1;
    this.lastExportAudit = structuredClone(input);
  }
}

describe("MoneyAdminService", () => {
  it("exports private ledger lines as CSV and records an audit row", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    const result = await service.exportLedgerCsv({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      export: {
        contentType: "text/csv; charset=utf-8",
        transactionCount: 1,
        lineCount: 1
      }
    });
    expect(result.ok && result.export.csv).toContain("transaction_id,line_id,transaction_type");
    expect(result.ok && result.export.csv).toContain("\"support,manual\"");
    expect(repository.exportAuditCount).toBe(1);
    expect(repository.lastExportAudit).toMatchObject({
      reportKind: "tax_review_export",
      fileKind: "csv",
      fileReference: expect.stringMatching(/^maiks-money-ledger-\d{4}-\d{2}-\d{2}\.csv$/),
      fileChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      generatedByUserId: "domain-user"
    });
  });

  it("creates manual entries with private receipt references", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    const result = await service.createTransaction({
      authUserId: "auth-user",
      transaction: {
        transactionType: "cost",
        moneyMode: "real",
        sourceKind: "manual",
        sourceProvider: "manual",
        postingStatus: "draft",
        occurredAt: "2026-07-09T12:00:00.000Z",
        accountingAt: "2026-07-09T12:00:00.000Z",
        correctsTransactionId: null,
        correctionReason: null,
        notesPrivate: null,
        lines: [
          {
            lineKind: "cost",
            direction: "out",
            amountMinor: 999,
            currency: "EUR",
            valueSource: "eur",
            isEstimate: false,
            categoryKey: "hosting",
            projectId: null,
            projectItemId: null,
            receiptReference: {
              referenceType: "invoice",
              storageKind: "external_url",
              label: " Hosting invoice ",
              privateReference: " https://example.test/invoice "
            },
            notesPrivate: null
          }
        ]
      }
    });

    expect(result).toMatchObject({
      ok: true,
      transaction: {
        lines: [
          {
            receiptReference: {
              referenceType: "invoice",
              storageKind: "external_url",
              label: "Hosting invoice",
              privateReference: "https://example.test/invoice"
            }
          }
        ]
      }
    });
  });

  it("denies CSV export without money permissions", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["creator-links:manage"]]
    };

    await expect(service.exportLedgerCsv({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "money_admin_forbidden"
    });
    expect(repository.exportAuditCount).toBe(0);
  });
});

describe("Money admin route boundary", () => {
  it("requires an auth session before exporting CSV", async () => {
    const server = Fastify();
    registerMoneyAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/money/ledger.csv"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns downloadable CSV for an owner", async () => {
    const repository = new FakeMoneyAdminRepository();
    const server = Fastify();
    registerMoneyAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new MoneyAdminService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/money/ledger.csv"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("maiks-money-ledger-");
    expect(response.body).toContain("transaction_id,line_id,transaction_type");
    expect(response.body).toContain("transaction-1,line-1,income");
    expect(repository.exportAuditCount).toBe(1);
  });
});
