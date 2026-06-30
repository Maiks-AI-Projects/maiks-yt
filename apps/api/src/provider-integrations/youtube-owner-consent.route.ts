import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createYouTubeOwnerConsentRepository } from "./youtube-owner-consent-store.service.js";
import { YouTubeOwnerConsentService } from "./youtube-owner-consent.service.js";
import type { YouTubeOwnerConsentResult } from "./youtube-owner-consent.types.js";

type YouTubeOwnerConsentAuthSession = {
  user: {
    id: string;
  };
} | null;

type YouTubeOwnerConsentRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<YouTubeOwnerConsentAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<YouTubeOwnerConsentService, "getCredential" | "createConsentUrl" | "completeConsent" | "getAdminRedirectUrl">;
};

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  state: z.string().min(20).optional()
});

const isYouTubeOwnerConsentResult = (value: unknown): value is YouTubeOwnerConsentResult =>
  typeof value === "object"
  && value !== null
  && "ok" in value
  && typeof (value as { ok?: unknown }).ok === "boolean";

export const registerYouTubeOwnerConsentRoutes = (
  server: FastifyInstance,
  dependencies: YouTubeOwnerConsentRouteDependencies
): void => {
  const getService = (): Pick<YouTubeOwnerConsentService, "getCredential" | "createConsentUrl" | "completeConsent" | "getAdminRedirectUrl"> =>
    dependencies.createService?.()
    ?? new YouTubeOwnerConsentService(
      createYouTubeOwnerConsentRepository(dependencies.getDatabasePool())
    );

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<YouTubeOwnerConsentAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube owner consent authentication failed.");
      reply.code(503);
      return null;
    }
  };

  const runAuthenticated = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (service: Pick<YouTubeOwnerConsentService, "getCredential" | "createConsentUrl">, authUserId: string) => Promise<unknown>
  ): Promise<unknown> => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "youtube_oauth_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await run(getService(), session.user.id);

      if (isYouTubeOwnerConsentResult(result) && !result.ok) {
        reply.code(result.reason === "provider_integrations_forbidden" ? 403 : 400);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "YouTube owner consent request failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "youtube_oauth_unavailable"
      };
    }
  };

  server.get("/admin/provider-integrations/youtube/credential", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.getCredential({ authUserId }))
  );

  server.get("/admin/provider-integrations/youtube/consent-url", async (request, reply) =>
    runAuthenticated(request, reply, (service, authUserId) => service.createConsentUrl({ authUserId }))
  );

  server.get("/admin/provider-integrations/youtube/callback", async (request, reply) => {
    const parsed = callbackQuerySchema.safeParse(request.query);
    const service = getService();

    if (!parsed.success || parsed.data.error || !parsed.data.code || !parsed.data.state) {
      const redirectResult = {
        ok: false as const,
        reason: parsed.success && parsed.data.error ? "youtube_oauth_exchange_failed" as const : "youtube_oauth_state_invalid" as const
      };
      return reply.redirect(service.getAdminRedirectUrl(redirectResult));
    }

    try {
      const result = await service.completeConsent({
        code: parsed.data.code,
        state: parsed.data.state
      });

      return reply.redirect(service.getAdminRedirectUrl(result));
    } catch (error) {
      server.log.warn({ err: error }, "YouTube owner consent callback failed.");
      return reply.redirect(service.getAdminRedirectUrl({
        ok: false,
        reason: "youtube_oauth_exchange_failed"
      }));
    }
  });
};
