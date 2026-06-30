import { createHash, randomUUID } from "node:crypto";

import { createRuntimeConfig } from "@maiks-yt/config";
import { createDatabasePool, type DatabasePool } from "@maiks-yt/database";
import { canUseUrlAccessToken, type UrlAccessSurface } from "@maiks-yt/domain/security";
import { TwitchChatReadOnlyIntakeService, type TwitchChatProjectedMessage } from "@maiks-yt/integrations";
import type {
  OverlayActiveGoalState,
  OverlayPresentationState,
  OverlayLayoutKey,
  OverlayLiveMessage,
  OverlayFakeChatMessageHiddenEvent,
  OverlayFakeChatMessageReceivedEvent,
  OverlayNotificationDisplay,
  OverlaySceneDefinition,
  OverlaySceneKey,
  OverlayStateSnapshot,
  OverlayThemeKey,
  OverlayCenterNotificationTiming,
  OverlayRoutedNotificationQueuedEvent,
  OverlayTopBarNotificationQueuedEvent,
  RealtimeEvent,
  StreamerChatLiveMessage,
  StreamerChatMessage
} from "@maiks-yt/events";
import { createStreamerChatMessageFromFakeLocal } from "@maiks-yt/events";
import { allThemeScenes, overlaySceneSlotIds } from "@maiks-yt/themes";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import { auth, configuredAuthProviderIds, getTrustedOrigins } from "./auth/better-auth.service.js";
import { registerStreamVisibilityPreferencesRoutes } from "./account/index.js";
import { registerActionPanelRoutes } from "./actions/index.js";
import {
  registerEventRoutingAdminRoutes,
  registerEventRoutingDispatchRoutes,
  type EventRoutingPlaybackPublisher
} from "./event-routing/index.js";
import {
  registerFakeLocalModerationRoutes,
  type FakeLocalModerationAuditEntry,
  type FakeLocalMutedAuthor
} from "./fake-local-moderation/index.js";
import { registerCreatorLinkAdminRoutes, registerCreatorLinkReadRoutes } from "./links/index.js";
import { registerLiveHelperDashboardRoutes } from "./live-helper/index.js";
import { registerModeratorAdminRoutes } from "./moderators/index.js";
import { registerNotificationAdminRoutes } from "./notifications/index.js";
import { registerContentPageRoutes } from "./pages/index.js";
import {
  registerProviderIntegrationStatusRoutes,
  registerTwitchChatIntakeControlRoutes,
  registerYouTubeOwnerConsentRoutes
} from "./provider-integrations/index.js";
import { registerProjectAdminRoutes, registerProjectReadRoutes } from "./projects/index.js";
import { registerStreamScheduleRoutes } from "./schedule/index.js";
import { registerUrlAccessTokenAdminRoutes } from "./tokens/index.js";

const config = createRuntimeConfig({
  environment: "development",
  surface: "api",
  publicBaseUrl: "http://localhost:3001"
});

