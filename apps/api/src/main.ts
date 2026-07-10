import { createRuntimeConfig } from "@maiks-yt/config";
import { createDatabasePool, type DatabasePool } from "@maiks-yt/database";
import {
  DiscordChatWarningDeliveryService,
  DiscordChatReadOnlyIntakeService,
  TwitchChatWarningDeliveryService,
  TwitchChatReadOnlyIntakeService,
  YouTubeLiveChatReadOnlyIntakeService,
  type DiscordGatewayProjectedEvent,
  type DiscordChatProjectedMessage,
  type TwitchChatProjectedMessage,
  type YouTubeLiveChatProjectedMessage
} from "@maiks-yt/integrations";
import type {
  OverlayLiveMessage,
  OverlayFakeChatMessageReceivedEvent,
  StreamerChatMessage
} from "@maiks-yt/events";
import { createStreamerChatMessageFromFakeLocal } from "@maiks-yt/events";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyRequest } from "fastify";
import { z } from "zod";

import { createApiAuthRuntime } from "./api-auth-runtime.service.js";
import { registerApplicationRoutes } from "./api-route-registration.service.js";
import { auth, getTrustedOrigins } from "./auth/better-auth.service.js";
import {
  getDomainUserForAuthUser,
} from "./account/index.js";
import type { EventRoutingPlaybackPublisher } from "./event-routing/index.js";
import {
  createNotificationAdminRepository,
  NotificationAdminService
} from "./notifications/index.js";
import { OverlayRuntime } from "./overlay/index.js";
import {
  createProviderEventIntakeLogRepository,
  createYouTubeLiveChatContextRepository,
  ProviderEventIntakeLogService
} from "./provider-integrations/index.js";
import {
  InMemoryFakeLocalModerationRuntime,
  InMemoryStreamerChatModerationRuntime,
  StreamerChatModerationAccessService,
  StreamerChatModerationStoreService,
  StreamerChatRuntime,
  type StreamerChatModerationAction
} from "./streamer-chat/index.js";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });
let databasePool: DatabasePool | undefined;
const getDatabasePool = (): DatabasePool => {
  databasePool ??= createDatabasePool();
  return databasePool;
};
const overlayRuntime = new OverlayRuntime();
const maxStreamerChatHistory = 75;
const streamerChatRuntime = new StreamerChatRuntime({ maxHistory: maxStreamerChatHistory });

