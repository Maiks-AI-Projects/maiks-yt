import type {
  MoneyAccountingWarning,
  MoneyLedgerTransaction,
  MoneyLedgerTransactionInput
} from "@maiks-yt/domain";
import { rm } from "node:fs/promises";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { registerMoneyAdminRoutes } from "../../src/money/money-admin.route.js";
import { MoneyAdminService } from "../../src/money/money-admin.service.js";
import type {
  MoneyAdminActor,
  MoneyAdminLedgerFilters,
  MoneyAdminRepository
} from "../../src/money/money-admin.types.js";

afterEach(async () => {
  await rm(".private", { force: true, recursive: true });
});

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
  public readonly resolvedWarnings: Array<Pick<MoneyAccountingWarning, "targetKind" | "targetId" | "warningKind">> = [];
  public exportAuditCount = 0;
  public lastExportAudit: Parameters<MoneyAdminRepository["recordReportExport"]>[0] | null = null;

  public async resolveActor(): Promise<MoneyAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listTransactions(filters: MoneyAdminLedgerFilters): Promise<readonly MoneyLedgerTransaction[]> {
    return structuredClone(this.transactions.filter((transaction) => {
      const accountingTime = Date.parse(transaction.accountingAt);

      return (!filters.accountingFrom || accountingTime >= Date.parse(filters.accountingFrom))
        && (!filters.accountingTo || accountingTime < Date.parse(filters.accountingTo));
    }));
  }

  public async getTransaction(id: string): Promise<MoneyLedgerTransaction | null> {
    const transaction = this.transactions.find((candidate) => candidate.id === id);

    return transaction ? structuredClone(transaction) : null;
  }

  public async listResolvedWarnings(): Promise<readonly Pick<MoneyAccountingWarning, "targetKind" | "targetId" | "warningKind">[]> {
    return structuredClone(this.resolvedWarnings);
  }

  public async resolveWarning(input: Parameters<MoneyAdminRepository["resolveWarning"]>[0]): Promise<void> {
    this.resolvedWarnings.push({
      targetKind: input.targetKind,
      targetId: input.targetId,
      warningKind: input.warningKind
    });
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

  public async voidTransaction(input: Parameters<MoneyAdminRepository["voidTransaction"]>[0]): Promise<MoneyLedgerTransaction | null> {
    const index = this.transactions.findIndex((transaction) => transaction.id === input.id);

    if (index < 0) {
      return null;
    }

    const current = this.transactions[index];
    const voidNote = `[voided] ${input.reason}`;
    const updated = {
      ...current,
      postingStatus: "voided" as const,
      notesPrivate: current.notesPrivate ? `${current.notesPrivate}\n${voidNote}` : voidNote,
      updatedAt: "2026-07-09T12:30:00.000Z"
    };
    this.transactions[index] = updated;

    return structuredClone(updated);
  }

  public async recordReportExport(input: Parameters<MoneyAdminRepository["recordReportExport"]>[0]): Promise<void> {
    this.exportAuditCount += 1;
    this.lastExportAudit = structuredClone(input);
  }
}

