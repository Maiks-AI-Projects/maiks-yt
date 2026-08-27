import type { DatabasePool } from "@maiks-yt/database";
import type { OverlayFakeChatMessageReceivedEvent, StreamerChatMessage } from "@maiks-yt/events";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { registerAdminOverviewActivityRoutes } from "./admin-overview/index.js";
import { configuredAuthProviderIds } from "./auth/better-auth.service.js";
import { registerBackupHealthRoutes, registerBackupKeyDataExportRoutes } from "./backup/index.js";
import {
  registerAccountDomainRoutes,
  registerAccountProfileRoutes,
  registerStreamVisibilityPreferencesRoutes,
  type AuthSessionSnapshot
} from "./account/index.js";
import { registerActionPanelRoutes } from "./actions/index.js";
import { registerControlPanelNavigationRoutes } from "./control-panel/index.js";
import {
  registerEventRoutingAdminRoutes,
  registerEventRoutingDispatchRoutes,
  type EventRoutingPlaybackPublisher
} from "./event-routing/index.js";
import { registerDevOwnerTokenRoutes } from "./dev-testing/index.js";
import { registerFakeLocalModerationRoutes } from "./fake-local-moderation/index.js";
import { registerGameLibraryRoutes } from "./games/index.js";
import { registerCreatorLinkAdminRoutes, registerCreatorLinkReadRoutes } from "./links/index.js";
import {
  registerLocalAgentAdminStatusRoutes,
  type LocalAgentRuntimeService,
  type LocalAgentServerConfig
} from "./local-agent/index.js";
import { registerModeratorAdminRoutes } from "./moderators/index.js";
import { registerMoneyAdminRoutes } from "./money/index.js";
import { registerNotificationAdminRoutes } from "./notifications/index.js";
import { registerObsWidgetBridgeRoute, type ObsWidgetBridgeRuntime } from "./obs-bridge/index.js";
import { registerOverlayRoutes } from "./overlay/index.js";
import { registerContentPageRoutes } from "./pages/index.js";
import {
  registerDiscordChatIntakeControlRoutes,
  registerDiscordWebhookEventsRoutes,
  registerProviderEventIntakeAdminRoutes,
  registerProviderIntegrationStatusRoutes,
  registerTwitchChatIntakeControlRoutes,
  registerTwitchEventSubSubscriptionRoutes,
  registerTwitchEventSubWebhookRoutes,
  registerYouTubeActivitiesPollRoutes,
  registerYouTubeChannelDiscoveryRoutes,
  registerYouTubeLiveChatIntakeControlRoutes,
  registerYouTubeOwnerConsentRoutes,
  registerYouTubePubSubSubscriptionRoutes,
  registerYouTubePubSubWebhookRoutes
} from "./provider-integrations/index.js";
import type { ProviderEventIntakeLogService } from "./provider-integrations/index.js";
import { registerProjectAdminRoutes, registerProjectReadRoutes } from "./projects/index.js";
import { registerRealtimeSpikeRoutes } from "./realtime/index.js";
import { registerSessionAdminRoutes } from "./sessions/index.js";
import { registerStreamScheduleRoutes } from "./schedule/index.js";
import { registerTestingSmokeStateRoutes } from "./testing/index.js";
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
import { registerPublicUpdateReadRoutes } from "./updates/index.js";
import type {
  DiscordChatReadOnlyIntakeService,
  TwitchChatReadOnlyIntakeService,
  YouTubeLiveChatReadOnlyIntakeService
} from "@maiks-yt/integrations";
import type { OverlayRuntime } from "./overlay/index.js";
import type { UrlAccessSurface } from "@maiks-yt/domain/security";
import type { RequireUrlAccessTokenForRequest } from "./url-access-token-request-access.service.js";

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
  discordChatModerationService: import("@maiks-yt/integrations").DiscordChatModerationService;
  discordChatWarningDeliveryService: import("@maiks-yt/integrations").DiscordChatWarningDeliveryService;
  fakeLocalModerationRuntime: InMemoryFakeLocalModerationRuntime;
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
  localAgentRuntime: LocalAgentRuntimeService;
  localAgentServerConfig: LocalAgentServerConfig;
  obsWidgetBridgeRuntime: ObsWidgetBridgeRuntime;
  overlayRuntime: OverlayRuntime;
  publishEventRoutingPlayback: EventRoutingPlaybackPublisher;
  providerEventIntakeLogService: ProviderEventIntakeLogService;
  recordFakeLocalStreamerChatMessage: (event: OverlayFakeChatMessageReceivedEvent) => StreamerChatMessage | null;
  requireStreamerChatModerationPermission: RequireStreamerChatModerationPermission;
  requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest;
  server: FastifyInstance;
  streamerChatModerationAccessService: StreamerChatModerationAccessService;
  streamerChatModerationRuntime: InMemoryStreamerChatModerationRuntime;
  streamerChatModerationStore: StreamerChatModerationStoreService;
  streamerChatRuntime: StreamerChatRuntime;
  twitchChatIntakeRuntime: TwitchChatReadOnlyIntakeService;
  twitchChatModerationService: import("@maiks-yt/integrations").TwitchChatModerationService;
  twitchChatWarningDeliveryService: import("@maiks-yt/integrations").TwitchChatWarningDeliveryService;
  validateUrlAccessTokenForRequest: ValidateUrlAccessTokenForRequest;
  youtubeChatWarningDeliveryService: import("@maiks-yt/integrations").YouTubeChatWarningDeliveryService;
  youtubeLiveChatIntakeRuntime: YouTubeLiveChatReadOnlyIntakeService;
};

