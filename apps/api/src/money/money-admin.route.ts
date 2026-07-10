import type { DatabasePool } from "@maiks-yt/database";
import {
  moneyAccountingWarningKinds,
  moneyDirections,
  moneyLedgerLineKinds,
  moneyModes,
  moneyPostingStatuses,
  moneyProviders,
  moneyReceiptReferenceTypes,
  moneyReceiptStorageKinds,
  moneyRuleDateBases,
  moneyRuleKinds,
  moneySourceKinds,
  moneyTransactionTypes,
  moneyValueSources
} from "@maiks-yt/domain";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { MoneyAdminService } from "./money-admin.service.js";
import { createMoneyAdminRepository } from "./money-admin-store.service.js";
import type { MoneyAdminMutationResult } from "./money-admin.types.js";

type MoneyAdminRouteService = Pick<
  MoneyAdminService,
  | "listTransactions"
  | "listRuleVersions"
  | "createRuleVersion"
  | "previewRuleImpact"
  | "createTransaction"
  | "exportLedgerCsv"
  | "buildJsonReport"
  | "exportWarningsCsv"
  | "exportReviewPackageJson"
  | "uploadReceiptEvidence"
  | "downloadReceiptEvidence"
  | "resolveWarning"
  | "voidTransaction"
  | "previewImportCsv"
  | "importCsvDrafts"
>;

type MoneyAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type MoneyAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<MoneyAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => MoneyAdminRouteService;
};

const nullableText = (maxLength: number) =>
  z.string().trim().max(maxLength).nullable().optional();

const moneyLedgerLinePayloadSchema = z.object({
  lineKind: z.enum(moneyLedgerLineKinds),
  direction: z.enum(moneyDirections),
  amountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z.string().trim().length(3).nullable().optional(),
  valueSource: z.enum(moneyValueSources),
  isEstimate: z.boolean().default(false),
  categoryKey: nullableText(80),
  projectId: nullableText(36),
  projectItemId: nullableText(36),
  receiptReference: z.object({
    referenceType: z.enum(moneyReceiptReferenceTypes),
    storageKind: z.enum(moneyReceiptStorageKinds),
    label: z.string().trim().min(1).max(191),
    privateReference: z.string().trim().min(1).max(1_024)
  }).strict().nullable().optional(),
  notesPrivate: nullableText(2_000)
}).strict();

const moneyTransactionPayloadSchema = z.object({
  transactionType: z.enum(moneyTransactionTypes),
  moneyMode: z.enum(moneyModes).default("real"),
  sourceKind: z.enum(moneySourceKinds).default("manual"),
  sourceProvider: z.enum(moneyProviders).nullable().optional(),
  postingStatus: z.enum(moneyPostingStatuses).default("draft"),
  occurredAt: z.string().trim().datetime({ offset: true }),
  accountingAt: z.string().trim().datetime({ offset: true }),
  correctsTransactionId: nullableText(36),
  correctionReason: nullableText(500),
  notesPrivate: nullableText(2_000),
  lines: z.array(moneyLedgerLinePayloadSchema).min(1).max(20)
}).strict();

const moneyRulePayloadSchema = z.object({
  ruleKind: z.enum(moneyRuleKinds),
  provider: z.enum(moneyProviders).nullable().optional(),
  valueSource: z.enum(moneyValueSources).nullable().optional(),
  appliesToDateBasis: z.enum(moneyRuleDateBases),
  effectiveFrom: z.string().trim().datetime({ offset: true }),
  effectiveUntil: z.string().trim().datetime({ offset: true }).nullable().optional(),
  percentageBps: z.number().int().min(0).max(10_000).nullable().optional(),
  fixedAmountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  fixedCurrency: z.string().trim().length(3).nullable().optional(),
  rulePayload: z.record(z.string(), z.unknown()).nullable().optional(),
  changeReason: z.string().trim().min(1).max(500),
  supersedesRuleId: nullableText(36)
}).strict();

const moneyVoidPayloadSchema = z.object({
  reason: z.string().trim().min(1).max(500)
}).strict();

const moneyWarningResolvePayloadSchema = z.object({
  targetKind: z.enum(["transaction", "line", "rule", "report"]),
  targetId: z.string().trim().min(1).max(36),
  warningKind: z.enum(moneyAccountingWarningKinds)
}).strict();

const moneyReceiptUploadPayloadSchema = z.object({
  filename: z.string().trim().min(1).max(191),
  contentType: z.string().trim().min(1).max(191),
  dataBase64: z.string().trim().min(1).max(7_000_000),
  label: z.string().trim().max(191).nullable().optional()
}).strict();

