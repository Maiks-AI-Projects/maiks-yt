import type { DatabasePool } from "@maiks-yt/database";
import {
  moneyDirections,
  moneyLedgerLineKinds,
  moneyModes,
  moneyPostingStatuses,
  moneyProviders,
  moneyReceiptReferenceTypes,
  moneyReceiptStorageKinds,
  moneySourceKinds,
  moneyTransactionTypes,
  moneyValueSources
} from "@maiks-yt/domain";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { MoneyAdminService } from "./money-admin.service.js";
import { createMoneyAdminRepository } from "./money-admin-store.service.js";
import type { MoneyAdminMutationResult } from "./money-admin.types.js";

type MoneyAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type MoneyAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<MoneyAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<MoneyAdminService, "listTransactions" | "createTransaction" | "exportLedgerCsv">;
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

const sendMutationResult = (
  result: MoneyAdminMutationResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "money_admin_user_unlinked"
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
  const getService = (): Pick<MoneyAdminService, "listTransactions" | "createTransaction" | "exportLedgerCsv"> =>
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

  server.get("/admin/money/ledger", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "money_admin_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().listTransactions({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
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

    try {
      const result = await getService().exportLedgerCsv({ authUserId: session.user.id });

      if (!result.ok) {
        reply.code(403);
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
};
