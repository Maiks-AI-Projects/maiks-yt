import type { DatabasePool } from "@maiks-yt/database";
import { notificationSeverities, notificationSources } from "@maiks-yt/domain/notifications";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { NotificationAdminService } from "./notification-admin.service.js";
import { createNotificationAdminRepository } from "./notification-admin-store.service.js";
import type {
  NotificationCreateResult,
  NotificationStatusUpdateResult
} from "./notification-admin.types.js";

type NotificationAdminAuthSession = {
  user: {
    id: string;
  };
} | null;

type NotificationAdminRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<NotificationAdminAuthSession>;
  getDatabasePool: () => DatabasePool;
  createService?: () => Pick<NotificationAdminService,
    | "listNotifications"
    | "createSystemNotification"
    | "updateNotificationStatus"
    | "getPushConfig"
    | "registerPushSubscription"
    | "revokePushSubscription"
  >;
  getNodeEnv?: () => string | undefined;
  getDevNotificationSecret?: () => string | undefined;
};

const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) {
    return false;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}, z.boolean());

const listQuerySchema = z.object({
  includeArchived: booleanQuerySchema.default(false),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();

const notificationIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(36)
}).strict();

const notificationCreatePayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  severity: z.enum(notificationSeverities).default("info"),
  source: z.enum(notificationSources).default("system"),
  actionUrl: z.string().nullable().optional()
}).strict();

const pushSubscriptionPayloadSchema = z.object({
  endpoint: z.string().trim().min(1).max(4096),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(191),
    auth: z.string().trim().min(1).max(191)
  }).strict()
}).strict();

const pushRevokePayloadSchema = z.object({
  endpoint: z.string().trim().min(1).max(4096)
}).strict();

const sendStatusUpdateResult = (
  result: NotificationStatusUpdateResult,
  reply: FastifyReply
): NotificationStatusUpdateResult => {
  if (result.ok) {
    return result;
  }

  reply.code(result.reason === "notification_not_found" ? 404 : 403);
  return result;
};

const sendCreateResult = (
  result: NotificationCreateResult,
  reply: FastifyReply
): NotificationCreateResult => {
  if (!result.ok) {
    reply.code(400);
  }

  return result;
};