const moneyReceiptParamsSchema = z.object({
  id: z.string().trim().uuid()
}).strict();

const moneyImportPreviewPayloadSchema = z.object({
  filename: z.string().trim().max(191).nullable().optional(),
  csv: z.string().min(1).max(200_000)
}).strict();

const moneyLedgerFilterQuerySchema = z.object({
  accountingFrom: z.string().trim().datetime({ offset: true }).optional(),
  accountingTo: z.string().trim().datetime({ offset: true }).optional()
}).strict();

const sendMutationResult = (
  result: MoneyAdminMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "money_admin_not_found"
    ? 404
    : result.reason === "money_admin_user_unlinked"
      || result.reason === "money_admin_forbidden"
      ? 403
      : 400;

  reply.code(statusCode);
  return result;
};

export const registerMoneyAdminRoutes = (
  server: FastifyInstance,
  dependencies: MoneyAdminRouteDependencies
): void => {
  const getService = (): MoneyAdminRouteService =>
    dependencies.createService?.()
    ?? new MoneyAdminService(createMoneyAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (request: FastifyRequest, reply: FastifyReply): Promise<MoneyAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Money admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/money/rules", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listRuleVersions({
        authUserId: session.user.id
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money rule list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/rules", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = moneyRulePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().createRuleVersion({
        authUserId: session.user.id,
        rule: {
          ...parsedBody.data,
          provider: parsedBody.data.provider ?? null,
          valueSource: parsedBody.data.valueSource ?? null,
          effectiveUntil: parsedBody.data.effectiveUntil ?? null,
          percentageBps: parsedBody.data.percentageBps ?? null,
          fixedAmountMinor: parsedBody.data.fixedAmountMinor ?? null,
          fixedCurrency: parsedBody.data.fixedCurrency ?? null,
          rulePayload: parsedBody.data.rulePayload ?? null,
          supersedesRuleId: parsedBody.data.supersedesRuleId ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money rule create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/rule-impact", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const filters = moneyLedgerFilterQuerySchema.safeParse(request.query);

    if (!filters.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().previewRuleImpact({
        authUserId: session.user.id,
        filters: {
          accountingFrom: filters.data.accountingFrom ?? null,
          accountingTo: filters.data.accountingTo ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money rule impact preview failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/ledger", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const filters = moneyLedgerFilterQuerySchema.safeParse(request.query);

    if (!filters.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().listTransactions({
        authUserId: session.user.id,
        filters: {
          accountingFrom: filters.data.accountingFrom ?? null,
          accountingTo: filters.data.accountingTo ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money ledger list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/ledger.csv", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const filters = moneyLedgerFilterQuerySchema.safeParse(request.query);

    if (!filters.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().exportLedgerCsv({
        authUserId: session.user.id,
        filters: {
          accountingFrom: filters.data.accountingFrom ?? null,
          accountingTo: filters.data.accountingTo ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
        return result;
      }

      reply
        .header("content-type", result.export.contentType)
        .header("content-disposition", `attachment; filename="${result.export.filename}"`)
        .header("x-maiks-money-export-transactions", String(result.export.transactionCount))
        .header("x-maiks-money-export-lines", String(result.export.lineCount))
        .header("x-maiks-money-export-generated-at", result.export.generatedAt);

      return result.export.csv;
    } catch (error) {
      server.log.warn({ err: error }, "Money ledger CSV export failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/report.json", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const filters = moneyLedgerFilterQuerySchema.safeParse(request.query);

    if (!filters.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().buildJsonReport({
        authUserId: session.user.id,
        filters: {
          accountingFrom: filters.data.accountingFrom ?? null,
          accountingTo: filters.data.accountingTo ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
        return result;
      }

      const filename = `maiks-money-summary-${result.report.generatedAt.slice(0, 10)}.json`;

      reply
        .header("content-type", "application/json; charset=utf-8")
        .header("content-disposition", `attachment; filename="${filename}"`)
        .header("x-maiks-money-report-transactions", String(result.report.counts.transactions))
        .header("x-maiks-money-report-lines", String(result.report.counts.lines))
        .header("x-maiks-money-report-generated-at", result.report.generatedAt);

      return result.report;
    } catch (error) {
      server.log.warn({ err: error }, "Money JSON report export failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/review-package.json", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const filters = moneyLedgerFilterQuerySchema.safeParse(request.query);

    if (!filters.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().exportReviewPackageJson({
        authUserId: session.user.id,
        filters: {
          accountingFrom: filters.data.accountingFrom ?? null,
          accountingTo: filters.data.accountingTo ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
        return result;
      }

      reply
        .header("content-type", result.export.contentType)
        .header("content-disposition", `attachment; filename="${result.export.filename}"`)
        .header("x-maiks-money-package-transactions", String(result.export.transactionCount))
        .header("x-maiks-money-package-lines", String(result.export.lineCount))
        .header("x-maiks-money-package-warnings", String(result.export.warningCount))
        .header("x-maiks-money-package-receipts", String(result.export.receiptReferenceCount))
        .header("x-maiks-money-package-generated-at", result.export.generatedAt);

      return result.export.json;
    } catch (error) {
      server.log.warn({ err: error }, "Money review package export failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/warnings.csv", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const filters = moneyLedgerFilterQuerySchema.safeParse(request.query);

    if (!filters.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().exportWarningsCsv({
        authUserId: session.user.id,
        filters: {
          accountingFrom: filters.data.accountingFrom ?? null,
          accountingTo: filters.data.accountingTo ?? null
        }
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
        return result;
      }

      reply
        .header("content-type", result.export.contentType)
        .header("content-disposition", `attachment; filename="${result.export.filename}"`)
        .header("x-maiks-money-warning-count", String(result.export.warningCount))
        .header("x-maiks-money-warning-export-generated-at", result.export.generatedAt);

      return result.export.csv;
    } catch (error) {
      server.log.warn({ err: error }, "Money warning CSV export failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/receipts/upload", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = moneyReceiptUploadPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().uploadReceiptEvidence({
        authUserId: session.user.id,
        filename: parsedBody.data.filename,
        contentType: parsedBody.data.contentType,
        dataBase64: parsedBody.data.dataBase64,
        label: parsedBody.data.label ?? null
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money receipt upload failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.get("/admin/money/receipts/:id", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedParams = moneyReceiptParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().downloadReceiptEvidence({
        authUserId: session.user.id,
        uploadId: parsedParams.data.id
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_not_found" ? 404 : result.reason === "money_admin_invalid_input" ? 400 : 403);
        return result;
      }

      reply
        .header("content-type", result.download.contentType)
        .header("content-disposition", `attachment; filename="${result.download.filename}"`)
        .header("content-length", String(result.download.sizeBytes));

      return result.download.bytes;
    } catch (error) {
      server.log.warn({ err: error }, "Money receipt download failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/import-preview", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = moneyImportPreviewPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().previewImportCsv({
        authUserId: session.user.id,
        filename: parsedBody.data.filename ?? null,
        csv: parsedBody.data.csv
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money import preview failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/import-drafts", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = moneyImportPreviewPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().importCsvDrafts({
        authUserId: session.user.id,
        filename: parsedBody.data.filename ?? null,
        csv: parsedBody.data.csv
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money draft import failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/transactions", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = moneyTransactionPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(
        await getService().createTransaction({
          authUserId: session.user.id,
          transaction: {
            ...parsedBody.data,
            sourceProvider: parsedBody.data.sourceProvider ?? null,
            correctsTransactionId: parsedBody.data.correctsTransactionId ?? null,
            correctionReason: parsedBody.data.correctionReason ?? null,
            notesPrivate: parsedBody.data.notesPrivate ?? null,
            lines: parsedBody.data.lines.map((line) => ({
              ...line,
              currency: line.currency ?? null,
              categoryKey: line.categoryKey ?? null,
              projectId: line.projectId ?? null,
              projectItemId: line.projectItemId ?? null,
              receiptReference: line.receiptReference ?? null,
              notesPrivate: line.notesPrivate ?? null
            }))
          }
        }),
        reply
      );
    } catch (error) {
      server.log.warn({ err: error }, "Money transaction create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/warnings/resolve", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = moneyWarningResolvePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      const result = await getService().resolveWarning({
        authUserId: session.user.id,
        targetKind: parsedBody.data.targetKind,
        targetId: parsedBody.data.targetId,
        warningKind: parsedBody.data.warningKind
      });

      if (!result.ok) {
        reply.code(result.reason === "money_admin_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Money warning resolve failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });

  server.post("/admin/money/transactions/:id/void", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    const params = z.object({
      id: z.string().trim().min(1).max(36)
    }).safeParse(request.params);
    const parsedBody = moneyVoidPayloadSchema.safeParse(request.body);

    if (!params.success || !parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "money_admin_invalid_input"
      };
    }

    try {
      return sendMutationResult(
        await getService().voidTransaction({
          authUserId: session.user.id,
          id: params.data.id,
          reason: parsedBody.data.reason
        }),
        reply
      );
    } catch (error) {
      server.log.warn({ err: error }, "Money transaction void failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "money_admin_unavailable"
      };
    }
  });
};