export const registerApplicationRoutes = ({
  discordChatIntakeRuntime,
  discordChatModerationService,
  discordChatWarningDeliveryService,
  fakeLocalModerationRuntime,
  getAuthSession,
  getDatabasePool,
  localAgentRuntime,
  localAgentServerConfig,
  obsWidgetBridgeRuntime,
  overlayRuntime,
  publishEventRoutingPlayback,
  providerEventIntakeLogService,
  recordFakeLocalStreamerChatMessage,
  requireStreamerChatModerationPermission,
  requireUrlAccessTokenForRequest,
  server,
  streamerChatModerationAccessService,
  streamerChatModerationRuntime,
  streamerChatModerationStore,
  streamerChatRuntime,
  twitchChatIntakeRuntime,
  twitchChatModerationService,
  twitchChatWarningDeliveryService,
  validateUrlAccessTokenForRequest,
  youtubeChatWarningDeliveryService,
  youtubeLiveChatIntakeRuntime
}: RegisterApplicationRoutesInput): void => {
  registerActionPanelRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerControlPanelNavigationRoutes(server, {
    getDatabasePool,
    requireUrlAccessTokenForRequest
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
  registerAccountProfileRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerProjectReadRoutes(server, {
    getDatabasePool
  });
  registerPublicUpdateReadRoutes(server, {
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
  registerGameLibraryRoutes(server, {
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
  registerAdminOverviewActivityRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerModeratorAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerMoneyAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerSessionAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerTestingSmokeStateRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerEventRoutingAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerNotificationAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerBackupHealthRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerBackupKeyDataExportRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerLocalAgentAdminStatusRoutes(server, {
    config: localAgentServerConfig,
    getAuthSession,
    getDatabasePool,
    runtime: localAgentRuntime
  });
  registerDevOwnerTokenRoutes(server, {
    getDatabasePool
  });
  registerProviderIntegrationStatusRoutes(server, {
    getAuthSession,
    getDatabasePool,
    getRuntimeState: () => ({
      discordChatIntake: discordChatIntakeRuntime.getStatus(),
      twitchChatIntake: twitchChatIntakeRuntime.getStatus(),
      youtubeLiveChatIntake: youtubeLiveChatIntakeRuntime.getStatus()
    })
  });
  registerProviderEventIntakeAdminRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerDiscordWebhookEventsRoutes(server, {
    intakeLogService: providerEventIntakeLogService
  });
  registerTwitchEventSubWebhookRoutes(server, {
    intakeLogService: providerEventIntakeLogService
  });
  registerYouTubePubSubWebhookRoutes(server, {
    intakeLogService: providerEventIntakeLogService
  });
  registerYouTubePubSubSubscriptionRoutes(server, {
    getAuthSession,
    getDatabasePool
  });
  registerYouTubeActivitiesPollRoutes(server, {
    getAuthSession,
    getDatabasePool,
    intakeLogService: providerEventIntakeLogService
  });
  registerTwitchEventSubSubscriptionRoutes(server, {
    getAuthSession,
    getDatabasePool
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
    getDatabasePool,
    requireUrlAccessTokenForRequest,
    streamerChatRuntime,
    twitchChatIntakeRuntime,
    youtubeLiveChatIntakeRuntime
  });
  registerStreamerChatModerationRoutes(server, {
    accessService: streamerChatModerationAccessService,
    discordModerationService: discordChatModerationService,
    discordWarningDeliveryService: discordChatWarningDeliveryService,
    moderationRuntime: streamerChatModerationRuntime,
    moderationStore: streamerChatModerationStore,
    streamerChatRuntime,
    twitchModerationService: twitchChatModerationService,
    twitchWarningDeliveryService: twitchChatWarningDeliveryService,
    youtubeWarningDeliveryService: youtubeChatWarningDeliveryService
  });
  registerOverlayRoutes(server, {
    fakeLocalModerationRuntime,
    overlayRuntime,
    recordFakeLocalStreamerChatMessage,
    requireStreamerChatModerationPermission,
    requireUrlAccessTokenForRequest,
    validateUrlAccessToken: validateUrlAccessTokenForRequest
  });
  registerObsWidgetBridgeRoute(server, {
    requireUrlAccessTokenForRequest,
    runtime: obsWidgetBridgeRuntime,
    validateUrlAccessToken: validateUrlAccessTokenForRequest
  });
  registerEventRoutingDispatchRoutes(server, {
    getDatabasePool,
    publishPlayback: publishEventRoutingPlayback
  });
  registerRealtimeSpikeRoutes(server);
};