export const registerNotificationAdminRoutes = (
  server: FastifyInstance,
  dependencies: NotificationAdminRouteDependencies
): void => {
  const getService = (): Pick<NotificationAdminService,
    | "listNotifications"
    | "createSystemNotification"
    | "updateNotificationStatus"
    | "getPushConfig"
    | "registerPushSubscription"
    | "revokePushSubscription"
  > =>
    dependencies.createService?.()
    ?? new NotificationAdminService(createNotificationAdminRepository(dependencies.getDatabasePool()));

  const getSession = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<NotificationAdminAuthSession> => {
    try {
      const session = await dependencies.getAuthSession(request);

      if (!session) {
        reply.code(401);
        return null;
      }

      return session;
    } catch (error) {
      server.log.warn({ err: error }, "Notification admin authentication failed.");
      reply.code(503);
      return null;
    }
  };

  server.get("/admin/notifications", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "notification_unavailable" : "not_authenticated"
      };
    }

    const parsedQuery = listQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "notification_invalid_input"
      };
    }

    try {
      const result = await getService().listNotifications({
        authUserId: session.user.id,
        includeArchived: parsedQuery.data.includeArchived,
        limit: parsedQuery.data.limit
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Notification admin list failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "notification_unavailable"
      };
    }
  });

  server.get("/admin/notifications/push-config", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "notification_unavailable" : "not_authenticated"
      };
    }

    try {
      const result = await getService().getPushConfig({
        authUserId: session.user.id
      });

      if (!result.ok) {
        reply.code(403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Notification push config failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "notification_unavailable"
      };
    }
  });

  server.post("/admin/notifications/push-subscriptions", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "notification_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = pushSubscriptionPayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "notification_push_invalid_input"
      };
    }

    try {
      const result = await getService().registerPushSubscription({
        authUserId: session.user.id,
        subscription: {
          ...parsedBody.data,
          userAgent: Array.isArray(request.headers["user-agent"])
            ? request.headers["user-agent"][0] ?? null
            : request.headers["user-agent"] ?? null
        }
      });

      if (!result.ok) {
        reply.code(
          result.reason === "notification_push_invalid_input"
            ? 400
            : result.reason === "notification_push_unavailable"
              ? 503
              : 403
        );
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Notification push subscribe failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "notification_unavailable"
      };
    }
  });

  server.post("/admin/notifications/push-subscriptions/revoke", async (request, reply) => {
    const session = await getSession(request, reply);

    if (!session) {
      return {
        ok: false,
        reason: reply.statusCode === 503 ? "notification_unavailable" : "not_authenticated"
      };
    }

    const parsedBody = pushRevokePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "notification_push_invalid_input"
      };
    }

    try {
      const result = await getService().revokePushSubscription({
        authUserId: session.user.id,
        endpoint: parsedBody.data.endpoint
      });

      if (!result.ok) {
        reply.code(result.reason === "notification_push_invalid_input" ? 400 : 403);
      }

      return result;
    } catch (error) {
      server.log.warn({ err: error }, "Notification push revoke failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "notification_unavailable"
      };
    }
  });

  const registerStatusRoute = (method: "post" | "patch", status: "read" | "archived"): void => {
    server[method]<{ Params: { id: string } }>(
      `/admin/notifications/:id/${status === "read" ? "read" : "archive"}`,
      async (request, reply) => {
        const session = await getSession(request, reply);

        if (!session) {
          return {
            ok: false,
            reason: reply.statusCode === 503 ? "notification_unavailable" : "not_authenticated"
          };
        }

        const parsedParams = notificationIdParamsSchema.safeParse(request.params);

        if (!parsedParams.success) {
          reply.code(400);
          return {
            ok: false,
            reason: "notification_invalid_input"
          };
        }

        try {
          return sendStatusUpdateResult(await getService().updateNotificationStatus({
            authUserId: session.user.id,
            id: parsedParams.data.id,
            status
          }), reply);
        } catch (error) {
          server.log.warn({ err: error }, "Notification admin status update failed.");
          reply.code(503);
          return {
            ok: false,
            reason: "notification_unavailable"
          };
        }
      }
    );
  };

  registerStatusRoute("post", "read");
  registerStatusRoute("patch", "read");
  registerStatusRoute("post", "archived");
  registerStatusRoute("patch", "archived");

  server.post("/dev/notifications", async (request, reply) => {
    if ((dependencies.getNodeEnv?.() ?? process.env.NODE_ENV) === "production") {
      reply.code(404);
      return {
        ok: false,
        reason: "not_found"
      };
    }

    const configuredSecret = dependencies.getDevNotificationSecret?.() ?? process.env.DEV_NOTIFICATION_POST_SECRET;

    if (!configuredSecret) {
      reply.code(503);
      return {
        ok: false,
        reason: "notification_dev_secret_missing"
      };
    }

    const header = request.headers["x-dev-notification-secret"];
    const providedSecret = Array.isArray(header) ? header[0] : header;

    if (!providedSecret) {
      reply.code(401);
      return {
        ok: false,
        reason: "notification_dev_secret_missing"
      };
    }

    if (providedSecret !== configuredSecret) {
      reply.code(403);
      return {
        ok: false,
        reason: "notification_dev_secret_invalid"
      };
    }

    const parsedBody = notificationCreatePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "notification_invalid_input"
      };
    }

    try {
      return sendCreateResult(await getService().createSystemNotification({
        title: parsedBody.data.title,
        body: parsedBody.data.body,
        severity: parsedBody.data.severity,
        source: parsedBody.data.source,
        actionUrl: parsedBody.data.actionUrl ?? null
      }), reply);
    } catch (error) {
      server.log.warn({ err: error }, "Dev notification create failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "notification_unavailable"
      };
    }
  });
};
