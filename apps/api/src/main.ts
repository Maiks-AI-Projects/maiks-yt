import { createHash, randomUUID } from "node:crypto";

import { createRuntimeConfig } from "@maiks-yt/config";
import { createDatabasePool, type DatabasePool } from "@maiks-yt/database";
import { canUseUrlAccessToken, type UrlAccessSurface } from "@maiks-yt/domain/security";
import type {
  OverlayLayoutKey,
  OverlayLiveMessage,
  OverlayNotificationDisplay,
  OverlaySceneDefinition,
  OverlaySceneKey,
  OverlayStateSnapshot,
  OverlayThemeKey,
  OverlayCenterNotificationTiming,
  OverlayRoutedNotificationQueuedEvent,
  OverlayTopBarNotificationQueuedEvent,
  RealtimeEvent
} from "@maiks-yt/events";
import { defaultThemeScenes, overlaySceneSlotIds } from "@maiks-yt/themes";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyRequest } from "fastify";
import { z } from "zod";

import { auth, configuredAuthProviderIds, getTrustedOrigins } from "./auth/better-auth.service.js";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });
let databasePool: DatabasePool | undefined;
const activeOverlayConnections = new Set<string>();
let overlayEmergencyCleanModeEnabled = false;
let overlayChatVisible = true;
let overlayTopBarEnabled = true;
let overlayCenterEnabled = true;
let overlayCenterDefaultTiming: OverlayCenterNotificationTiming = {
  onscreenMs: 4_000,
  fadeOutMs: 700,
  restMs: 1_500
};
const overlayLiveClients = new Map<string, {
  requestedLayout: OverlayLayoutKey;
  requestedMode: OverlayStateSnapshot["mode"];
  snapshot: OverlayStateSnapshot;
  socket: OverlayLiveSocket;
}>();
const overlaySceneDefinitions = new Map<string, OverlaySceneDefinition>(
  defaultThemeScenes.map((scene) => [`${scene.themeKey}:${scene.sceneKey}`, structuredClone(scene)])
);

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
const allowLoginRequestSchema = z.object({
  allowLogin: z.boolean()
});
const profileVisibilityRequestSchema = z.object({
  profileVisibility: z.enum(["private", "minimal", "public"])
});
const overlaySceneKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/);
const overlayStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema.default("default"),
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]).default("standard"),
  theme: z.enum(["default"]).default("default"),
  mode: z.enum(["normal", "clean"]).default("normal")
});
const overlayStatusRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const overlayTopBarTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  count: z.number().int().min(1).max(6).default(1)
});
const overlayTopBarEnabledRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean()
});
const overlayEmergencyCleanModeRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean()
});
const overlayChatVisibilityRequestSchema = z.object({
  accessToken: z.string().min(24),
  visible: z.boolean()
});
const overlayCenterSettingsRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean(),
  onscreenMs: z.number().int().min(1_000).max(20_000),
  fadeOutMs: z.number().int().min(100).max(5_000),
  restMs: z.number().int().min(0).max(10_000)
});
const overlayNotificationTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  route: z.enum(["top", "center"]),
  afterCenter: z.enum(["top", "none"]).default("top"),
  count: z.number().int().min(1).max(6).default(1)
});
const overlaySceneListRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const overlaySceneSlotSchema = z.object({
  x: z.number().int().min(0).max(1920),
  y: z.number().int().min(0).max(1080),
  width: z.number().int().min(0).max(1920),
  height: z.number().int().min(0).max(1080),
  visible: z.boolean(),
  lockedAspectRatio: z.number().positive().optional()
});
const overlaySceneSaveRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: z.object({
    themeKey: z.enum(["default"]),
    sceneKey: overlaySceneKeySchema,
    label: z.string().min(1).max(80),
    canvas: z.object({
      width: z.literal(1920),
      height: z.literal(1080)
    }),
    slots: z.record(z.enum(overlaySceneSlotIds), overlaySceneSlotSchema)
  })
});

const hashToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

type AuthSessionSnapshot = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  session: {
    id?: string;
    userId?: string;
  };
} | null;