describe("MoneyAdminService", () => {
  it("filters ledger list and exports by accounting date", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "old-transaction",
      accountingAt: "2026-06-01T10:00:00.000Z",
      lines: [
        {
          id: "old-line",
          transactionId: "old-transaction",
          lineKind: "gross_income",
          direction: "in",
          amountMinor: 100,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: "old",
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-06-01T10:05:00.000Z"
        }
      ]
    }));
    const service = new MoneyAdminService(repository);

    const listResult = await service.listTransactions({
      authUserId: "auth-user",
      filters: {
        accountingFrom: "2026-07-01T00:00:00.000Z",
        accountingTo: "2026-08-01T00:00:00.000Z"
      }
    });

    expect(listResult).toMatchObject({
      ok: true,
      transactions: [
        {
          id: "transaction-1"
        }
      ]
    });
    expect(listResult.ok && listResult.transactions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "old-transaction"
      })
    ]));

    const exportResult = await service.exportLedgerCsv({
      authUserId: "auth-user",
      filters: {
        accountingFrom: "2026-07-01T00:00:00.000Z",
        accountingTo: "2026-08-01T00:00:00.000Z"
      }
    });

    expect(exportResult).toMatchObject({
      ok: true,
      export: {
        transactionCount: 1,
        lineCount: 1
      }
    });
    expect(exportResult.ok && exportResult.export.csv).toContain("transaction-1");
    expect(exportResult.ok && exportResult.export.csv).not.toContain("old-transaction");
    expect(repository.lastExportAudit).toMatchObject({
      filters: {
        accountingFrom: "2026-07-01T00:00:00.000Z",
        accountingTo: "2026-08-01T00:00:00.000Z"
      }
    });
  });

  it("rejects invalid accounting date windows", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    await expect(service.listTransactions({
      authUserId: "auth-user",
      filters: {
        accountingFrom: "2026-08-01T00:00:00.000Z",
        accountingTo: "2026-07-01T00:00:00.000Z"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "money_admin_invalid_input"
    });
  });

  it("exports private ledger lines as CSV and records an audit row", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "warning-transaction",
      transactionType: "cost",
      lines: [
        {
          id: "warning-line",
          transactionId: "warning-transaction",
          lineKind: "cost",
          direction: "out",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    const service = new MoneyAdminService(repository);

    const result = await service.exportLedgerCsv({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      export: {
        contentType: "text/csv; charset=utf-8",
        transactionCount: 2,
        lineCount: 2
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
      warningCounts: {
        missing_category: 1,
        missing_receipt: 1
      },
      generatedByUserId: "domain-user"
    });
  });

  it("exports unresolved accounting warnings as CSV and records warning-review audit", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "warning-transaction",
      transactionType: "cost",
      lines: [
        {
          id: "warning-line",
          transactionId: "warning-transaction",
          lineKind: "cost",
          direction: "out",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    repository.resolvedWarnings.push({
      targetKind: "line",
      targetId: "warning-line",
      warningKind: "missing_category"
    });
    const service = new MoneyAdminService(repository);

    const result = await service.exportWarningsCsv({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      export: {
        contentType: "text/csv; charset=utf-8",
        warningCount: 1
      }
    });
    expect(result.ok && result.export.csv).toContain("warning_id,warning_kind,severity,target_kind,target_id,message");
    expect(result.ok && result.export.csv).toContain("missing_receipt");
    expect(result.ok && result.export.csv).not.toContain("missing_category");
    expect(repository.lastExportAudit).toMatchObject({
      reportKind: "warning_review",
      fileKind: "csv",
      fileReference: expect.stringMatching(/^maiks-money-warnings-\d{4}-\d{2}-\d{2}\.csv$/),
      fileChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      warningCounts: {
        missing_receipt: 1
      },
      generatedByUserId: "domain-user"
    });
  });

  it("exports a private accounting review package with summary, CSVs, and receipt index", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "receipt-transaction",
      transactionType: "cost",
      lines: [
        {
          id: "receipt-line",
          transactionId: "receipt-transaction",
          lineKind: "cost",
          direction: "out",
          amountMinor: 1200,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: "hosting",
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: "receipt-reference",
          receiptReference: {
            id: "receipt-reference",
            referenceType: "receipt",
            storageKind: "future_upload",
            label: "Hosting receipt",
            privateReference: "money-upload:11111111-1111-4111-8111-111111111111:hosting.txt",
            createdByUserId: "domain-user",
            createdAt: "2026-07-09T10:05:00.000Z"
          },
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    const service = new MoneyAdminService(repository);

    const result = await service.exportReviewPackageJson({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      export: {
        contentType: "application/json; charset=utf-8",
        transactionCount: 2,
        lineCount: 2,
        receiptReferenceCount: 1
      }
    });

    if (!result.ok) {
      throw new Error("package export failed");
    }

    const payload = JSON.parse(result.export.json) as {
      manifest: {
        includes: string[];
        note: string;
      };
      summary: {
        counts: {
          transactions: number;
          lines: number;
        };
      };
      ledgerCsv: string;
      warningsCsv: string;
      receiptIndex: Array<{
        lineId: string;
        uploadId: string | null;
      }>;
    };

    expect(payload.manifest.includes).toEqual(["summary", "ledgerCsv", "warningsCsv", "receiptIndex"]);
    expect(payload.manifest.note).toContain("not official tax advice");
    expect(payload.summary.counts).toMatchObject({
      transactions: 2,
      lines: 2
    });
    expect(payload.ledgerCsv).toContain("transaction_id,line_id,transaction_type");
    expect(payload.warningsCsv).toContain("warning_id,warning_kind,severity,target_kind,target_id,message");
    expect(payload.receiptIndex).toEqual([
      expect.objectContaining({
        lineId: "receipt-line",
        uploadId: "11111111-1111-4111-8111-111111111111"
      })
    ]);
    expect(repository.lastExportAudit).toMatchObject({
      reportKind: "tax_review_export",
      fileKind: "none",
      fileReference: expect.stringMatching(/^maiks-money-review-package-\d{4}-\d{2}-\d{2}\.json$/),
      fileChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      generatedByUserId: "domain-user"
    });
  });

  it("uploads private receipt evidence as a future-upload reference", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    const result = await service.uploadReceiptEvidence({
      authUserId: "auth-user",
      filename: "../Hosting Invoice #1.pdf",
      contentType: "application/pdf",
      dataBase64: Buffer.from("%PDF receipt evidence").toString("base64"),
      label: "Hosting invoice"
    });

    expect(result).toMatchObject({
      ok: true,
      upload: {
        filename: "Hosting Invoice _1.pdf",
        contentType: "application/pdf",
        sizeBytes: 21,
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        reference: {
          referenceType: "receipt",
          storageKind: "future_upload",
          label: "Hosting invoice",
          privateReference: expect.stringMatching(/^money-upload:[a-f0-9-]{36}:Hosting Invoice _1\.pdf$/)
        }
      }
    });

    if (!result.ok) {
      throw new Error("upload failed");
    }

    const download = await service.downloadReceiptEvidence({
      authUserId: "auth-user",
      uploadId: result.upload.id
    });

    expect(download).toMatchObject({
      ok: true,
      download: {
        filename: "Hosting Invoice _1.pdf",
        contentType: "application/pdf",
        sizeBytes: 21
      }
    });
    expect(download.ok ? download.download.bytes.toString("utf8") : "").toBe("%PDF receipt evidence");
  });

  it("rejects unsupported private receipt uploads", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    await expect(service.uploadReceiptEvidence({
      authUserId: "auth-user",
      filename: "receipt.exe",
      contentType: "application/x-msdownload",
      dataBase64: Buffer.from("not a receipt").toString("base64")
    })).resolves.toEqual({
      ok: false,
      reason: "money_admin_invalid_input"
    });
  });

  it("builds a private JSON accounting summary and records an audit row", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "cost-transaction",
      transactionType: "cost",
      moneyMode: "real",
      sourceProvider: "kofi",
      lines: [
        {
          id: "cost-line",
          transactionId: "cost-transaction",
          lineKind: "cost",
          direction: "out",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    const service = new MoneyAdminService(repository);

    const result = await service.buildJsonReport({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      report: {
        counts: {
          transactions: 2,
          lines: 2,
          warnings: 2,
          realPostedTransactions: 2
        },
        totals: {
          realInMinor: 12345,
          realOutMinor: 500,
          realRemainderMinor: 11845,
          allInMinor: 12345,
          allOutMinor: 500,
          allRemainderMinor: 11845
        },
        warningCounts: {
          missing_category: 1,
          missing_receipt: 1
        },
        byCategory: expect.arrayContaining([
          expect.objectContaining({
            key: "uncategorized",
            outMinor: 500,
            lineCount: 1
          })
        ]),
        bySourceProvider: expect.arrayContaining([
          expect.objectContaining({
            key: "kofi",
            outMinor: 500
          })
        ])
      }
    });
    expect(repository.lastExportAudit).toMatchObject({
      reportKind: "accounting_summary",
      fileKind: "none",
      fileReference: null,
      fileChecksum: null,
      warningCounts: {
        missing_category: 1,
        missing_receipt: 1
      },
      generatedByUserId: "domain-user"
    });
  });

  it("surfaces derived accounting warnings on ledger listing", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "posted-estimate",
      postingStatus: "posted",
      lines: [
        {
          id: "posted-estimate-line",
          transactionId: "posted-estimate",
          lineKind: "gross_income",
          direction: "in",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: true,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    repository.transactions.push(createTransaction({
      id: "voided-warning-candidate",
      postingStatus: "voided",
      lines: [
        {
          id: "voided-warning-line",
          transactionId: "voided-warning-candidate",
          lineKind: "cost",
          direction: "out",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    const service = new MoneyAdminService(repository);

    const result = await service.listTransactions({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      warnings: expect.arrayContaining([
        expect.objectContaining({
          targetId: "posted-estimate-line",
          warningKind: "missing_category"
        }),
        expect.objectContaining({
          targetId: "posted-estimate-line",
          warningKind: "estimate_unconfirmed"
        })
      ])
    });
    expect(result.ok && result.warnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetId: "voided-warning-line"
      })
    ]));
  });

  it("marks derived accounting warnings resolved and suppresses them from later lists", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "warning-transaction",
      transactionType: "cost",
      lines: [
        {
          id: "warning-line",
          transactionId: "warning-transaction",
          lineKind: "cost",
          direction: "out",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
    const service = new MoneyAdminService(repository);

    await expect(service.resolveWarning({
      authUserId: "auth-user",
      targetKind: "line",
      targetId: "warning-line",
      warningKind: "missing_category"
    })).resolves.toEqual({
      ok: true
    });

    await expect(service.listTransactions({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true,
      warnings: [
        expect.objectContaining({
          targetId: "warning-line",
          warningKind: "missing_receipt"
        })
      ]
    });
    const listResult = await service.listTransactions({ authUserId: "auth-user" });

    expect(listResult.ok && listResult.warnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetId: "warning-line",
        warningKind: "missing_category"
      })
    ]));
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

  it("voids entries instead of deleting them", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    const result = await service.voidTransaction({
      authUserId: "auth-user",
      id: "transaction-1",
      reason: "Wrong amount entered"
    });

    expect(result).toMatchObject({
      ok: true,
      transaction: {
        id: "transaction-1",
        postingStatus: "voided",
        notesPrivate: expect.stringContaining("Wrong amount entered")
      }
    });
    await expect(service.listTransactions({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true,
      transactions: [
        {
          id: "transaction-1",
          postingStatus: "voided"
        }
      ]
    });
  });

  it("creates correction entries only for existing transactions", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    const result = await service.createTransaction({
      authUserId: "auth-user",
      transaction: {
        transactionType: "correction",
        moneyMode: "real",
        sourceKind: "correction",
        sourceProvider: null,
        postingStatus: "draft",
        occurredAt: "2026-07-09T12:00:00.000Z",
        accountingAt: "2026-07-09T12:00:00.000Z",
        correctsTransactionId: "transaction-1",
        correctionReason: "Missing platform fee",
        notesPrivate: null,
        lines: [
          {
            lineKind: "correction_delta",
            direction: "out",
            amountMinor: 123,
            currency: "EUR",
            valueSource: "eur",
            isEstimate: false,
            categoryKey: "correction",
            projectId: null,
            projectItemId: null,
            receiptReference: null,
            notesPrivate: null
          }
        ]
      }
    });

    expect(result).toMatchObject({
      ok: true,
      transaction: {
        transactionType: "correction",
        correctsTransactionId: "transaction-1",
        correctionReason: "Missing platform fee"
      }
    });

    await expect(service.createTransaction({
      authUserId: "auth-user",
      transaction: {
        transactionType: "correction",
        moneyMode: "real",
        sourceKind: "correction",
        sourceProvider: null,
        postingStatus: "draft",
        occurredAt: "2026-07-09T12:00:00.000Z",
        accountingAt: "2026-07-09T12:00:00.000Z",
        correctsTransactionId: "missing",
        correctionReason: "Missing row",
        notesPrivate: null,
        lines: [
          {
            lineKind: "correction_delta",
            direction: "out",
            amountMinor: 123,
            currency: "EUR",
            valueSource: "eur",
            isEstimate: false,
            categoryKey: "correction",
            projectId: null,
            projectItemId: null,
            receiptReference: null,
            notesPrivate: null
          }
        ]
      }
    })).resolves.toEqual({
      ok: false,
      reason: "money_admin_not_found"
    });
  });

  it("rejects empty void reasons and unknown transactions", async () => {
    const repository = new FakeMoneyAdminRepository();
    const service = new MoneyAdminService(repository);

    await expect(service.voidTransaction({
      authUserId: "auth-user",
      id: "transaction-1",
      reason: " "
    })).resolves.toEqual({
      ok: false,
      reason: "money_admin_invalid_input"
    });
    await expect(service.voidTransaction({
      authUserId: "auth-user",
      id: "missing",
      reason: "Wrong row"
    })).resolves.toEqual({
      ok: false,
      reason: "money_admin_not_found"
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

  it("exports a JSON report for an owner", async () => {
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
      url: "/admin/money/report.json"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toMatch(/maiks-money-summary-\d{4}-\d{2}-\d{2}\.json/);
    expect(response.headers["x-maiks-money-report-transactions"]).toBe("1");
    expect(response.json()).toMatchObject({
      counts: {
        transactions: 1,
        lines: 1
      },
      totals: {
        realInMinor: 12345,
        realOutMinor: 0
      }
    });
  });

  it("resolves accounting warnings for an owner", async () => {
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
      method: "POST",
      url: "/admin/money/warnings/resolve",
      payload: {
        targetKind: "line",
        targetId: "line-1",
        warningKind: "missing_category"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true
    });
    expect(repository.resolvedWarnings).toEqual([
      {
        targetKind: "line",
        targetId: "line-1",
        warningKind: "missing_category"
      }
    ]);
  });

  it("requires an auth session before voiding entries", async () => {
    const server = Fastify();
    registerMoneyAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/money/transactions/transaction-1/void",
      payload: {
        reason: "Mistake"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("voids entries for an owner", async () => {
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
      method: "POST",
      url: "/admin/money/transactions/transaction-1/void",
      payload: {
        reason: "Mistake during testing"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      transaction: {
        id: "transaction-1",
        postingStatus: "voided",
        notesPrivate: expect.stringContaining("Mistake during testing")
      }
    });
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

  it("returns downloadable warning CSV for an owner", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "warning-transaction",
      transactionType: "cost",
      lines: [
        {
          id: "warning-line",
          transactionId: "warning-transaction",
          lineKind: "cost",
          direction: "out",
          amountMinor: 500,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: null,
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-07-09T10:05:00.000Z"
        }
      ]
    }));
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
      url: "/admin/money/warnings.csv"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("maiks-money-warnings-");
    expect(response.headers["x-maiks-money-warning-count"]).toBe("2");
    expect(response.body).toContain("warning_id,warning_kind,severity,target_kind,target_id,message");
    expect(response.body).toContain("missing_category");
    expect(response.body).toContain("missing_receipt");
    expect(repository.lastExportAudit).toMatchObject({
      reportKind: "warning_review"
    });
  });

  it("returns a downloadable accounting review package for an owner", async () => {
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
      url: "/admin/money/review-package.json"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toContain("maiks-money-review-package-");
    expect(response.headers["x-maiks-money-package-transactions"]).toBe("1");
    expect(response.body).toContain("\"ledgerCsv\"");
    expect(response.body).toContain("\"warningsCsv\"");
    expect(response.body).toContain("\"receiptIndex\"");
    expect(repository.lastExportAudit).toMatchObject({
      reportKind: "tax_review_export",
      fileReference: expect.stringMatching(/^maiks-money-review-package-/)
    });
  });

  it("uploads and downloads private receipt evidence for an owner", async () => {
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

    const uploadResponse = await server.inject({
      method: "POST",
      url: "/admin/money/receipts/upload",
      payload: {
        filename: "receipt.txt",
        contentType: "text/plain",
        dataBase64: Buffer.from("private receipt").toString("base64")
      }
    });

    expect(uploadResponse.statusCode).toBe(200);
    const uploadPayload = uploadResponse.json<{
      ok: true;
      upload: {
        id: string;
        reference: {
          storageKind: string;
          privateReference: string;
        };
      };
    }>();
    expect(uploadPayload).toMatchObject({
      ok: true,
      upload: {
        reference: {
          storageKind: "future_upload",
          privateReference: expect.stringMatching(/^money-upload:/)
        }
      }
    });

    const downloadResponse = await server.inject({
      method: "GET",
      url: `/admin/money/receipts/${uploadPayload.upload.id}`
    });

    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("text/plain");
    expect(downloadResponse.headers["content-disposition"]).toContain("receipt.txt");
    expect(downloadResponse.body).toBe("private receipt");
  });

  it("does not allow unauthenticated receipt upload", async () => {
    const repository = new FakeMoneyAdminRepository();
    const server = Fastify();
    registerMoneyAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new MoneyAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/money/receipts/upload",
      payload: {
        filename: "receipt.txt",
        contentType: "text/plain",
        dataBase64: Buffer.from("private receipt").toString("base64")
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("applies accounting date query filters to list and export routes", async () => {
    const repository = new FakeMoneyAdminRepository();
    repository.transactions.push(createTransaction({
      id: "old-transaction",
      accountingAt: "2026-06-01T10:00:00.000Z",
      lines: [
        {
          id: "old-line",
          transactionId: "old-transaction",
          lineKind: "gross_income",
          direction: "in",
          amountMinor: 100,
          currency: "EUR",
          valueSource: "eur",
          isEstimate: false,
          categoryKey: "old",
          projectId: null,
          projectItemId: null,
          ruleVersionId: null,
          receiptReferenceId: null,
          receiptReference: null,
          notesPrivate: null,
          createdAt: "2026-06-01T10:05:00.000Z"
        }
      ]
    }));
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

    const query = "accountingFrom=2026-07-01T00%3A00%3A00.000Z&accountingTo=2026-08-01T00%3A00%3A00.000Z";
    const listResponse = await server.inject({
      method: "GET",
      url: `/admin/money/ledger?${query}`
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      ok: true,
      transactions: [
        {
          id: "transaction-1"
        }
      ]
    });
    expect(JSON.stringify(listResponse.json())).not.toContain("old-transaction");

    const exportResponse = await server.inject({
      method: "GET",
      url: `/admin/money/ledger.csv?${query}`
    });

    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.body).toContain("transaction-1");
    expect(exportResponse.body).not.toContain("old-transaction");
    expect(repository.lastExportAudit).toMatchObject({
      filters: {
        accountingFrom: "2026-07-01T00:00:00.000Z",
        accountingTo: "2026-08-01T00:00:00.000Z"
      }
    });
  });

  it("rejects invalid accounting date filters", async () => {
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
      url: "/admin/money/ledger?accountingFrom=not-a-date"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "money_admin_invalid_input"
    });
  });
});
