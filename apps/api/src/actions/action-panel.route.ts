import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ActionPanelService } from "./action-panel.service.js";
import { createActionPanelRepository } from "./action-panel-store.service.js";
import type {
  ActionPanelDecisionResult,
  ActionPanelListResult
} from "./action-panel.types.js";

type ActionPanelAuthSession = {
  user: {
    id: string;
  };
} | null;

type ActionPanelRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<ActionPanelAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<ActionPanelService, "listActions" | "decideAction">;
};

const actionListQuerySchema = z.object({
  live: z.enum(["true", "false"]).optional()
}).strict();

const actionDecisionBodySchema = z.object({
  decision: z.enum(["approve", "reject", "defer"]),
  expectedStatus: z.enum(["open", "approved", "rejected", "deferred", "completed"]),
  note: z.string().max(1_000).optional()
}).strict();

const sendListResult = (
  result: ActionPanelListResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  reply.code(403);
  return result;
};

const sendDecisionResult = (
  result: ActionPanelDecisionResult,
  reply: FastifyReply
) => {
  if (result.ok) {
    return result;
  }

  const statusCode = result.reason === "action_panel_user_unlinked"
    || result.reason === "action_item_decision_forbidden"
    ? 403
    : result.reason === "action_item_not_found"
      ? 404
      : 409;

  reply.code(statusCode);
  return result;
};

export const registerActionPanelRoutes = (
  server: FastifyInstance,
  dependencies: ActionPanelRouteDependencies
): void => {
  const getService = (): Pick<ActionPanelService, "listActions" | "decideAction"> =>
    dependencies.createService?.()
    ?? new ActionPanelService(createActionPanelRepository(dependencies.getDatabasePool()));

  server.get("/actions", async (request, reply) => {
    let session: ActionPanelAuthSession;

    try {
      session = await dependencies.getAuthSession(request);
    } catch (error) {
      server.log.warn({ err: error }, "Action Panel authentication failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "action_panel_unavailable"
      };
    }

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    const parsedQuery = actionListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_action_query"
      };
    }

    try {
      return sendListResult(await getService().listActions({
        authUserId: session.user.id,
        live: parsedQuery.data.live === "true"
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Action Panel list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "action_panel_unavailable"
      };
    }
  });

  server.post<{ Params: { id: string } }>("/actions/:id/decision", async (request, reply) => {
    let session: ActionPanelAuthSession;

    try {
      session = await dependencies.getAuthSession(request);
    } catch (error) {
      server.log.warn({ err: error }, "Action Panel decision authentication failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "action_item_decision_unavailable"
      };
    }

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    const parsedBody = actionDecisionBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_action_decision_request"
      };
    }

    try {
      return sendDecisionResult(await getService().decideAction({
        authUserId: session.user.id,
        actionId: request.params.id,
        request: {
          decision: parsedBody.data.decision,
          expectedStatus: parsedBody.data.expectedStatus,
          ...(parsedBody.data.note === undefined ? {} : { note: parsedBody.data.note })
        }
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Action Panel decision failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "action_item_decision_unavailable"
      };
    }
  });
};