type DevAuthTokenRow = {
  tokenId: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

type AuthAccountRow = {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  scope?: string | null;
  createdAt?: Date | null;
};

type DomainUserRow = {
  id: string;
  displayName: string;
  profileVisibility: string;
};

type LinkedAccountRow = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel?: string | null;
  audienceKey?: string | null;
  channelKey?: string | null;
  allowLogin: number | boolean;
  capabilities: unknown;
  verifiedAt?: Date | null;
  createdAt?: Date | null;
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

interface OverlayLiveSocket {
  close: (code?: number, reason?: string) => void;
  send: (message: string) => void;
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

const getOverlaySceneDefinition = (
  theme: OverlayThemeKey,
  scene: OverlaySceneKey
): OverlaySceneDefinition => {
  const sceneDefinition = overlaySceneDefinitions.get(`${theme}:${scene}`)
    ?? overlaySceneDefinitions.get("default:default");

  if (!sceneDefinition) {
    throw new Error("Default overlay scene is missing.");
  }

  return structuredClone(sceneDefinition);
};

const createOverlayStateSnapshot = ({
  layout,
  mode,
  scene,
  theme
}: {
  layout: OverlayLayoutKey;
  mode: OverlayStateSnapshot["mode"];
  scene: OverlaySceneKey;
  theme: OverlayThemeKey;
}): OverlayStateSnapshot => {
  const effectiveLayout = overlayEmergencyCleanModeEnabled ? "clean" : layout;
  const effectiveMode = overlayEmergencyCleanModeEnabled ? "clean" : mode;

  return {
    id: randomUUID(),
    scene,
    layout: effectiveLayout,
    theme,
    mode: effectiveMode,
    connectionStatus: "snapshot",
    sceneDefinition: getOverlaySceneDefinition(theme, scene),
    topBar: {
      enabled: overlayTopBarEnabled,
      quietHighlightIntervalMs: 18_000
    },
    center: {
      enabled: overlayCenterEnabled,
      defaultTiming: overlayCenterDefaultTiming
    },
    topNotification: null,
    centerNotification: null,
    slots: {
      camera: {
        id: "camera",
        visible: effectiveLayout !== "clean",
        label: "Camera"
      },
      chat: {
        id: "chat",
        visible: overlayChatVisible && effectiveLayout !== "clean" && scene !== "just-camera",
        label: "Chat"
      },
      sponsorPrimary: {
        id: "sponsor-primary",
        visible: effectiveMode !== "clean" && effectiveLayout !== "clean",
        label: "Sponsor"
      },
      sponsorSecondary: {
        id: "sponsor-secondary",
        visible: false,
        label: "Sponsor"
      },
      streamGoal: {
        id: "stream-goal",
        visible: effectiveMode !== "clean",
        label: "Stream goal"
      }
    },
    updatedAt: new Date().toISOString()
  };
};

const demoTopBarNotifications: Array<Omit<OverlayNotificationDisplay, "createdAt" | "id">> = [
  {
    actorName: "Yasmin",
    actionLabel: "followed",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "follow",
    platform: "twitch",
    priority: "normal"
  },
  {
    actorName: "Michael",
    actionLabel: "gifted 5 subs",
    avatarUrl: "https://yt3.ggpht.com/yti/ANjgQV8-placeholder=s88-c-k-c0x00ffffff-no-rj",
    kind: "gifted-sub",
    platform: "youtube",
    priority: "important"
  },
  {
    actorName: "MaiksMC Fan",
    actionLabel: "cheered 500 bits",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "bits",
    platform: "twitch",
    priority: "normal"
  },
  {
    actorName: "Top Supporter",
    actionLabel: "Donated €20",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  }
];

const demoCenterOnlyNotification: Omit<OverlayNotificationDisplay, "createdAt" | "id"> = {
  actorName: "Hydrate",
  actionLabel: "Take a drink",
  avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
  kind: "redeem",
  platform: "site",
  priority: "important"
};

const createDemoTopBarNotification = (index: number): OverlayTopBarNotificationQueuedEvent => ({
  type: "overlay.top-bar-notification.queued",
  payload: {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...demoTopBarNotifications[index % demoTopBarNotifications.length]!
  }
});

const createDemoRoutedNotification = (
  index: number,
  route: OverlayRoutedNotificationQueuedEvent["payload"]["route"],
  afterCenter: OverlayRoutedNotificationQueuedEvent["payload"]["afterCenter"]
): OverlayRoutedNotificationQueuedEvent => {
  const display: OverlayNotificationDisplay = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...(route === "center" && afterCenter === "none"
      ? demoCenterOnlyNotification
      : demoTopBarNotifications[index % demoTopBarNotifications.length]!)
  };

  return {
    type: "overlay.routed-notification.queued",
    payload: {
      ...display,
      route,
      afterCenter,
      ...(route === "center"
        ? {
          center: {
            title: display.actorName,
            message: display.actionLabel,
            imageUrl: display.avatarUrl,
            timing: overlayCenterDefaultTiming
          }
        }
        : {})
    }
  };
};

const broadcastOverlayMessage = (message: OverlayLiveMessage): void => {
  const serializedMessage = JSON.stringify(message);

  for (const client of overlayLiveClients.values()) {
    client.socket.send(serializedMessage);
  }
};

const broadcastOverlaySnapshots = (): void => {
  for (const client of overlayLiveClients.values()) {
    const effectiveLayout = overlayEmergencyCleanModeEnabled ? "clean" : client.requestedLayout;
    const effectiveMode = overlayEmergencyCleanModeEnabled ? "clean" : client.requestedMode;

    client.snapshot = {
      ...client.snapshot,
      layout: effectiveLayout,
      mode: effectiveMode,
      topBar: {
        ...client.snapshot.topBar,
        enabled: overlayTopBarEnabled
      },
      center: {
        enabled: overlayCenterEnabled,
        defaultTiming: overlayCenterDefaultTiming
      },
      sceneDefinition: getOverlaySceneDefinition(client.snapshot.theme, client.snapshot.scene),
      slots: {
        ...client.snapshot.slots,
        camera: {
          ...client.snapshot.slots.camera,
          visible: effectiveLayout !== "clean"
        },
        chat: {
          ...client.snapshot.slots.chat,
          visible: overlayChatVisible && effectiveLayout !== "clean" && client.snapshot.scene !== "just-camera"
        },
        sponsorPrimary: {
          ...client.snapshot.slots.sponsorPrimary,
          visible: effectiveMode !== "clean" && effectiveLayout !== "clean"
        },
        streamGoal: {
          ...client.snapshot.slots.streamGoal,
          visible: effectiveMode !== "clean"
        }
      },
      updatedAt: new Date().toISOString()
    };
    client.socket.send(JSON.stringify({
      type: "overlay.state.snapshot",
      payload: client.snapshot
    } satisfies OverlayLiveMessage));
  }
};

const parseJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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

const getDomainUserForAuthUser = async (
  pool: DatabasePool,
  authUser: NonNullable<AuthSessionSnapshot>["user"],
  createMissing: boolean
): Promise<{ user: DomainUserRow | null; created: boolean }> => {
  const [linkRows] = await pool.execute(
    "SELECT auth_user_links.user_id AS userId, users.display_name AS displayName, users.profile_visibility AS profileVisibility FROM auth_user_links INNER JOIN users ON users.id = auth_user_links.user_id WHERE auth_user_links.auth_user_id = ? AND users.deleted_at IS NULL LIMIT 1",
    [authUser.id]
  );
  const existingLink = Array.isArray(linkRows)
    ? linkRows[0] as { userId: string; displayName: string; profileVisibility: string } | undefined
    : undefined;

  if (existingLink) {
    return {
      created: false,
      user: {
        id: existingLink.userId,
        displayName: existingLink.displayName,
        profileVisibility: existingLink.profileVisibility
      }
    };
  }

  if (!createMissing) {
    return {
      created: false,
      user: null
    };
  }

  const userId = randomUUID();
  const displayName = authUser.name ?? authUser.email ?? "Community Member";

  await pool.execute(
    "INSERT INTO users (id, display_name, profile_visibility, avatar_url) VALUES (?, ?, 'private', ?)",
    [userId, displayName, authUser.image ?? null]
  );
  await pool.execute(
    "INSERT INTO auth_user_links (id, auth_user_id, user_id) VALUES (?, ?, ?)",
    [randomUUID(), authUser.id, userId]
  );

  return {
    created: true,
    user: {
      id: userId,
      displayName,
      profileVisibility: "private"
    }
  };
};

const getDomainLinkedAccounts = async (pool: DatabasePool, userId: string): Promise<Array<{
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel: string | null;
  audienceKey: string | null;
  channelKey: string | null;
  allowLogin: boolean;
  capabilities: unknown[];
  verifiedAt: Date | null;
  createdAt: Date | null;
}>> => {
  const [linkedAccountRows] = await pool.execute(
    "SELECT id, provider, provider_account_id AS providerAccountId, display_name AS displayName, purpose_label AS purposeLabel, audience_key AS audienceKey, channel_key AS channelKey, allow_login AS allowLogin, capabilities, verified_at AS verifiedAt, created_at AS createdAt FROM linked_accounts WHERE user_id = ? ORDER BY provider, created_at",
    [userId]
  );

  return Array.isArray(linkedAccountRows)
    ? linkedAccountRows.map((account) => {
      const typedAccount = account as LinkedAccountRow;

      return {
        id: typedAccount.id,
        provider: typedAccount.provider,
        providerAccountId: typedAccount.providerAccountId,
        displayName: typedAccount.displayName,
        purposeLabel: typedAccount.purposeLabel ?? null,
        audienceKey: typedAccount.audienceKey ?? null,
        channelKey: typedAccount.channelKey ?? null,
        allowLogin: Boolean(typedAccount.allowLogin),
        capabilities: parseJsonArray(typedAccount.capabilities),
        verifiedAt: typedAccount.verifiedAt ?? null,
        createdAt: typedAccount.createdAt ?? null
      };
    })
    : [];
};

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

server.get("/identity/dev/creator", async (_request, reply) => {
  try {
    const pool = getDatabasePool();
    const creatorUserId = "00000000-0000-4000-8000-000000000001";
    const [userRows] = await pool.execute(
      "SELECT id, display_name AS displayName, profile_visibility AS profileVisibility FROM users WHERE id = ? AND deleted_at IS NULL",
      [creatorUserId]
    );
    const user = Array.isArray(userRows)
      ? userRows[0] as { id: string; displayName: string; profileVisibility: string } | undefined
      : undefined;

    if (!user) {
      reply.code(404);
      return {
        ok: false,
        reason: "creator_not_seeded"
      };
    }

    const [linkedAccountRows] = await pool.execute(
      "SELECT id, provider, display_name AS displayName, allow_login AS allowLogin, capabilities FROM linked_accounts WHERE user_id = ? ORDER BY provider",
      [creatorUserId]
    );
    const [roleRows] = await pool.execute(
      "SELECT roles.key, roles.name, roles.permissions FROM user_roles INNER JOIN roles ON roles.id = user_roles.role_id WHERE user_roles.user_id = ? ORDER BY roles.key",
      [creatorUserId]
    );

    return {
      ok: true,
      user,
      linkedAccounts: Array.isArray(linkedAccountRows)
        ? linkedAccountRows.map((account) => {
          const typedAccount = account as { id: string; provider: string; displayName: string; allowLogin: number | boolean; capabilities: unknown };

          return {
            id: typedAccount.id,
            provider: typedAccount.provider,
            displayName: typedAccount.displayName,
            allowLogin: Boolean(typedAccount.allowLogin),
            capabilities: parseJsonArray(typedAccount.capabilities)
          };
        })
        : [],
      roles: Array.isArray(roleRows)
        ? roleRows.map((role) => {
          const typedRole = role as { key: string; name: string; permissions: unknown };

          return {
            key: typedRole.key,
            name: typedRole.name,
            permissions: parseJsonArray(typedRole.permissions)
          };
        })
        : []
    };
  } catch (error) {
    server.log.warn({ err: error }, "Dev identity snapshot failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "identity_unavailable"
    };
  }
});

server.get("/auth/dev/status", async () => ({
  ok: true,
  authProvider: "better-auth",
  configuredProviders: configuredAuthProviderIds,
  domainIdentityModel: "maiks-linked-accounts"
}));

server.get("/account/session", async (request) => {
  return await getAuthSession(request);
});

server.get("/account/auth-accounts", async (request, reply) => {
  const session = await getAuthSession(request);

  if (!session) {
    reply.code(401);
    return {
      ok: false,
      reason: "not_authenticated"
    };
  }

  try {
    const pool = getDatabasePool();
    const [authAccountRows] = await pool.execute(
      "SELECT id, user_id AS userId, account_id AS accountId, provider_id AS providerId, scope, created_at AS createdAt, updated_at AS updatedAt FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
      [session.user.id]
    );
    const authAccounts = Array.isArray(authAccountRows)
      ? authAccountRows as Array<AuthAccountRow & { updatedAt?: Date | null }>
      : [];

    return authAccounts.map((account) => ({
      id: account.id,
      userId: account.userId,
      accountId: account.accountId,
      providerId: account.providerId,
      scopes: account.scope?.split(" ").filter((scope) => scope.length > 0) ?? [],
      createdAt: account.createdAt ?? null,
      updatedAt: account.updatedAt ?? null
    }));
  } catch (error) {
    server.log.warn({ err: error }, "Auth account list failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "auth_account_list_unavailable"
    };
  }
});

server.get("/account/domain", async (request, reply) => {
  const session = await getAuthSession(request);

  if (!session) {
    reply.code(401);
    return {
      ok: false,
      reason: "not_authenticated"
    };
  }

  try {
    const pool = getDatabasePool();
    const { user } = await getDomainUserForAuthUser(pool, session.user, false);

    return {
      ok: true,
      authUserId: session.user.id,
      domainUser: user,
      linkedAccounts: user ? await getDomainLinkedAccounts(pool, user.id) : [],
      needsSync: !user
    };
  } catch (error) {
    server.log.warn({ err: error }, "Domain account snapshot failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "domain_account_unavailable"
    };
  }
});

server.post("/account/domain/sync", async (request, reply) => {
  const session = await getAuthSession(request);

  if (!session) {
    reply.code(401);
    return {
      ok: false,
      reason: "not_authenticated"
    };
  }

  try {
    const pool = getDatabasePool();
    const { user, created: createdDomainUser } = await getDomainUserForAuthUser(pool, session.user, true);

    if (!user) {
      reply.code(500);
      return {
        ok: false,
        reason: "domain_user_not_created"
      };
    }

    const [authAccountRows] = await pool.execute(
      "SELECT id, user_id AS userId, account_id AS accountId, provider_id AS providerId, scope, created_at AS createdAt FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
      [session.user.id]
    );
    const authAccounts = Array.isArray(authAccountRows)
      ? authAccountRows as AuthAccountRow[]
      : [];
    let createdLinkedAccounts = 0;

    for (const authAccount of authAccounts) {
      const [existingRows] = await pool.execute(
        "SELECT id FROM linked_accounts WHERE provider = ? AND provider_account_id = ? LIMIT 1",
        [authAccount.providerId, authAccount.accountId]
      );
      const existing = Array.isArray(existingRows) ? existingRows[0] : undefined;

      if (existing) {
        continue;
      }

      await pool.execute(
        "INSERT INTO linked_accounts (id, user_id, provider, provider_account_id, display_name, purpose_label, allow_login, capabilities, verified_at) VALUES (?, ?, ?, ?, ?, 'Login account', true, ?, NOW())",
        [
          randomUUID(),
          user.id,
          authAccount.providerId,
          authAccount.accountId,
          session.user.name ?? session.user.email ?? authAccount.providerId,
          JSON.stringify(["login"])
        ]
      );
      createdLinkedAccounts += 1;
    }

    return {
      ok: true,
      createdDomainUser,
      createdLinkedAccounts,
      domainUser: user,
      linkedAccounts: await getDomainLinkedAccounts(pool, user.id)
    };
  } catch (error) {
    server.log.warn({ err: error }, "Domain account sync failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "domain_account_sync_unavailable"
    };
  }
});

server.post<{ Params: { linkedAccountId: string } }>("/account/domain/linked-accounts/:linkedAccountId/allow-login", async (request, reply) => {
  const session = await getAuthSession(request);

  if (!session) {
    reply.code(401);
    return {
      ok: false,
      reason: "not_authenticated"
    };
  }

  const parsedRequest = allowLoginRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  try {
    const pool = getDatabasePool();
    const { user } = await getDomainUserForAuthUser(pool, session.user, false);

    if (!user) {
      reply.code(404);
      return {
        ok: false,
        reason: "domain_user_not_found"
      };
    }

    const [linkedAccountRows] = await pool.execute(
      "SELECT id, capabilities, allow_login AS allowLogin FROM linked_accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [request.params.linkedAccountId, user.id]
    );
    const linkedAccount = Array.isArray(linkedAccountRows)
      ? linkedAccountRows[0] as { id: string; capabilities: unknown; allowLogin: number | boolean } | undefined
      : undefined;

    if (!linkedAccount) {
      reply.code(404);
      return {
        ok: false,
        reason: "linked_account_not_found"
      };
    }

    const capabilities = parseJsonArray(linkedAccount.capabilities);
    const isLoginCapable = capabilities.includes("login");

    if (!parsedRequest.data.allowLogin && isLoginCapable && Boolean(linkedAccount.allowLogin)) {
      const [loginAccountRows] = await pool.execute(
        "SELECT id FROM linked_accounts WHERE user_id = ? AND allow_login = true AND JSON_CONTAINS(capabilities, JSON_QUOTE('login')) AND id <> ? LIMIT 1",
        [user.id, linkedAccount.id]
      );
      const hasOtherAllowedLoginAccount = Array.isArray(loginAccountRows) && loginAccountRows.length > 0;

      if (!hasOtherAllowedLoginAccount) {
        reply.code(409);
        return {
          ok: false,
          reason: "cannot_disable_last_login_account"
        };
      }
    }

    await pool.execute(
      "UPDATE linked_accounts SET allow_login = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
      [parsedRequest.data.allowLogin, linkedAccount.id, user.id]
    );

    return {
      ok: true,
      domainUser: user,
      linkedAccounts: await getDomainLinkedAccounts(pool, user.id)
    };
  } catch (error) {
    server.log.warn({ err: error }, "Allow-login update failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "allow_login_update_unavailable"
    };
  }
});

server.post("/account/domain/profile-visibility", async (request, reply) => {
  const session = await getAuthSession(request);

  if (!session) {
    reply.code(401);
    return {
      ok: false,
      reason: "not_authenticated"
    };
  }

  const parsedRequest = profileVisibilityRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  try {
    const pool = getDatabasePool();
    const { user } = await getDomainUserForAuthUser(pool, session.user, true);

    if (!user) {
      reply.code(500);
      return {
        ok: false,
        reason: "domain_user_not_created"
      };
    }

    await pool.execute(
      "UPDATE users SET profile_visibility = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [parsedRequest.data.profileVisibility, user.id]
    );

    return {
      ok: true,
      domainUser: {
        ...user,
        profileVisibility: parsedRequest.data.profileVisibility
      },
      linkedAccounts: await getDomainLinkedAccounts(pool, user.id)
    };
  } catch (error) {
    server.log.warn({ err: error }, "Profile visibility update failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "profile_visibility_update_unavailable"
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

server.get("/overlay/state", async (request, reply) => {
  const parsedRequest = overlayStateRequestSchema.safeParse(request.query);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "overlay",
    scope: "overlay:connect"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "overlay_access_denied"
    };
  }

  return {
    ok: true,
    snapshot: createOverlayStateSnapshot(parsedRequest.data)
  };
});

server.get("/overlay/status", async (request, reply) => {
  const parsedRequest = overlayStatusRequestSchema.safeParse(request.query);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  return {
    ok: true,
    activeOverlayConnections: activeOverlayConnections.size,
    overlayActive: activeOverlayConnections.size > 0,
    emergencyCleanModeEnabled: overlayEmergencyCleanModeEnabled,
    chatVisible: overlayChatVisible,
    topBarEnabled: overlayTopBarEnabled,
    centerEnabled: overlayCenterEnabled,
    centerDefaultTiming: overlayCenterDefaultTiming,
    checkedAt: new Date().toISOString()
  };
});

server.get("/overlay/scenes", async (request, reply) => {
  const parsedRequest = overlaySceneListRequestSchema.safeParse(request.query);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  return {
    ok: true,
    scenes: Array.from(overlaySceneDefinitions.values()).map((scene) => structuredClone(scene))
  };
});

server.post("/overlay/scenes/save", async (request, reply) => {
  const parsedRequest = overlaySceneSaveRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  const { scene } = parsedRequest.data;
  const missingSlot = overlaySceneSlotIds.find((slotId) => !scene.slots[slotId]);

  if (missingSlot) {
    reply.code(400);
    return {
      ok: false,
      reason: "scene_slot_missing",
      slotId: missingSlot
    };
  }

  const overflowingSlot = overlaySceneSlotIds.find((slotId) => {
    const slot = scene.slots[slotId];

    return slot.x + slot.width > scene.canvas.width || slot.y + slot.height > scene.canvas.height;
  });

  if (overflowingSlot) {
    reply.code(400);
    return {
      ok: false,
      reason: "scene_slot_outside_canvas",
      slotId: overflowingSlot
    };
  }

  overlaySceneDefinitions.set(`${scene.themeKey}:${scene.sceneKey}`, structuredClone(scene));
  broadcastOverlaySnapshots();

  return {
    ok: true,
    scene: structuredClone(scene),
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/center/settings", async (request, reply) => {
  const parsedRequest = overlayCenterSettingsRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  overlayCenterEnabled = parsedRequest.data.enabled;
  overlayCenterDefaultTiming = {
    onscreenMs: parsedRequest.data.onscreenMs,
    fadeOutMs: parsedRequest.data.fadeOutMs,
    restMs: parsedRequest.data.restMs
  };
  broadcastOverlaySnapshots();

  return {
    ok: true,
    centerEnabled: overlayCenterEnabled,
    centerDefaultTiming: overlayCenterDefaultTiming,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/top-bar/enabled", async (request, reply) => {
  const parsedRequest = overlayTopBarEnabledRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  overlayTopBarEnabled = parsedRequest.data.enabled;
  broadcastOverlaySnapshots();

  return {
    ok: true,
    topBarEnabled: overlayTopBarEnabled,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/emergency-clean-mode", async (request, reply) => {
  const parsedRequest = overlayEmergencyCleanModeRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  overlayEmergencyCleanModeEnabled = parsedRequest.data.enabled;
  broadcastOverlaySnapshots();

  return {
    ok: true,
    emergencyCleanModeEnabled: overlayEmergencyCleanModeEnabled,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/chat/visibility", async (request, reply) => {
  const parsedRequest = overlayChatVisibilityRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  overlayChatVisible = parsedRequest.data.visible;
  broadcastOverlaySnapshots();

  return {
    ok: true,
    chatVisible: overlayChatVisible,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/top-bar/test", async (request, reply) => {
  const parsedRequest = overlayTopBarTestRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  for (let index = 0; index < parsedRequest.data.count; index += 1) {
    setTimeout(() => {
      broadcastOverlayMessage(createDemoTopBarNotification(index));
    }, index * 500);
  }

  return {
    ok: true,
    queued: parsedRequest.data.count,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/notification/test", async (request, reply) => {
  const parsedRequest = overlayNotificationTestRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request"
    };
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return {
      ok: false,
      reason: tokenValidation.reason ?? "control_panel_access_denied"
    };
  }

  if (parsedRequest.data.route === "center" && !overlayCenterEnabled) {
    return {
      ok: true,
      queued: 0,
      route: "center",
      reason: "center_notifications_disabled",
      activeOverlayConnections: activeOverlayConnections.size
    };
  }

  const route = parsedRequest.data.route;

  for (let index = 0; index < parsedRequest.data.count; index += 1) {
    setTimeout(() => {
      broadcastOverlayMessage(createDemoRoutedNotification(index, route, parsedRequest.data.afterCenter));
    }, index * 500);
  }

  return {
    ok: true,
    queued: parsedRequest.data.count,
    route,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.get("/overlay/live", { websocket: true }, async (socket: OverlayLiveSocket, request) => {
  const parsedRequest = overlayStateRequestSchema.safeParse(request.query);

  if (!parsedRequest.success) {
    socket.close(1008, "invalid_request");
    return;
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "overlay",
    scope: "overlay:connect"
  });

  if (!tokenValidation.valid) {
    socket.close(1008, tokenValidation.reason ?? "overlay_access_denied");
    return;
  }

  const connectionId = randomUUID();
  activeOverlayConnections.add(connectionId);
  let snapshot = createOverlayStateSnapshot(parsedRequest.data);
  snapshot = {
    ...snapshot,
    connectionStatus: "live",
    updatedAt: new Date().toISOString()
  };
  overlayLiveClients.set(connectionId, {
    requestedLayout: parsedRequest.data.layout,
    requestedMode: parsedRequest.data.mode,
    snapshot,
    socket
  });

  const sendMessage = (message: OverlayLiveMessage): void => {
    socket.send(JSON.stringify(message));
  };
  const sendHeartbeat = (): void => {
    sendMessage({
      type: "overlay.connection.heartbeat",
      payload: {
        id: randomUUID(),
        sentAt: new Date().toISOString()
      }
    });
  };

  server.log.info({ connectionId, scene: snapshot.scene, layout: snapshot.layout }, "Overlay live connection opened.");
  sendMessage({
    type: "overlay.state.snapshot",
    payload: snapshot
  });
  const heartbeatInterval = setInterval(sendHeartbeat, 10_000);

  socket.on("close", () => {
    clearInterval(heartbeatInterval);
    activeOverlayConnections.delete(connectionId);
    overlayLiveClients.delete(connectionId);
    server.log.info({ connectionId }, "Overlay live connection closed.");
  });
});

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
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
