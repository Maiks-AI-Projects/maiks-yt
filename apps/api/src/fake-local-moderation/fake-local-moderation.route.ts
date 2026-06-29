import type { DatabasePool } from "@maiks-yt/database";
import {
  fakeLocalModerationActions,
  validateFakeLocalModerationCommand
} from "@maiks-yt/domain/community";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { FakeLocalModerationService } from "./fake-local-moderation.service.js";
import { createFakeLocalModerationRepository } from "./fake-local-moderation-store.service.js";
import type { FakeLocalModerationRuntime } from "./fake-local-moderation.types.js";

type FakeLocalModerationAuthSession = {
  user: {
    id: string;
  };
} | null;

type FakeLocalModerationRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<FakeLocalModerationAuthSession>;
  getDatabasePool: () => DatabasePool;
  runtime: FakeLocalModerationRuntime;
  createService?: () => Pick<FakeLocalModerationService, "executeCommand" | "recordUnauthenticatedAttempt">;
};

const commandPayloadSchema = z.object({
  action: z.enum(fakeLocalModerationActions),
  targetMessageId: z.string().trim().min(1).max(191).nullable().optional(),
  targetAuthorName: z.string().trim().min(1).max(80).nullable().optional(),
  durationSeconds: z.number().int().min(1).max(3_600).nullable().optional(),
  note: z.string().trim().max(280).nullable().optional()
}).strict();

const getStatusCodeForReason = (reason: string): number => {
  if (reason === "fake_local_moderation_invalid_input") {
    return 400;
  }

  return 403;
};

export const registerFakeLocalModerationRoutes = (
  server: FastifyInstance,
  dependencies: FakeLocalModerationRouteDependencies
): void => {
  const getService = (): Pick<FakeLocalModerationService, "executeCommand" | "recordUnauthenticatedAttempt"> =>
    dependencies.createService?.()
    ?? new FakeLocalModerationService(
      createFakeLocalModerationRepository(dependencies.getDatabasePool()),
      dependencies.runtime
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FakeLocalModerationAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Fake/local moderation authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.post("/fake-local-chat/moderation/commands", async (request, reply) => {
    const parsedBody = commandPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "fake_local_moderation_invalid_input",
        source: "fake-local",
        providerAction: false
      };
    }

    const command = {
      ...parsedBody.data,
      targetMessageId: parsedBody.data.targetMessageId ?? null,
      targetAuthorName: parsedBody.data.targetAuthorName ?? null,
      durationSeconds: parsedBody.data.durationSeconds ?? null,
      note: parsedBody.data.note ?? null
    };
    const session = await getSession(request, reply);
    const service = getService();

    if (!session) {
      const validation = validateFakeLocalModerationCommand(command);

      try {
        const auditEntry = await service.recordUnauthenticatedAttempt(validation.command);

        return {
          ok: false,
          reason: reply.statusCode === 503 ? "fake_local_moderation_unavailable" : "not_authenticated",
          auditEntry,
          source: "fake-local",
          providerAction: false
        };
      } catch (error) {
        server.log.warn({ err: error }, "Fake/local moderation unauthenticated audit failed.");
        reply.code(503);
        return {
          ok: false,
          reason: "fake_local_moderation_unavailable",
          source: "fake-local",
          providerAction: false
        };
      }
    }

    try {
      const result = await service.executeCommand({
        authUserId: session.user.id,
        command
      });

      if (!result.ok) {
        reply.code(getStatusCodeForReason(result.reason));
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Fake/local moderation command failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "fake_local_moderation_unavailable",
        source: "fake-local",
        providerAction: false
      };
    }
  });
};