const server = Fastify({ logger: true });
let databasePool: DatabasePool | undefined;
const activeOverlayConnections = new Set<string>();
const maxStreamerChatHistory = 75;
let overlayEmergencyCleanModeEnabled = false;
let overlayChatVisible = true;
let overlayChatNewestOnTop = false;
let overlaySponsorVisible = true;
let overlayAiMuted = false;
let overlayTopBarEnabled = true;
let overlayCenterEnabled = true;
let overlayCenterDefaultTiming: OverlayCenterNotificationTiming = {
  onscreenMs: 4_000,
  fadeOutMs: 700,
  restMs: 1_500
};
let overlayActiveGoal: OverlayActiveGoalState | null = null;
const overlayLiveClients = new Map<string, {
  requestedScene: OverlaySceneKey;
  requestedLayout: OverlayLayoutKey;
  requestedTheme: OverlayThemeKey;
  requestedMode: OverlayStateSnapshot["mode"];
  snapshot: OverlayStateSnapshot;
  socket: OverlayLiveSocket;
}>();
const streamerChatLiveClients = new Map<string, StreamerChatLiveSocket>();
const streamerChatMessages: StreamerChatMessage[] = [];
const overlaySceneDefinitions = new Map<string, OverlaySceneDefinition>(
  allThemeScenes.map((scene) => [`${scene.themeKey}:${scene.sceneKey}`, structuredClone(scene)])
);
let overlayGlobalPresentationState: OverlayPresentationState | null = null;

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
const devOwnerClaimRequestSchema = z.object({
  confirm: z.literal("claim-dev-owner")
});
const overlaySceneKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/);
const overlayThemeKeySchema = z.enum(["default", "satisfactory"]);
const overlayStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema.default("default"),
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]).default("standard"),
  theme: overlayThemeKeySchema.default("default"),
  mode: z.enum(["normal", "clean"]).default("normal")
});
const overlayStatusRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const overlayPresentationStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema,
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]),
  theme: overlayThemeKeySchema
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
const overlayChatOrderRequestSchema = z.object({
  accessToken: z.string().min(24),
  newestOnTop: z.boolean()
});
const streamerChatModerationRequestSchema = z.object({
  accessToken: z.string().min(24),
  targetMessageId: z.string().trim().min(1).max(191)
});
const streamerChatModerationRuleListRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const streamerChatModerationRuleRetractRequestSchema = z.object({
  accessToken: z.string().min(24),
  ruleId: z.string().trim().min(1).max(240)
});
const overlayFakeChatTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  authorName: z.string().trim().min(1).max(40).default("Test chatter"),
  authorKind: z.enum(["human", "bot", "system"]).default("human"),
  message: z.string().trim().min(1).max(280)
});
const overlaySponsorVisibilityRequestSchema = z.object({
  accessToken: z.string().min(24),
  visible: z.boolean()
});
const overlayAiMutedRequestSchema = z.object({
  accessToken: z.string().min(24),
  muted: z.boolean()
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
const overlayRedeemTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  redeem: z.enum(["hydrate", "jumpscare", "mime"])
});
const overlayGoalStateSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(80),
  currentAmount: z.number().min(0).max(1_000_000),
  targetAmount: z.number().positive().max(1_000_000),
  currencyCode: z.string().trim().regex(/^[A-Z]{3}$/)
}).refine((value) => value.currentAmount <= value.targetAmount, {
  message: "current_amount_cannot_exceed_target",
  path: ["currentAmount"]
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
    themeKey: overlayThemeKeySchema,
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

interface StreamerChatLiveSocket {
  close: (code?: number, reason?: string) => void;
  send: (message: string) => void;
  on(event: "close", listener: () => void): void;
}

type StreamerChatModerationRuleKind = "message_hidden" | "author_banned" | "author_warned";
type StreamerChatModerationRule = {
  appliedAt: string;
  authorName: string;
  count?: number;
  id: string;
  kind: StreamerChatModerationRuleKind;
  messageId: string | null;
  source: StreamerChatMessage["source"];
};

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
    chat: {
      newestOnTop: overlayChatNewestOnTop
    },
    activeGoal: overlayActiveGoal ? { ...overlayActiveGoal } : null,
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
        visible: overlaySponsorVisible && effectiveMode !== "clean" && effectiveLayout !== "clean",
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

const resolveOverlayPresentationState = (
  requestedState: OverlayPresentationState
): OverlayPresentationState => ({
  scene: overlayGlobalPresentationState?.scene ?? requestedState.scene,
  layout: overlayGlobalPresentationState?.layout ?? requestedState.layout,
  theme: overlayGlobalPresentationState?.theme ?? requestedState.theme
});

const createOverlaySnapshotFromRequestedState = ({
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
  const presentationState = resolveOverlayPresentationState({
    scene,
    layout,
    theme
  });

  return createOverlayStateSnapshot({
    scene: presentationState.scene,
    layout: presentationState.layout,
    theme: presentationState.theme,
    mode
  });
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
    actionLabel: "Donated EUR 20",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  }
];

const demoRedeemNotifications = {
  hydrate: {
    actorName: "Hydrate",
    actionLabel: "Take a drink",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "redeem",
    platform: "site",
    priority: "important"
  },
  jumpscare: {
    actorName: "Jumpscare",
    actionLabel: "Brace yourself",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "redeem",
    platform: "site",
    priority: "urgent"
  },
  mime: {
    actorName: "Mime",
    actionLabel: "Act it out",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "mime",
    platform: "site",
    priority: "important"
  }
} satisfies Record<string, Omit<OverlayNotificationDisplay, "createdAt" | "id">>;

const createRedeemNotification = (
  redeem: keyof typeof demoRedeemNotifications
): OverlayRoutedNotificationQueuedEvent => {
  const display: OverlayNotificationDisplay = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...demoRedeemNotifications[redeem]
  };

  return {
    type: "overlay.routed-notification.queued",
    payload: {
      ...display,
      route: "center",
      afterCenter: "none",
      center: {
        title: display.actorName,
        message: display.actionLabel,
        imageUrl: display.avatarUrl,
        timing: overlayCenterDefaultTiming
      }
    }
  };
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
      ? demoRedeemNotifications.hydrate
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

const createFakeChatMessageEvent = ({
  authorKind,
  authorName,
  message
}: {
  authorKind: OverlayFakeChatMessageReceivedEvent["payload"]["authorKind"];
  authorName: string;
  message: string;
}): OverlayFakeChatMessageReceivedEvent => ({
  type: "overlay.fake-chat.message.received",
  payload: {
    id: randomUUID(),
    authorKind,
    authorName,
    createdAt: new Date().toISOString(),
    message,
    source: "fake-local"
  }
});

const broadcastOverlayMessage = (message: OverlayLiveMessage): void => {
  const serializedMessage = JSON.stringify(message);

  for (const client of overlayLiveClients.values()) {
    client.socket.send(serializedMessage);
  }
};

const createStreamerChatSnapshot = (): StreamerChatLiveMessage => ({
  type: "streamer-chat.snapshot",
  payload: {
    messages: streamerChatMessages
      .filter((message) =>
        fakeLocalModerationRuntime.isMessageVisible(message)
        && streamerChatModerationRuntime.isMessageVisible(message)
      )
      .map((message) => ({ ...message })),
    sentAt: new Date().toISOString()
  }
});

const broadcastStreamerChatMessage = (message: StreamerChatMessage): void => {
  const serializedMessage = JSON.stringify({
    type: "streamer-chat.message.received",
    payload: message
  } satisfies StreamerChatLiveMessage);

  for (const client of streamerChatLiveClients.values()) {
    client.send(serializedMessage);
  }
};

const broadcastStreamerChatSnapshot = (): void => {
  const serializedMessage = JSON.stringify(createStreamerChatSnapshot());

  for (const client of streamerChatLiveClients.values()) {
    client.send(serializedMessage);
  }
};

class InMemoryStreamerChatModerationRuntime {
  private readonly warningThreshold = 3;
  private readonly hiddenMessageRules = new Map<string, {
    appliedAt: string;
    authorName: string;
    id: string;
    messageId: string;
    source: StreamerChatMessage["source"];
  }>();
  private readonly bannedActorRules = new Map<string, {
    appliedAt: string;
    authorName: string;
    id: string;
    source: StreamerChatMessage["source"];
  }>();
  private readonly warningRules = new Map<string, {
    appliedAt: string;
    authorName: string;
    count: number;
    id: string;
    lastMessageId: string;
    source: StreamerChatMessage["source"];
  }>();

  public hideMessage(messageId: string): StreamerChatMessage | null {
    const message = streamerChatMessages.find((candidate) => candidate.id === messageId) ?? null;

    if (!message) {
      return null;
    }

    this.hiddenMessageRules.set(messageId, {
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      id: this.createHiddenMessageRuleId(messageId),
      messageId,
      source: message.source
    });
    this.broadcastOverlayHideIfNeeded(message);
    broadcastStreamerChatSnapshot();

    return { ...message };
  }

  public banActorFromMessage(messageId: string): { affectedMessages: StreamerChatMessage[]; bannedMessage: StreamerChatMessage } | null {
    const message = streamerChatMessages.find((candidate) => candidate.id === messageId) ?? null;

    if (!message) {
      return null;
    }

    const actorKey = this.createActorKey(message);
    this.bannedActorRules.set(actorKey, {
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      id: this.createBannedActorRuleId(actorKey),
      source: message.source
    });
    const affectedMessages = streamerChatMessages
      .filter((candidate) => this.createActorKey(candidate) === actorKey)
      .map((candidate) => ({ ...candidate }));

    for (const affectedMessage of affectedMessages) {
      this.broadcastOverlayHideIfNeeded(affectedMessage);
    }

    broadcastStreamerChatSnapshot();

    return {
      affectedMessages,
      bannedMessage: { ...message }
    };
  }

  public warnActorFromMessage(messageId: string, previousWarningCount = 0): {
    autoBanned: boolean;
    affectedMessages: StreamerChatMessage[];
    message: StreamerChatMessage;
    warningCount: number;
    warningThreshold: number;
  } | null {
    const message = streamerChatMessages.find((candidate) => candidate.id === messageId) ?? null;

    if (!message) {
      return null;
    }

    const actorKey = this.createActorKey(message);
    const currentRule = this.warningRules.get(actorKey);
    const warningCount = Math.max(currentRule?.count ?? 0, previousWarningCount) + 1;

    this.warningRules.set(actorKey, {
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      count: warningCount,
      id: this.createWarningRuleId(actorKey),
      lastMessageId: message.id,
      source: message.source
    });

    if (warningCount >= this.warningThreshold) {
      const banResult = this.banActorFromMessage(message.id);

      return {
        autoBanned: true,
        affectedMessages: banResult?.affectedMessages ?? [],
        message: { ...message },
        warningCount,
        warningThreshold: this.warningThreshold
      };
    }

    broadcastStreamerChatSnapshot();

    return {
      autoBanned: false,
      affectedMessages: [],
      message: { ...message },
      warningCount,
      warningThreshold: this.warningThreshold
    };
  }

  public isMessageVisible(message: StreamerChatMessage): boolean {
    return !this.hiddenMessageRules.has(message.id) && !this.bannedActorRules.has(this.createActorKey(message));
  }

  public isActorBanned(source: StreamerChatMessage["source"], authorName: string): boolean {
    return this.bannedActorRules.has(this.createActorKey({ source, authorName }));
  }

  public hydrateHiddenMessage(
    messageId: string,
    authorName: string,
    source: StreamerChatMessage["source"],
    appliedAt: string
  ): void {
    this.hiddenMessageRules.set(messageId, {
      appliedAt,
      authorName,
      id: this.createHiddenMessageRuleId(messageId),
      messageId,
      source
    });
  }

  public hydrateBannedActor(
    authorName: string,
    source: StreamerChatMessage["source"],
    appliedAt: string
  ): void {
    const actorKey = this.createActorKey({ authorName, source });

    this.bannedActorRules.set(actorKey, {
      appliedAt,
      authorName,
      id: this.createBannedActorRuleId(actorKey),
      source
    });
  }

  public hydrateWarningCount(
    authorName: string,
    source: StreamerChatMessage["source"],
    count: number,
    lastMessageId: string | null,
    appliedAt: string
  ): void {
    const actorKey = this.createActorKey({ authorName, source });

    this.warningRules.set(actorKey, {
      appliedAt,
      authorName,
      count,
      id: this.createWarningRuleId(actorKey),
      lastMessageId: lastMessageId ?? "",
      source
    });
  }

  public listRules(): StreamerChatModerationRule[] {
    const hiddenRules = Array.from(this.hiddenMessageRules.values()).map((rule) => ({
      ...rule,
      kind: "message_hidden" as const
    }));
    const bannedRules = Array.from(this.bannedActorRules.values()).map((rule) => ({
      ...rule,
      kind: "author_banned" as const,
      messageId: null
    }));
    const warningRules = Array.from(this.warningRules.values()).map((rule) => ({
      appliedAt: rule.appliedAt,
      authorName: rule.authorName,
      count: rule.count,
      id: rule.id,
      kind: "author_warned" as const,
      messageId: rule.lastMessageId,
      source: rule.source
    }));

    return [...hiddenRules, ...bannedRules, ...warningRules]
      .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
  }

  public retractRule(ruleId: string): StreamerChatModerationRule | null {
    for (const [messageId, rule] of this.hiddenMessageRules.entries()) {
      if (rule.id === ruleId) {
        this.hiddenMessageRules.delete(messageId);
        broadcastStreamerChatSnapshot();

        return {
          ...rule,
          kind: "message_hidden",
          messageId
        };
      }
    }

    for (const [actorKey, rule] of this.bannedActorRules.entries()) {
      if (rule.id === ruleId) {
        this.bannedActorRules.delete(actorKey);
        broadcastStreamerChatSnapshot();

        return {
          ...rule,
          kind: "author_banned",
          messageId: null
        };
      }
    }

    for (const [actorKey, rule] of this.warningRules.entries()) {
      if (rule.id === ruleId) {
        this.warningRules.delete(actorKey);
        broadcastStreamerChatSnapshot();

        return {
          appliedAt: rule.appliedAt,
          authorName: rule.authorName,
          count: rule.count,
          id: rule.id,
          kind: "author_warned",
          messageId: rule.lastMessageId,
          source: rule.source
        };
      }
    }

    return null;
  }

  private broadcastOverlayHideIfNeeded(message: StreamerChatMessage): void {
    if (message.source !== "fake-local") {
      return;
    }

    broadcastOverlayMessage({
      type: "overlay.fake-chat.message.hidden",
      payload: {
        id: message.id,
        source: "fake-local",
        hiddenAt: new Date().toISOString()
      }
    } satisfies OverlayFakeChatMessageHiddenEvent);
  }

  private createActorKey(actor: Pick<StreamerChatMessage, "source" | "authorName">): string {
    return `${actor.source}:${actor.authorName.trim().toLowerCase()}`;
  }

  private createHiddenMessageRuleId(messageId: string): string {
    return `message_hidden:${messageId}`;
  }

  private createBannedActorRuleId(actorKey: string): string {
    return `author_banned:${actorKey}`;
  }

  private createWarningRuleId(actorKey: string): string {
    return `author_warned:${actorKey}`;
  }
}

const streamerChatModerationRuntime = new InMemoryStreamerChatModerationRuntime();

const controlTokenModerationActorId = "control-token";
const moderationWarningThreshold = 3;

const toModerationDate = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
};

const isStreamerChatSource = (source: unknown): source is StreamerChatMessage["source"] =>
  source === "fake-local" || source === "twitch" || source === "youtube" || source === "discord";

const getStreamerChatModerationFlags = (source: StreamerChatMessage["source"]): {
  isSimulated: boolean;
  isTest: boolean;
  testResettable: boolean;
} => source === "fake-local"
  ? {
    isSimulated: true,
    isTest: true,
    testResettable: true
  }
  : {
    isSimulated: false,
    isTest: false,
    testResettable: false
  };

const createStreamerChatActorKey = (source: StreamerChatMessage["source"], authorName: string): string =>
  `${source}:${authorName.trim().toLowerCase()}`;

const createHiddenMessageRuleId = (messageId: string): string => `message_hidden:${messageId}`;
const createBannedActorRuleId = (source: StreamerChatMessage["source"], authorName: string): string =>
  `author_banned:${createStreamerChatActorKey(source, authorName)}`;
const createWarningRuleId = (source: StreamerChatMessage["source"], authorName: string): string =>
  `author_warned:${createStreamerChatActorKey(source, authorName)}`;

const appendStreamerChatModerationAudit = async ({
  action,
  message,
  note,
  outcome,
  reason
}: {
  action: "warn_author" | "hide_message" | "ban_author" | "unban_author";
  message: {
    authorName: string;
    id: string;
    providerMessageId?: string;
    source: StreamerChatMessage["source"];
  };
  note: string | null;
  outcome: "applied" | "not_found" | "reverted";
  reason: string | null;
}): Promise<{ id: string; at: string }> => {
  const id = randomUUID();
  const at = new Date().toISOString();
  const flags = getStreamerChatModerationFlags(message.source);

  await getDatabasePool().execute(
    `
      INSERT INTO moderation_audit_logs
        (
          id,
          source,
          action,
          outcome,
          actor_display_name,
          target_author_name,
          target_message_id,
          target_external_id,
          reason,
          note,
          provider_action,
          is_test,
          is_simulated,
          test_resettable,
          redacted_context,
          created_at
        )
      VALUES (?, ?, ?, ?, 'Control chat window', ?, ?, ?, ?, ?, false, ?, ?, ?, ?, ?)
    `,
    [
      id,
      message.source,
      action,
      outcome,
      message.authorName,
      message.id,
      message.providerMessageId ?? null,
      reason,
      note,
      flags.isTest,
      flags.isSimulated,
      flags.testResettable,
      JSON.stringify({
        source: "streamer-chat-window",
        providerAction: false
      }),
      new Date(at)
    ]
  );

  return { id, at };
};

const upsertStreamerChatActiveState = async ({
  auditLogId,
  message,
  stateKind
}: {
  auditLogId: string;
  message: {
    authorName: string;
    id: string;
    providerMessageId?: string;
    source: StreamerChatMessage["source"];
  };
  stateKind: "message_hidden" | "user_banned";
}): Promise<void> => {
  const now = new Date();
  const flags = getStreamerChatModerationFlags(message.source);
  const targetClause = stateKind === "message_hidden"
    ? "target_message_id = ?"
    : "LOWER(target_author_name) = LOWER(?)";
  const targetValue = stateKind === "message_hidden" ? message.id : message.authorName;
  const [updateResult] = await getDatabasePool().execute(
    `
      UPDATE moderation_active_states
      SET
        status = 'active',
        active_until = NULL,
        duration_seconds = NULL,
        reason = ?,
        note = ?,
        last_audit_log_id = ?,
        revoked_audit_log_id = NULL,
        revoked_at = NULL,
        revoked_by_user_id = NULL,
        revocation_reason = NULL,
        provider_action = false,
        provider_action_id = NULL,
        provider_state_id = NULL,
        is_test = ?,
        is_simulated = ?,
        test_resettable = ?,
        updated_at = ?
      WHERE source = ?
        AND state_kind = ?
        AND status = 'active'
        AND revoked_at IS NULL
        AND ${targetClause}
    `,
    [
      stateKind === "message_hidden" ? "Hidden from stream chat surfaces." : "Banned from stream chat surfaces.",
      "Applied from stream chat quick controls.",
      auditLogId,
      flags.isTest,
      flags.isSimulated,
      flags.testResettable,
      now,
      message.source,
      stateKind,
      targetValue
    ]
  );

  if (((updateResult as { affectedRows?: number }).affectedRows ?? 0) > 0) {
    return;
  }

  await getDatabasePool().execute(
    `
      INSERT INTO moderation_active_states
        (
          id,
          source,
          state_kind,
          status,
          target_author_name,
          target_message_id,
          target_external_id,
          active_from,
          reason,
          note,
          created_audit_log_id,
          last_audit_log_id,
          provider_action,
          is_test,
          is_simulated,
          test_resettable,
          created_at,
          updated_at
        )
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      message.source,
      stateKind,
      message.authorName,
      stateKind === "message_hidden" ? message.id : null,
      message.providerMessageId ?? null,
      now,
      stateKind === "message_hidden" ? "Hidden from stream chat surfaces." : "Banned from stream chat surfaces.",
      "Applied from stream chat quick controls.",
      auditLogId,
      auditLogId,
      flags.isTest,
      flags.isSimulated,
      flags.testResettable,
      now,
      now
    ]
  );
};

const getDurableWarningCount = async (
  source: StreamerChatMessage["source"],
  authorName: string
): Promise<number> => {
  const [rows] = await getDatabasePool().execute(
    `
      SELECT
        COALESCE(SUM(CASE WHEN outcome = 'applied' THEN 1 WHEN outcome = 'reverted' THEN -1 ELSE 0 END), 0) AS warningCount
      FROM moderation_audit_logs
      WHERE source = ?
        AND action = 'warn_author'
        AND LOWER(target_author_name) = LOWER(?)
        AND provider_action = false
    `,
    [source, authorName]
  );

  const firstRow = Array.isArray(rows) ? (rows as Array<{ warningCount?: unknown }>)[0] : null;
  const count = Number(firstRow?.warningCount ?? 0);

  return Number.isFinite(count) && count > 0 ? count : 0;
};

const listDurableStreamerChatModerationRules = async (): Promise<StreamerChatModerationRule[]> => {
  const [activeRows] = await getDatabasePool().execute(
    `
      SELECT
        id,
        source,
        state_kind AS stateKind,
        target_author_name AS authorName,
        target_message_id AS messageId,
        active_from AS appliedAt
      FROM moderation_active_states
      WHERE status = 'active'
        AND provider_action = false
        AND state_kind IN ('message_hidden', 'user_banned')
        AND source IN ('fake-local', 'twitch', 'youtube', 'discord')
      ORDER BY active_from DESC
      LIMIT 100
    `
  );
  const activeRules = (Array.isArray(activeRows) ? activeRows : []).flatMap((row) => {
    const item = row as {
      appliedAt: unknown;
      authorName: string | null;
      messageId: string | null;
      source: unknown;
      stateKind: "message_hidden" | "user_banned";
    };

    if (!isStreamerChatSource(item.source) || !item.authorName) {
      return [];
    }

    const kind: StreamerChatModerationRuleKind = item.stateKind === "message_hidden" ? "message_hidden" : "author_banned";

    return [{
      appliedAt: toModerationDate(item.appliedAt),
      authorName: item.authorName,
      id: kind === "message_hidden" && item.messageId
        ? createHiddenMessageRuleId(item.messageId)
        : createBannedActorRuleId(item.source, item.authorName),
      kind,
      messageId: item.messageId,
      source: item.source
    }];
  });
  const [warningRows] = await getDatabasePool().execute(
    `
      SELECT
        source,
        target_author_name AS authorName,
        MAX(created_at) AS appliedAt,
        COALESCE(SUM(CASE WHEN outcome = 'applied' THEN 1 WHEN outcome = 'reverted' THEN -1 ELSE 0 END), 0) AS warningCount,
        MAX(target_message_id) AS messageId
      FROM moderation_audit_logs
      WHERE action = 'warn_author'
        AND provider_action = false
        AND source IN ('fake-local', 'twitch', 'youtube', 'discord')
      GROUP BY source, LOWER(target_author_name), target_author_name
      HAVING warningCount > 0
      ORDER BY appliedAt DESC
      LIMIT 100
    `
  );
  const warningRules = (Array.isArray(warningRows) ? warningRows : []).flatMap((row) => {
    const item = row as {
      appliedAt: unknown;
      authorName: string | null;
      messageId: string | null;
      source: unknown;
      warningCount: unknown;
    };

    if (!isStreamerChatSource(item.source) || !item.authorName) {
      return [];
    }

    return [{
      appliedAt: toModerationDate(item.appliedAt),
      authorName: item.authorName,
      count: Number(item.warningCount),
      id: createWarningRuleId(item.source, item.authorName),
      kind: "author_warned" as const,
      messageId: item.messageId,
      source: item.source
    }];
  });

  return [...activeRules, ...warningRules]
    .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
};

const hydrateStreamerChatModerationRuntime = async (): Promise<void> => {
  const rules = await listDurableStreamerChatModerationRules();

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

const retractDurableStreamerChatModerationRule = async (
  ruleId: string
): Promise<StreamerChatModerationRule | null> => {
  const rule = (await listDurableStreamerChatModerationRules()).find((candidate) => candidate.id === ruleId) ?? null;

  if (!rule) {
    return null;
  }

  const audit = await appendStreamerChatModerationAudit({
    action: rule.kind === "author_banned"
      ? "unban_author"
      : rule.kind === "message_hidden"
        ? "hide_message"
        : "warn_author",
    message: {
      authorName: rule.authorName,
      id: rule.messageId ?? rule.id,
      source: rule.source
    },
    note: "Retracted from applied rules window.",
    outcome: "reverted",
    reason: "streamer_chat_rule_retracted"
  });

  if (rule.kind === "message_hidden" || rule.kind === "author_banned") {
    const stateKind = rule.kind === "message_hidden" ? "message_hidden" : "user_banned";
    const targetClause = rule.kind === "message_hidden"
      ? "target_message_id = ?"
      : "LOWER(target_author_name) = LOWER(?)";
    const targetValue = rule.kind === "message_hidden" ? rule.messageId : rule.authorName;

    if (targetValue) {
      await getDatabasePool().execute(
        `
          UPDATE moderation_active_states
          SET
            status = 'revoked',
            revoked_audit_log_id = ?,
            revoked_at = ?,
            revoked_by_user_id = ?,
            revocation_reason = ?,
            last_audit_log_id = ?,
            updated_at = ?
          WHERE source = ?
            AND state_kind = ?
            AND status = 'active'
            AND ${targetClause}
        `,
        [
          audit.id,
          new Date(audit.at),
          controlTokenModerationActorId,
          "Retracted from applied rules window.",
          audit.id,
          new Date(audit.at),
          rule.source,
          stateKind,
          targetValue
        ]
      );
    }
  }

  return rule;
};

class InMemoryFakeLocalModerationRuntime {
  private readonly auditEntries: FakeLocalModerationAuditEntry[] = [];
  private readonly hiddenMessageIds = new Set<string>();
  private readonly mutedAuthors = new Map<string, FakeLocalMutedAuthor>();

  public appendAudit(entry: FakeLocalModerationAuditEntry): void {
    this.auditEntries.unshift(structuredClone(entry));
    this.auditEntries.splice(100);
  }

  public hideMessage(messageId: string, hiddenAt: string): StreamerChatMessage | null {
    const messageIndex = streamerChatMessages.findIndex((message) => message.id === messageId);
    const message = messageIndex >= 0 ? streamerChatMessages[messageIndex] : null;

    if (!message) {
      return null;
    }

    this.hiddenMessageIds.add(messageId);
    streamerChatMessages.splice(messageIndex, 1);
    broadcastStreamerChatSnapshot();
    broadcastOverlayMessage({
      type: "overlay.fake-chat.message.hidden",
      payload: {
        id: messageId,
        source: "fake-local",
        hiddenAt
      }
    } satisfies OverlayFakeChatMessageHiddenEvent);

    return { ...message };
  }

  public muteAuthor(authorName: string, mutedUntil: string): FakeLocalMutedAuthor {
    const mutedAuthor = {
      authorName,
      mutedUntil
    };
    this.mutedAuthors.set(this.normalizeAuthorName(authorName), mutedAuthor);

    return { ...mutedAuthor };
  }

  public isAuthorMuted(authorName: string, now = new Date()): FakeLocalMutedAuthor | null {
    const key = this.normalizeAuthorName(authorName);
    const mutedAuthor = this.mutedAuthors.get(key);

    if (!mutedAuthor) {
      return null;
    }

    if (new Date(mutedAuthor.mutedUntil).getTime() <= now.getTime()) {
      this.mutedAuthors.delete(key);
      return null;
    }

    return { ...mutedAuthor };
  }

  public isMessageVisible(message: StreamerChatMessage): boolean {
    return !this.hiddenMessageIds.has(message.id);
  }

  private normalizeAuthorName(authorName: string): string {
    return authorName.trim().toLowerCase();
  }
}

const fakeLocalModerationRuntime = new InMemoryFakeLocalModerationRuntime();

const appendStreamerChatMessage = (message: StreamerChatMessage): StreamerChatMessage => {
  streamerChatMessages.unshift(message);
  streamerChatMessages.splice(maxStreamerChatHistory);

  if (streamerChatModerationRuntime.isMessageVisible(message)) {
    broadcastStreamerChatMessage(message);
  }

  return message;
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

const twitchChatIntakeRuntime = new TwitchChatReadOnlyIntakeService({
  onMessage: recordTwitchStreamerChatMessage
});

const broadcastOverlaySnapshots = (): void => {
  for (const client of overlayLiveClients.values()) {
    client.snapshot = {
      ...createOverlaySnapshotFromRequestedState({
        scene: client.requestedScene,
        layout: client.requestedLayout,
        theme: client.requestedTheme,
        mode: client.requestedMode
      }),
      connectionStatus: client.snapshot.connectionStatus
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

const publishEventRoutingPlayback: EventRoutingPlaybackPublisher = (projection) => {
  if (projection.destination === "top_notification" && !overlayTopBarEnabled) {
    return {
      emitted: false,
      reason: "top_notifications_disabled",
      activeOverlayConnections: activeOverlayConnections.size
    };
  }

  if (projection.destination === "center_notification" && !overlayCenterEnabled) {
    return {
      emitted: false,
      reason: "center_notifications_disabled",
      activeOverlayConnections: activeOverlayConnections.size
    };
  }

  broadcastOverlayMessage(projection.overlayEvent);

  return {
    emitted: true,
    activeOverlayConnections: activeOverlayConnections.size
  };
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

const getDevOwnerEmailAllowlist = (): Set<string> =>
  new Set((process.env.DEV_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0));

const isDevOwnerClaimAllowed = (session: NonNullable<AuthSessionSnapshot>): boolean => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const email = session.user.email?.trim().toLowerCase();

  return Boolean(email && getDevOwnerEmailAllowlist().has(email));
};

registerActionPanelRoutes(server, {
  getAuthSession,
  getDatabasePool
});
registerStreamVisibilityPreferencesRoutes(server, {
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

server.post("/identity/dev/claim-owner", async (request, reply) => {
  const session = await getAuthSession(request);

  if (!session) {
    reply.code(401);
    return {
      ok: false,
      reason: "not_authenticated"
    };
  }

  if (!isDevOwnerClaimAllowed(session)) {
    reply.code(403);
    return {
      ok: false,
      reason: "dev_owner_email_not_allowed"
    };
  }

  const parsedRequest = devOwnerClaimRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_owner_claim_request"
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

    const [ownerRoleRows] = await pool.execute(
      "SELECT id FROM roles WHERE `key` = 'owner' LIMIT 1"
    );
    const ownerRole = Array.isArray(ownerRoleRows)
      ? ownerRoleRows[0] as { id: string } | undefined
      : undefined;

    if (!ownerRole) {
      reply.code(404);
      return {
        ok: false,
        reason: "owner_role_not_seeded"
      };
    }

    await pool.execute(
      "INSERT IGNORE INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)",
      [randomUUID(), user.id, ownerRole.id]
    );

    return {
      ok: true,
      domainUser: user,
      role: "owner"
    };
  } catch (error) {
    server.log.warn({ err: error }, "Dev owner claim failed.");
    reply.code(503);

    return {
      ok: false,
      reason: "dev_owner_claim_unavailable"
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
    snapshot: createOverlaySnapshotFromRequestedState(parsedRequest.data)
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
    presentationState: overlayGlobalPresentationState ?? {
      scene: "default",
      layout: "standard",
      theme: "default"
    },
    emergencyCleanModeEnabled: overlayEmergencyCleanModeEnabled,
    chatVisible: overlayChatVisible,
    chatNewestOnTop: overlayChatNewestOnTop,
    sponsorVisible: overlaySponsorVisible,
    aiMuted: overlayAiMuted,
    topBarEnabled: overlayTopBarEnabled,
    centerEnabled: overlayCenterEnabled,
    centerDefaultTiming: overlayCenterDefaultTiming,
    activeGoal: overlayActiveGoal ? { ...overlayActiveGoal } : null,
    checkedAt: new Date().toISOString()
  };
});

server.get("/streamer-chat/messages", async (request, reply) => {
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
    source: "mixed",
    messages: streamerChatMessages
      .filter((message) =>
        fakeLocalModerationRuntime.isMessageVisible(message)
        && streamerChatModerationRuntime.isMessageVisible(message)
      )
      .map((message) => ({ ...message })),
    checkedAt: new Date().toISOString()
  };
});

const validateControlPanelTokenForStreamerChatModeration = async (
  accessToken: string,
  reply: FastifyReply
): Promise<string | null> => {
  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    reply.code(403);
    return tokenValidation.reason ?? "control_panel_access_denied";
  }

  return null;
};

server.post("/streamer-chat/moderation/hide", async (request, reply) => {
  const parsedRequest = streamerChatModerationRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request",
      providerAction: false
    };
  }

  const accessDeniedReason = await validateControlPanelTokenForStreamerChatModeration(parsedRequest.data.accessToken, reply);

  if (accessDeniedReason) {
    return {
      ok: false,
      reason: accessDeniedReason,
      providerAction: false
    };
  }

  const affectedMessage = streamerChatModerationRuntime.hideMessage(parsedRequest.data.targetMessageId);

  if (affectedMessage) {
    const audit = await appendStreamerChatModerationAudit({
      action: "hide_message",
      message: affectedMessage,
      note: "Applied from stream chat quick controls.",
      outcome: "applied",
      reason: "streamer_chat_message_hidden"
    });
    await upsertStreamerChatActiveState({
      auditLogId: audit.id,
      message: affectedMessage,
      stateKind: "message_hidden"
    });
  }

  return {
    ok: true,
    action: "hide",
    affectedMessage,
    affectedCount: affectedMessage ? 1 : 0,
    providerAction: false
  };
});

server.post("/streamer-chat/moderation/ban", async (request, reply) => {
  const parsedRequest = streamerChatModerationRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request",
      providerAction: false
    };
  }

  const accessDeniedReason = await validateControlPanelTokenForStreamerChatModeration(parsedRequest.data.accessToken, reply);

  if (accessDeniedReason) {
    return {
      ok: false,
      reason: accessDeniedReason,
      providerAction: false
    };
  }

  const result = streamerChatModerationRuntime.banActorFromMessage(parsedRequest.data.targetMessageId);

  if (result?.bannedMessage) {
    const audit = await appendStreamerChatModerationAudit({
      action: "ban_author",
      message: result.bannedMessage,
      note: "Applied from stream chat quick controls.",
      outcome: "applied",
      reason: "streamer_chat_author_banned"
    });
    await upsertStreamerChatActiveState({
      auditLogId: audit.id,
      message: result.bannedMessage,
      stateKind: "user_banned"
    });
  }

  return {
    ok: true,
    action: "ban",
    affectedMessage: result?.bannedMessage ?? null,
    affectedCount: result?.affectedMessages.length ?? 0,
    providerAction: false
  };
});

server.post("/streamer-chat/moderation/warn", async (request, reply) => {
  const parsedRequest = streamerChatModerationRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request",
      providerAction: false
    };
  }

  const accessDeniedReason = await validateControlPanelTokenForStreamerChatModeration(parsedRequest.data.accessToken, reply);

  if (accessDeniedReason) {
    return {
      ok: false,
      reason: accessDeniedReason,
      providerAction: false
    };
  }

  const targetMessage = streamerChatMessages.find((message) => message.id === parsedRequest.data.targetMessageId) ?? null;
  const previousWarningCount = targetMessage
    ? await getDurableWarningCount(targetMessage.source, targetMessage.authorName)
    : 0;
  const result = streamerChatModerationRuntime.warnActorFromMessage(
    parsedRequest.data.targetMessageId,
    previousWarningCount
  );

  if (result?.message) {
    await appendStreamerChatModerationAudit({
      action: "warn_author",
      message: result.message,
      note: `Provider warning message pending: @${result.message.authorName} this is warning ${result.warningCount}/${result.warningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`,
      outcome: "applied",
      reason: "streamer_chat_author_warned"
    });

    if (result.autoBanned) {
      const audit = await appendStreamerChatModerationAudit({
        action: "ban_author",
        message: result.message,
        note: "Automatic local ban after third warning.",
        outcome: "applied",
        reason: "streamer_chat_warning_threshold_reached"
      });
      await upsertStreamerChatActiveState({
        auditLogId: audit.id,
        message: result.message,
        stateKind: "user_banned"
      });
    }
  }

  return {
    ok: true,
    action: "warn",
    affectedMessage: result?.message ?? null,
    affectedCount: result?.affectedMessages.length ?? 0,
    autoBanned: result?.autoBanned ?? false,
    warningCount: result?.warningCount ?? 0,
    warningThreshold: result?.warningThreshold ?? moderationWarningThreshold,
    providerAction: false,
    providerMessageSent: false,
    providerMessage: result
      ? `@${result.message.authorName} this is warning ${result.warningCount}/${result.warningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`
      : null
  };
});

server.get("/streamer-chat/moderation/rules", async (request, reply) => {
  const parsedRequest = streamerChatModerationRuleListRequestSchema.safeParse(request.query);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request",
      providerAction: false
    };
  }

  const accessDeniedReason = await validateControlPanelTokenForStreamerChatModeration(parsedRequest.data.accessToken, reply);

  if (accessDeniedReason) {
    return {
      ok: false,
      reason: accessDeniedReason,
      providerAction: false
    };
  }

  return {
    ok: true,
    rules: await listDurableStreamerChatModerationRules(),
    providerAction: false,
    checkedAt: new Date().toISOString()
  };
});

server.post("/streamer-chat/moderation/rules/retract", async (request, reply) => {
  const parsedRequest = streamerChatModerationRuleRetractRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    reply.code(400);
    return {
      ok: false,
      reason: "invalid_request",
      providerAction: false
    };
  }

  const accessDeniedReason = await validateControlPanelTokenForStreamerChatModeration(parsedRequest.data.accessToken, reply);

  if (accessDeniedReason) {
    return {
      ok: false,
      reason: accessDeniedReason,
      providerAction: false
    };
  }

  const retractedRule = await retractDurableStreamerChatModerationRule(parsedRequest.data.ruleId);

  if (retractedRule) {
    streamerChatModerationRuntime.retractRule(retractedRule.id);
  }

  return {
    ok: true,
    retractedRule,
    providerAction: false
  };
});

server.get("/streamer-chat/twitch-status", async (request, reply) => {
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
    readOnly: true,
    status: twitchChatIntakeRuntime.getStatus(),
    checkedAt: new Date().toISOString()
  };
});

server.get("/streamer-chat/live", { websocket: true }, async (socket: StreamerChatLiveSocket, request) => {
  const parsedRequest = overlayStatusRequestSchema.safeParse(request.query);

  if (!parsedRequest.success) {
    socket.close(1008, "invalid_request");
    return;
  }

  const tokenValidation = await validateUrlAccessTokenForRequest({
    token: parsedRequest.data.accessToken,
    surface: "control-panel",
    scope: "control:open"
  });

  if (!tokenValidation.valid) {
    socket.close(1008, tokenValidation.reason ?? "control_panel_access_denied");
    return;
  }

  const connectionId = randomUUID();
  streamerChatLiveClients.set(connectionId, socket);
  socket.send(JSON.stringify(createStreamerChatSnapshot()));
  socket.on("close", () => {
    streamerChatLiveClients.delete(connectionId);
  });
});

server.post("/overlay/goal", async (request, reply) => {
  const parsedRequest = overlayGoalStateSchema.safeParse(request.body);

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

  overlayActiveGoal = {
    enabled: parsedRequest.data.enabled,
    label: parsedRequest.data.label,
    currentAmount: parsedRequest.data.currentAmount,
    targetAmount: parsedRequest.data.targetAmount,
    currencyCode: parsedRequest.data.currencyCode
  };
  broadcastOverlaySnapshots();

  return {
    ok: true,
    activeGoal: { ...overlayActiveGoal },
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/presentation-state", async (request, reply) => {
  const parsedRequest = overlayPresentationStateRequestSchema.safeParse(request.body);

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

  const sceneDefinition = overlaySceneDefinitions.get(`${parsedRequest.data.theme}:${parsedRequest.data.scene}`);

  if (!sceneDefinition) {
    reply.code(400);
    return {
      ok: false,
      reason: "unknown_scene"
    };
  }

  overlayGlobalPresentationState = {
    scene: parsedRequest.data.scene,
    layout: parsedRequest.data.layout,
    theme: parsedRequest.data.theme
  };
  broadcastOverlaySnapshots();

  return {
    ok: true,
    presentationState: overlayGlobalPresentationState,
    activeOverlayConnections: activeOverlayConnections.size
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

server.post("/overlay/chat/order", async (request, reply) => {
  const parsedRequest = overlayChatOrderRequestSchema.safeParse(request.body);

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

  overlayChatNewestOnTop = parsedRequest.data.newestOnTop;
  broadcastOverlaySnapshots();

  return {
    ok: true,
    chatNewestOnTop: overlayChatNewestOnTop,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/chat/test", async (request, reply) => {
  const parsedRequest = overlayFakeChatTestRequestSchema.safeParse(request.body);

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

  const event = createFakeChatMessageEvent(parsedRequest.data);
  const mutedAuthor = fakeLocalModerationRuntime.isAuthorMuted(event.payload.authorName);

  if (mutedAuthor) {
    return {
      ok: true,
      queued: 0,
      reason: "fake_local_author_muted",
      mutedUntil: mutedAuthor.mutedUntil,
      chatVisible: overlayChatVisible,
      streamerChatMessage: null,
      event: null,
      activeOverlayConnections: activeOverlayConnections.size
    };
  }

  const streamerChatMessage = recordFakeLocalStreamerChatMessage(event);

  if (!streamerChatMessage) {
    return {
      ok: true,
      queued: 0,
      reason: "streamer_chat_actor_banned",
      chatVisible: overlayChatVisible,
      streamerChatMessage: null,
      event: null,
      activeOverlayConnections: activeOverlayConnections.size
    };
  }

  broadcastOverlayMessage(event);

  return {
    ok: true,
    queued: 1,
    chatVisible: overlayChatVisible,
    streamerChatMessage,
    event,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/sponsor/visibility", async (request, reply) => {
  const parsedRequest = overlaySponsorVisibilityRequestSchema.safeParse(request.body);

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

  overlaySponsorVisible = parsedRequest.data.visible;
  broadcastOverlaySnapshots();

  return {
    ok: true,
    sponsorVisible: overlaySponsorVisible,
    activeOverlayConnections: activeOverlayConnections.size
  };
});

server.post("/overlay/ai/muted", async (request, reply) => {
  const parsedRequest = overlayAiMutedRequestSchema.safeParse(request.body);

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

  overlayAiMuted = parsedRequest.data.muted;

  return {
    ok: true,
    aiMuted: overlayAiMuted,
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

server.post("/overlay/redeem/test", async (request, reply) => {
  const parsedRequest = overlayRedeemTestRequestSchema.safeParse(request.body);

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

  if (!overlayCenterEnabled) {
    return {
      ok: true,
      queued: 0,
      redeem: parsedRequest.data.redeem,
      reason: "center_notifications_disabled",
      activeOverlayConnections: activeOverlayConnections.size
    };
  }

  broadcastOverlayMessage(createRedeemNotification(parsedRequest.data.redeem));

  return {
    ok: true,
    queued: 1,
    redeem: parsedRequest.data.redeem,
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
  let snapshot = createOverlaySnapshotFromRequestedState(parsedRequest.data);
  snapshot = {
    ...snapshot,
    connectionStatus: "live",
    updatedAt: new Date().toISOString()
  };
  overlayLiveClients.set(connectionId, {
    requestedScene: parsedRequest.data.scene,
    requestedLayout: parsedRequest.data.layout,
    requestedTheme: parsedRequest.data.theme,
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
  await hydrateStreamerChatModerationRuntime();
  await server.listen({ host: "0.0.0.0", port: 3001 });
};

await start();