await server.register(fastifyCors, {
  origin: getTrustedOrigins(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
});
await server.register(fastifyWebsocket);

const urlAccessTokenRequestSchema = z.object({
  token: z.string().min(24),
  surface: z.enum(["overlay", "control-panel", "admin", "api"]),
  scope: z.string().min(1)
});
type ProviderReconnectSuppressedStatus = {
  disconnectsInWindow: number;
  lastError: string | null;
};

const broadcastOverlayMessage = (message: OverlayLiveMessage): void => {
  overlayRuntime.broadcastMessage(message);
};

const streamerChatModerationRuntime = new InMemoryStreamerChatModerationRuntime({
  chatRuntime: streamerChatRuntime,
  publishOverlayMessage: broadcastOverlayMessage
});
let streamerChatModerationStore: StreamerChatModerationStoreService;

const hydrateStreamerChatModerationRuntime = async (): Promise<void> => {
  const rules = await streamerChatModerationStore.listRules();

  for (const rule of rules) {
    if (rule.kind === "message_hidden" && rule.messageId) {
      streamerChatModerationRuntime.hydrateHiddenMessage(rule.messageId, rule.authorName, rule.source, rule.appliedAt);
    }

    if (rule.kind === "author_banned") {
      streamerChatModerationRuntime.hydrateBannedActor(rule.authorName, rule.source, rule.appliedAt);
    }

    if (rule.kind === "author_warned" && typeof rule.count === "number") {
      streamerChatModerationRuntime.hydrateWarningCount(rule.authorName, rule.source, rule.count, rule.messageId, rule.appliedAt);
    }
  }
};

const fakeLocalModerationRuntime = new InMemoryFakeLocalModerationRuntime({
  chatRuntime: streamerChatRuntime,
  publishOverlayMessage: broadcastOverlayMessage
});

streamerChatRuntime.setVisibilityFilter((message) =>
  fakeLocalModerationRuntime.isMessageVisible(message)
  && streamerChatModerationRuntime.isMessageVisible(message)
);

const appendStreamerChatMessage = (message: StreamerChatMessage): StreamerChatMessage => {
  return streamerChatRuntime.appendMessage(message);
};

const providerEventIntakeLogService = new ProviderEventIntakeLogService({
  repository: createProviderEventIntakeLogRepository(getDatabasePool())
});

const writeProviderChatIntakeLog = (
  message: TwitchChatProjectedMessage | DiscordChatProjectedMessage | YouTubeLiveChatProjectedMessage
): void => {
  void providerEventIntakeLogService.recordChatMessage(message).then((result) => {
    if (!result.ok) {
      server.log.warn({ reason: result.reason, source: message.source }, "Provider chat intake ledger write failed.");
    }
  }).catch((error: unknown) => {
    server.log.warn({ err: error, source: message.source }, "Provider chat intake ledger write failed.");
  });
};

const writeProviderGatewayIntakeLog = (event: DiscordGatewayProjectedEvent): void => {
  void providerEventIntakeLogService.recordProviderEvent(event).then((result) => {
    if (!result.ok) {
      server.log.warn({ reason: result.reason, source: event.source, providerEventName: event.providerEventName }, "Provider Gateway intake ledger write failed.");
    }
  }).catch((error: unknown) => {
    server.log.warn({ err: error, source: event.source, providerEventName: event.providerEventName }, "Provider Gateway intake ledger write failed.");
  });
};

const recordFakeLocalStreamerChatMessage = (
  event: OverlayFakeChatMessageReceivedEvent
): StreamerChatMessage | null => {
  if (streamerChatModerationRuntime.isActorBanned("fake-local", event.payload.authorName)) {
    return null;
  }

  const message = createStreamerChatMessageFromFakeLocal(event.payload);

  return appendStreamerChatMessage(message);
};

const recordTwitchStreamerChatMessage = (message: TwitchChatProjectedMessage): StreamerChatMessage => {
  writeProviderChatIntakeLog(message);
  return appendStreamerChatMessage({
    ...message,
    providerChannelId: message.channelName,
    providerUserId: message.userName
  });
};

const recordDiscordStreamerChatMessage = (message: DiscordChatProjectedMessage): StreamerChatMessage => {
  writeProviderChatIntakeLog(message);
  return appendStreamerChatMessage({
    ...message,
    channelName: message.channelName,
    providerChannelId: message.channelId,
    providerGuildId: message.guildId,
    providerUserId: message.userId
  });
};

const recordYouTubeStreamerChatMessage = (message: YouTubeLiveChatProjectedMessage): StreamerChatMessage => {
  writeProviderChatIntakeLog(message);
  return appendStreamerChatMessage({ ...message });
};

const twitchChatIntakeRuntime = new TwitchChatReadOnlyIntakeService({
  onMessage: recordTwitchStreamerChatMessage,
  onReconnectSuppressed: createProviderReconnectSuppressedNotifier("twitch", "Twitch")
});
const discordChatIntakeRuntime = new DiscordChatReadOnlyIntakeService({
  onGatewayEvent: writeProviderGatewayIntakeLog,
  onMessage: recordDiscordStreamerChatMessage,
  onReconnectSuppressed: createProviderReconnectSuppressedNotifier("discord", "Discord")
});
const youtubeLiveChatContextRepository = createYouTubeLiveChatContextRepository(getDatabasePool());
const youtubeLiveChatIntakeRuntime = new YouTubeLiveChatReadOnlyIntakeService({
  contextResolver: youtubeLiveChatContextRepository.resolveSelectedLiveChatContext,
  onMessage: recordYouTubeStreamerChatMessage
});

if (process.env.NODE_ENV !== "test" && process.env.TWITCH_CHAT_AUTO_START !== "false") {
  setTimeout(() => {
    twitchChatIntakeRuntime.start();
  }, 0);
}
if (process.env.NODE_ENV !== "test" && process.env.DISCORD_CHAT_AUTO_START !== "false") {
  setTimeout(() => {
    discordChatIntakeRuntime.start();
  }, 0);
}
if (process.env.NODE_ENV !== "test" && process.env.YOUTUBE_LIVE_CHAT_AUTO_START !== "false") {
  setTimeout(() => {
    youtubeLiveChatIntakeRuntime.start();
  }, 0);
}
const {
  getAuthSession,
  validateUrlAccessTokenForRequest
} = createApiAuthRuntime({ getDatabasePool });
streamerChatModerationStore = new StreamerChatModerationStoreService(getDatabasePool);
const discordChatWarningDeliveryService = new DiscordChatWarningDeliveryService();
const twitchChatWarningDeliveryService = new TwitchChatWarningDeliveryService();
const streamerChatModerationAccessService = new StreamerChatModerationAccessService({
  getDatabasePool,
  validateUrlAccessToken: validateUrlAccessTokenForRequest,
  resolveDomainUserIdForRequest: async (request) => {
    const session = await getAuthSession(request);

    if (!session) {
      return {
        ok: false,
        statusCode: 401,
        reason: "not_authenticated"
      };
    }

    const { user } = await getDomainUserForAuthUser(getDatabasePool(), session.user, false);

    if (!user) {
      return {
        ok: false,
        statusCode: 403,
        reason: "streamer_chat_moderation_user_unlinked"
      };
    }

    return {
      ok: true,
      userId: user.id
    };
  }
});

const requireStreamerChatModerationPermission = async (
  request: FastifyRequest,
  accessToken: string,
  action: StreamerChatModerationAction
): Promise<{ ok: true } | { ok: false; reason: string; statusCode: 401 | 403 }> => {
  const access = await streamerChatModerationAccessService.requirePermission(request, accessToken, action);

  if (!access.ok) {
    return {
      ok: false,
      reason: access.reason,
      statusCode: access.statusCode
    };
  }

  return { ok: true };
};

const providerSuppressedNotificationKeys = new Set<string>();

function createProviderReconnectSuppressedNotifier(
  providerId: "twitch" | "discord",
  providerLabel: string
): (status: ProviderReconnectSuppressedStatus) => void {
  return (status) => {
    const notificationKey = `${providerId}:${status.disconnectsInWindow}`;

    if (providerSuppressedNotificationKeys.has(notificationKey)) {
      return;
    }

    providerSuppressedNotificationKeys.add(notificationKey);
    const safeError = status.lastError?.trim().slice(0, 240) || "No detailed error was reported.";

    void new NotificationAdminService(
      createNotificationAdminRepository(getDatabasePool())
    ).createSystemNotification({
      title: `${providerLabel} chat reconnect paused`,
      body: `${providerLabel} chat intake stopped auto-reconnecting after ${status.disconnectsInWindow} disconnects inside the reconnect window. Last safe error: ${safeError}`,
      severity: "warning",
      source: "provider",
      actionUrl: "/admin/provider-integrations"
    }).catch((error: unknown) => {
      server.log.warn({ err: error, providerId }, "Provider reconnect suppression notification failed.");
    });
  };
}

const publishEventRoutingPlayback: EventRoutingPlaybackPublisher = (projection) => {
  if (projection.destination === "top_notification" && !overlayRuntime.isTopBarEnabled()) {
    return {
      emitted: false,
      reason: "top_notifications_disabled",
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  }

  if (projection.destination === "center_notification" && !overlayRuntime.isCenterEnabled()) {
    return {
      emitted: false,
      reason: "center_notifications_disabled",
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  }

  overlayRuntime.broadcastMessage(projection.overlayEvent);

  return {
    emitted: true,
    activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
  };
};

registerApplicationRoutes({
  discordChatIntakeRuntime,
  discordChatWarningDeliveryService,
  fakeLocalModerationRuntime,
  getAuthSession,
  getDatabasePool,
  overlayRuntime,
  publishEventRoutingPlayback,
  providerEventIntakeLogService,
  recordFakeLocalStreamerChatMessage,
  requireStreamerChatModerationPermission,
  server,
  streamerChatModerationAccessService,
  streamerChatModerationRuntime,
  streamerChatModerationStore,
  streamerChatRuntime,
  twitchChatIntakeRuntime,
  twitchChatWarningDeliveryService,
  validateUrlAccessTokenForRequest,
  youtubeLiveChatIntakeRuntime
});

server.get("/health", async () => ({
  ok: true,
  surface: config.surface
}));

server.get("/health/database", async (_request, reply) => {
  try {
    const pool = getDatabasePool();
    const [rows] = await pool.query("SELECT DATABASE() AS databaseName");
    const firstRow = Array.isArray(rows)
      ? rows[0] as { databaseName?: string | null } | undefined
      : undefined;

    return {
      ok: true,
      surface: config.surface,
      database: firstRow?.databaseName ?? null
    };
  } catch (error) {
    server.log.warn({ err: error }, "Database health check failed.");
    reply.code(503);

    return {
      ok: false,
      surface: config.surface,
      reason: "database_unavailable"
    };
  }
});

server.route({
  method: ["GET", "POST"],
  url: "/auth/*",
  async handler(request, reply) {
    try {
      const forwardedProto = request.headers["x-forwarded-proto"];
      const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
      const requestUrl = new URL(request.url, `${protocol ?? "http"}://${request.headers.host}`);
      const body = request.method === "GET" || request.method === "HEAD"
        ? undefined
        : JSON.stringify(request.body ?? {});
      const authRequest = new Request(requestUrl.toString(), {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(body ? { body } : {})
      });
      const authResponse = await auth.handler(authRequest);

      reply.status(authResponse.status);
      authResponse.headers.forEach((value, key) => reply.header(key, value));

      return reply.send(authResponse.body ? await authResponse.text() : null);
    } catch (error) {
      server.log.error({ err: error }, "Authentication route failed.");
      reply.code(500);

      return {
        ok: false,
        reason: "auth_route_failed"
      };
    }
  }
});

server.post("/access/url-token/validate", async (request, reply) => {
  const parsedRequest = urlAccessTokenRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      valid: false,
      reason: "invalid_request"
    };
  }

  try {
    const validationResult = await validateUrlAccessTokenForRequest({
      token: parsedRequest.data.token,
      surface: parsedRequest.data.surface,
      scope: parsedRequest.data.scope
    });

    return {
      ok: true,
      valid: validationResult.valid,
      requiresLogin: validationResult.requiresLogin,
      ...(validationResult.reason ? { reason: validationResult.reason } : {})
    };
  } catch (error) {
    server.log.warn({ err: error }, "URL access token validation failed.");
    reply.code(503);

    return {
      ok: false,
      valid: false,
      reason: "token_validation_unavailable"
    };
  }
});

const start = async (): Promise<void> => {
  await hydrateStreamerChatModerationRuntime();
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
