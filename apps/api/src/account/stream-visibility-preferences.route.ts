import { streamVisibilityPreferenceScopes } from "@maiks-yt/domain/events";
import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { StreamVisibilityPreferencesService } from "./stream-visibility-preferences.service.js";
import { createStreamVisibilityPreferencesRepository } from "./stream-visibility-preferences-store.service.js";
import type {
  AccountAuthSession,
  StreamVisibilityPreferencesResult
} from "./stream-visibility-preferences.types.js";

type StreamVisibilityPreferencesRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<AccountAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<StreamVisibilityPreferencesService, "getPreferences" | "updatePreferences">;
};

const preferenceUpdateSchema = z.object({
  scope: z.enum(streamVisibilityPreferenceScopes),
  optedOut: z.boolean()
}).strict();

const preferenceUpdateRequestSchema = z.object({
  preferences: z.array(preferenceUpdateSchema).min(1).max(streamVisibilityPreferenceScopes.length)
}).strict();

const sendPreferenceResult = (
  result: StreamVisibilityPreferencesResult,
  reply: FastifyReply
): StreamVisibilityPreferencesResult => {
  if (result.ok) {
    return result;
  }

  reply.code(result.reason === "stream_visibility_preferences_unavailable" ? 503 : 400);
  return result;
};

export const registerStreamVisibilityPreferencesRoutes = (
  server: FastifyInstance,
  dependencies: StreamVisibilityPreferencesRouteDependencies
): void => {
  const getService = (): Pick<StreamVisibilityPreferencesService, "getPreferences" | "updatePreferences"> =>
    dependencies.createService?.()
    ?? new StreamVisibilityPreferencesService(
      createStreamVisibilityPreferencesRepository(dependencies.getDatabasePool())
    );

  server.get("/account/stream-visibility-preferences", async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    try {
      return sendPreferenceResult(await getService().getPreferences({
        authUser: session.user
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream visibility preference read failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_visibility_preferences_unavailable"
      };
    }
  });

  server.put("/account/stream-visibility-preferences", async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    const parsedBody = preferenceUpdateRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "stream_visibility_preferences_invalid_input"
      };
    }

    try {
      return sendPreferenceResult(await getService().updatePreferences({
        authUser: session.user,
        preferences: parsedBody.data.preferences
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Stream visibility preference update failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "stream_visibility_preferences_unavailable"
      };
    }
  });
};
