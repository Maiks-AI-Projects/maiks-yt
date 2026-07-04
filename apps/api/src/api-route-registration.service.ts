import type { DatabasePool } from "@maiks-yt/database";
import type { OverlayFakeChatMessageReceivedEvent, StreamerChatMessage } from "@maiks-yt/events";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { configuredAuthProviderIds } from "./auth/better-auth.service.js";
import {
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
import { registerDevOwnerTokenRoutes } from "./dev-testing/index.js";
import { registerFakeLocalModerationRoutes } from "./fake-local-moderation/index.js";
import { registerCreatorLinkAdminRoutes, registerCreatorLinkReadRoutes } from "./links/index.js";
import { registerLiveHelperDashboardRoutes } from "./live-helper/index.js";
import { registerModeratorAdminRoutes } from "./moderators/index.js";
import { registerNotificationAdminRoutes } from "./notifications/index.js";
import { registerOverlayRoutes } from "./overlay/index.js";
import { registerContentPageRoutes } from "./pages/index.js";
import {
  registerDiscordChatIntakeControlRoutes,
  registerProviderEventIntakeAdminRoutes,
  registerProviderIntegrationStatusRoutes,
  registerTwitchChatIntakeControlRoutes,
  registerTwitchEventSubWebhookRoutes,
  registerYouTubeChannelDiscoveryRoutes,
  registerYouTubeLiveChatIntakeControlRoutes,
  registerYouTubeOwnerConsentRoutes
} from "./provider-integrations/index.js";
import type { ProviderEventIntakeLogService } from "./provider-integrations/index.js";
import { registerProjectAdminRoutes, registerProjectReadRoutes } from "./projects/index.js";
import { registerRealtimeSpikeRoutes } from "./realtime/index.js";
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
import type {
  DiscordChatReadOnlyIntakeService,
  TwitchChatReadOnlyIntakeService,
  YouTubeLiveChatReadOnlyIntakeService
} from "@maiks-yt/integrations";
import type { OverlayRuntime } from "./overlay/index.js";
import type { UrlAccessSurface } from "@maiks-yt/domain/security";

type ValidateUrlAccessTokenForRequest = (input: {
  scope: string;
  surface: UrlAccessSurface;
  token: string;
}) => Promise<{ valid: boolean; requiresLogin: boolean; reason?: string }>;

type RequireStreamerChatModerationPermission = (
  request: FastifyRequest,
  accessToken: string,
  action: StreamerChatModerationAction
) => Promise<{ ok: true } | { ok: false; reason: string; statusCode: 401 | 403 }>;

type RegisterApplicationRoutesInput = {
  discordChatIntakeRuntime: DiscordChatReadOnlyIntakeService;
  fakeLocalModerationRuntime: InMemoryFakeLocalModerationRuntime;
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
  overlayRuntime: OverlayRuntime;
  publishEventRoutingPlayback: EventRoutingPlaybackPublisher;
  providerEventIntakeLogService: ProviderEventIntakeLogService;
  recordFakeLocalStreamerChatMessage: (event: OverlayFakeChatMessageReceivedEvent) => StreamerChatMessage | null;
  requireStreamerChatModerationPermission: RequireStreamerChatModerationPermission;
  server: FastifyInstance;
  streamerChatModerationAccessService: StreamerChatModerationAccessService;
  streamerChatModerationRuntime: InMemoryStreamerChatModerationRuntime;
  streamerChatModerationStore: StreamerChatModerationStoreService;
  streamerChatRuntime: StreamerChatRuntime;
  twitchChatIntakeRuntime: TwitchChatReadOnlyIntakeService;
  validateUrlAccessTokenForRequest: ValidateUrlAccessTokenForRequest;
  youtubeLiveChatIntakeRuntime: YouTubeLiveChatReadOnlyIntakeService;
};

export const registerApplicationRoutes = ({
  discordChatIntakeRuntime,
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
  validateUrlAccessTokenForRequest,
  youtubeLiveChatIntakeRuntime
}: RegisterApplicationRoutesInput): void => {
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
  registerDevOwnerTokenRoutes(server, {
    getDatabasePool
  });
  registerProviderIntegrationStatusRoutes(server, {
    getAuthSession,
    getDatabasePool,
    getRuntimeState: () => ({
      discordChatIntakeState: discordChatIntakeRuntime.getStatus().state,
      twitchChatIntakeState: twitchChatIntakeRuntime.getStatus().state,
      youtubeLiveChatIntakeState: youtubeLiveChatIntakeRuntime.getStatus().state
    })
  });
  registerProviderEventIntakeAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerTwitchEventSubWebhookRoutes(server, {
    intakeLogService: providerEventIntakeLogService
  });
  registerYouTubeOwnerConsentRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerYouTubeChannelDiscoveryRoutes(server, {
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
  registerYouTubeLiveChatIntakeControlRoutes(server, {
    getAuthSession,
    getDatabasePool,
    runtime: youtubeLiveChatIntakeRuntime
  });
  registerStreamerChatControlRoutes(server, {
    discordChatIntakeRuntime,
    streamerChatRuntime,
    twitchChatIntakeRuntime,
    youtubeLiveChatIntakeRuntime,
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
  registerRealtimeSpikeRoutes(server);
};
