import { createHash, randomUUID } from "node:crypto";

import { createRuntimeConfig } from "@maiks-yt/config";
import { createDatabasePool, type DatabasePool } from "@maiks-yt/database";
import { canUseUrlAccessToken, type UrlAccessSurface } from "@maiks-yt/domain/security";
import {
  DiscordChatReadOnlyIntakeService,
  TwitchChatReadOnlyIntakeService,
  type DiscordChatProjectedMessage,
  type TwitchChatProjectedMessage
} from "@maiks-yt/integrations";
import type {
  OverlayLiveMessage,
  OverlayFakeChatMessageReceivedEvent,
  RealtimeEvent,
  StreamerChatMessage
} from "@maiks-yt/events";
import { createStreamerChatMessageFromFakeLocal } from "@maiks-yt/events";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyRequest } from "fastify";
import { z } from "zod";

import { auth, configuredAuthProviderIds, getTrustedOrigins } from "./auth/better-auth.service.js";
import {
  getDomainUserForAuthUser,
  parseJsonArray,
  registerAccountDomainRoutes,
  registerStreamVisibilityPreferencesRoutes,
  type AuthSessionSnapshot
} from "./account/index.js";
import { registerActionPanelRoutes } from "./actions/index.js";
import {
  registerEventRoutingAdminRoutes,
  registerEventRoutingDispatchRoutes,
  type EventRoutingPlaybackPublisher
} from "./event-routing/index.js";
import { registerFakeLocalModerationRoutes } from "./fake-local-moderation/index.js";
import { registerCreatorLinkAdminRoutes, registerCreatorLinkReadRoutes } from "./links/index.js";
import { registerLiveHelperDashboardRoutes } from "./live-helper/index.js";
import { registerModeratorAdminRoutes } from "./moderators/index.js";
import {
  createNotificationAdminRepository,
  NotificationAdminService,
  registerNotificationAdminRoutes
} from "./notifications/index.js";
import { OverlayRuntime, registerOverlayRoutes } from "./overlay/index.js";
import { registerContentPageRoutes } from "./pages/index.js";
import {
  registerDiscordChatIntakeControlRoutes,
  registerProviderIntegrationStatusRoutes,
  registerTwitchChatIntakeControlRoutes,
  registerYouTubeOwnerConsentRoutes
} from "./provider-integrations/index.js";
import { registerProjectAdminRoutes, registerProjectReadRoutes } from "./projects/index.js";
import { registerStreamScheduleRoutes } from "./schedule/index.js";
import {
  InMemoryFakeLocalModerationRuntime,
  InMemoryStreamerChatModerationRuntime,
  registerStreamerChatControlRoutes,
  registerStreamerChatModerationRoutes,
  StreamerChatModerationAccessService,
  StreamerChatModerationStoreService,
  StreamerChatRuntime,
  type StreamerChatModerationAction
} from "./streamer-chat/index.js";
import { registerUrlAccessTokenAdminRoutes } from "./tokens/index.js";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });
let databasePool: DatabasePool | undefined;
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
const hashToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

type DevAuthTokenRow = {
  tokenId: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

type RealtimeSpikeEvent = {
  type: "realtime.spike.heartbeat" | "realtime.spike.echo";
  payload: {
    connectionId: string;
    id: string;
    sequence: number;
    sentAt: string;
    message: string;
    transport: "sse" | "websocket";
  };
};

interface RealtimeSpikeSocket {
  send: (message: string) => void;
  on(event: "message", listener: (message: { toString(): string }) => void): void;
  on(event: "close", listener: () => void): void;
}

const createRealtimeSpikeEvent = ({
  connectionId,
  sequence,
  transport,
  type = "realtime.spike.heartbeat",
  message = "Realtime spike heartbeat"
}: {
  connectionId: string;
  sequence: number;
  transport: RealtimeSpikeEvent["payload"]["transport"];
  type?: RealtimeSpikeEvent["type"];
  message?: string;
}): RealtimeSpikeEvent => ({
  type,
  payload: {
    connectionId,
    id: randomUUID(),
    sequence,
    sentAt: new Date().toISOString(),
    message,
    transport
  }
});

const validateUrlAccessTokenForRequest = async ({
  scope,
  surface,
  token
}: {
  scope: string;
  surface: UrlAccessSurface;
  token: string;
}): Promise<{ valid: boolean; requiresLogin: boolean; reason?: string }> => {
  const pool = getDatabasePool();
  const tokenHash = hashToken(token);
  const [tokenRows] = await pool.execute(
    "SELECT id, surface, scopes, requires_login AS requiresLogin, expires_at AS expiresAt, revoked_at AS revokedAt FROM url_access_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );
  const row = Array.isArray(tokenRows)
    ? tokenRows[0] as {
      id: string;
      surface: UrlAccessSurface;
      scopes: unknown;
      requiresLogin: number | boolean;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
    } | undefined
    : undefined;

  if (!row) {
    return {
      valid: false,
      requiresLogin: false,
      reason: "token_not_found"
    };
  }

  const tokenRecord = {
    id: row.id,
    surface: row.surface,
    scopes: parseJsonArray(row.scopes).filter((tokenScope): tokenScope is string => typeof tokenScope === "string"),
    requiresLogin: Boolean(row.requiresLogin)
  };
  const valid = canUseUrlAccessToken({
    ...tokenRecord,
    ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
    ...(row.revokedAt ? { revokedAt: row.revokedAt } : {})
  }, {
    surface,
    scope,
    now: new Date()
  });

  if (valid) {
    await pool.execute("UPDATE url_access_tokens SET last_used_at = NOW() WHERE id = ?", [row.id]);
  }

  return {
    valid,
    requiresLogin: Boolean(row.requiresLogin),
    ...(valid ? {} : { reason: "token_not_valid_for_scope" })
  };
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

const recordFakeLocalStreamerChatMessage = (
  event: OverlayFakeChatMessageReceivedEvent
): StreamerChatMessage | null => {
  if (streamerChatModerationRuntime.isActorBanned("fake-local", event.payload.authorName)) {
    return null;
  }

  const message = createStreamerChatMessageFromFakeLocal(event.payload);

  return appendStreamerChatMessage(message);
};

const recordTwitchStreamerChatMessage = (message: TwitchChatProjectedMessage): StreamerChatMessage =>
  appendStreamerChatMessage({ ...message });

const recordDiscordStreamerChatMessage = (message: DiscordChatProjectedMessage): StreamerChatMessage =>
  appendStreamerChatMessage({
    ...message,
    channelName: message.channelName
  });

const twitchChatIntakeRuntime = new TwitchChatReadOnlyIntakeService({
  onMessage: recordTwitchStreamerChatMessage,
  onReconnectSuppressed: createProviderReconnectSuppressedNotifier("twitch", "Twitch")
});
const discordChatIntakeRuntime = new DiscordChatReadOnlyIntakeService({
  onMessage: recordDiscordStreamerChatMessage,
  onReconnectSuppressed: createProviderReconnectSuppressedNotifier("discord", "Discord")
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

const getRequestOrigin = (request: FastifyRequest): string => {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;

  return `${protocol ?? "http"}://${request.headers.host}`;
};

const getBearerToken = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!authorizationValue?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationValue.slice("Bearer ".length).trim() || null;
};

const getDevAuthSession = async (request: FastifyRequest): Promise<AuthSessionSnapshot> => {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const pool = getDatabasePool();
  const [tokenRows] = await pool.execute(
    "SELECT dev_auth_tokens.id AS tokenId, auth_users.id AS userId, auth_users.name, auth_users.email, auth_users.image FROM dev_auth_tokens INNER JOIN auth_users ON auth_users.id = dev_auth_tokens.auth_user_id WHERE dev_auth_tokens.token_hash = ? AND dev_auth_tokens.revoked_at IS NULL AND dev_auth_tokens.expires_at > NOW() LIMIT 1",
    [tokenHash]
  );
  const tokenRow = Array.isArray(tokenRows)
    ? tokenRows[0] as DevAuthTokenRow | undefined
    : undefined;

  if (!tokenRow) {
    return null;
  }

  await pool.execute("UPDATE dev_auth_tokens SET last_used_at = NOW() WHERE id = ?", [tokenRow.tokenId]);

  return {
    user: {
      id: tokenRow.userId,
      name: tokenRow.name,
      email: tokenRow.email,
      image: tokenRow.image ?? null
    },
    session: {
      id: `dev-token:${tokenRow.tokenId}`,
      userId: tokenRow.userId
    }
  };
};

const getAuthSession = async (request: FastifyRequest): Promise<AuthSessionSnapshot> => {
  const sessionRequest = new Request(new URL("/auth/get-session", getRequestOrigin(request)), {
    method: "GET",
    headers: fromNodeHeaders(request.headers)
  });
  const sessionResponse = await auth.handler(sessionRequest);

  if (sessionResponse.ok) {
    const session = await sessionResponse.json() as AuthSessionSnapshot;

    if (session) {
      return session;
    }
  }

  return await getDevAuthSession(request);
};

const getDatabasePool = (): DatabasePool => {
  databasePool ??= createDatabasePool();
  return databasePool;
};
streamerChatModerationStore = new StreamerChatModerationStoreService(getDatabasePool);
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

registerActionPanelRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerStreamVisibilityPreferencesRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerAccountDomainRoutes(server, {
  configuredAuthProviderIds,
  getAuthSession,
  getDatabasePool
});
registerProjectReadRoutes(server, {
  getDatabasePool
});
registerCreatorLinkReadRoutes(server, {
  getDatabasePool
});
registerCreatorLinkAdminRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerProjectAdminRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerContentPageRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerStreamScheduleRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerUrlAccessTokenAdminRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerFakeLocalModerationRoutes(server, {
  getAuthSession,
  getDatabasePool,
  runtime: fakeLocalModerationRuntime
});
registerLiveHelperDashboardRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerModeratorAdminRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerEventRoutingAdminRoutes(server, {
  getAuthSession,
  getDatabasePool,
  publishPlayback: publishEventRoutingPlayback
});
registerNotificationAdminRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerProviderIntegrationStatusRoutes(server, {
  getAuthSession,
  getDatabasePool,
  getRuntimeState: () => ({
    discordChatIntakeState: discordChatIntakeRuntime.getStatus().state,
    twitchChatIntakeState: twitchChatIntakeRuntime.getStatus().state
  })
});
registerYouTubeOwnerConsentRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerTwitchChatIntakeControlRoutes(server, {
  getAuthSession,
  getDatabasePool,
  runtime: twitchChatIntakeRuntime
});
registerDiscordChatIntakeControlRoutes(server, {
  getAuthSession,
  getDatabasePool,
  runtime: discordChatIntakeRuntime
});
registerStreamerChatControlRoutes(server, {
  discordChatIntakeRuntime,
  streamerChatRuntime,
  twitchChatIntakeRuntime,
  validateUrlAccessToken: validateUrlAccessTokenForRequest
});
registerStreamerChatModerationRoutes(server, {
  accessService: streamerChatModerationAccessService,
  moderationRuntime: streamerChatModerationRuntime,
  moderationStore: streamerChatModerationStore,
  streamerChatRuntime
});
registerOverlayRoutes(server, {
  fakeLocalModerationRuntime,
  overlayRuntime,
  recordFakeLocalStreamerChatMessage,
  requireStreamerChatModerationPermission,
  validateUrlAccessToken: validateUrlAccessTokenForRequest
});
registerEventRoutingDispatchRoutes(server, {
  getDatabasePool,
  publishPlayback: publishEventRoutingPlayback
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

server.post<{ Body: RealtimeEvent }>("/events/test", async (request) => ({
  accepted: true,
  eventType: request.body.type
}));

server.get("/realtime/spike/sse", async (request, reply) => {
  const connectionId = randomUUID();
  let sequence = 0;

  server.log.info({ connectionId, transport: "sse" }, "Realtime spike connection opened.");
  reply.raw.writeHead(200, {
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "content-type": "text/event-stream",
    "x-accel-buffering": "no"
  });
  reply.hijack();

  const sendEvent = (): void => {
    sequence += 1;
    const event = createRealtimeSpikeEvent({
      connectionId,
      sequence,
      transport: "sse"
    });

    server.log.info({ connectionId, eventId: event.payload.id, sequence, transport: "sse" }, "Realtime spike event sent.");
    reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify(event)}\n\n`);
  };

  sendEvent();
  const interval = setInterval(sendEvent, 5_000);

  request.raw.on("close", () => {
    clearInterval(interval);
    server.log.info({ connectionId, sequence, transport: "sse" }, "Realtime spike connection closed.");
    reply.raw.end();
  });
});

server.get("/realtime/spike/ws", { websocket: true }, (socket: RealtimeSpikeSocket) => {
  const connectionId = randomUUID();
  let sequence = 0;

  server.log.info({ connectionId, transport: "websocket" }, "Realtime spike connection opened.");
  const sendEvent = (event: RealtimeSpikeEvent): void => {
    server.log.info(
      { connectionId, eventId: event.payload.id, sequence: event.payload.sequence, transport: "websocket" },
      "Realtime spike event sent."
    );
    socket.send(JSON.stringify(event));
  };
  const createNextEvent = (
    type?: RealtimeSpikeEvent["type"],
    message?: string
  ): RealtimeSpikeEvent => {
    sequence += 1;

    return createRealtimeSpikeEvent({
      connectionId,
      sequence,
      transport: "websocket",
      ...(type ? { type } : {}),
      ...(message ? { message } : {})
    });
  };
  const interval = setInterval(() => sendEvent(createNextEvent()), 5_000);

  sendEvent(createNextEvent());

  socket.on("message", (message: { toString(): string }) => {
    server.log.info({ connectionId, transport: "websocket" }, "Realtime spike message received.");
    sendEvent(createNextEvent("realtime.spike.echo", message.toString()));
  });
  socket.on("close", () => {
    clearInterval(interval);
    server.log.info({ connectionId, sequence, transport: "websocket" }, "Realtime spike connection closed.");
  });
});

const start = async (): Promise<void> => {
  await hydrateStreamerChatModerationRuntime();
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
