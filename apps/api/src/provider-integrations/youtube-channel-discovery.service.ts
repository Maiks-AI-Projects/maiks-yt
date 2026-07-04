import {
  discoverYouTubeChannels,
  resolveYouTubeOwnerOAuthConfig,
  youtubeLiveChatReadOnlyScope,
  type YouTubeChannelsList
} from "@maiks-yt/integrations";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  YouTubeChannelDiscoveryActor,
  YouTubeChannelDiscoveryRepository,
  YouTubeChannelDiscoveryServiceResult,
  YouTubePersistedChannel
} from "./youtube-channel-discovery.types.js";

type YouTubeChannelDiscoveryServiceOptions = {
  apiBaseUrl?: string;
  env?: Record<string, string | undefined>;
  listChannels?: YouTubeChannelsList;
  now?: () => Date;
};

const canManageProviderIntegrations = (actor: YouTubeChannelDiscoveryActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

const getSelectedChannelId = (channels: readonly YouTubePersistedChannel[]): string | null =>
  channels.find((channel) => channel.selectedForLiveChat)?.id ?? null;

const isValidProviderChannelId = (value: string): boolean => {
  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed.length <= 191 && !/[\s]/.test(trimmed);
};

export class YouTubeChannelDiscoveryService {
  public constructor(
    private readonly repository: YouTubeChannelDiscoveryRepository,
    private readonly options: YouTubeChannelDiscoveryServiceOptions = {}
  ) {}

  public async discover(input: { authUserId: string }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return await this.discoverChannelsForActor(actor.domainUserId);
  }

  public async listSelection(input: { authUserId: string }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const channels = await this.repository.listYouTubeChannels(actor.domainUserId);

    return {
      ok: true,
      channels,
      selectedChannelId: getSelectedChannelId(channels)
    };
  }

  public async discoverAndStore(input: { authUserId: string }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const discovered = await this.discoverChannelsForActor(actor.domainUserId);

    if (!discovered.ok) {
      return discovered;
    }

    const now = this.options.now?.() ?? new Date();
    await this.repository.upsertYouTubeChannels({
      domainUserId: actor.domainUserId,
      channels: discovered.channels.map((channel) => ({
        id: channel.id,
        title: channel.title,
        customUrl: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl
      })),
      now
    });

    const channels = await this.repository.listYouTubeChannels(actor.domainUserId);

    return {
      ok: true,
      channels,
      selectedChannelId: getSelectedChannelId(channels)
    };
  }

  public async selectLiveChatChannel(input: {
    authUserId: string;
    channelId: string | null;
  }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const channelId = input.channelId?.trim() || null;

    if (channelId && !isValidProviderChannelId(channelId)) {
      return {
        ok: false,
        reason: "youtube_channel_not_found"
      };
    }

    const result = await this.repository.selectYouTubeLiveChatChannel({
      domainUserId: actor.domainUserId,
      providerChannelId: channelId,
      now: this.options.now?.() ?? new Date()
    });

    if (result === "not_found") {
      return {
        ok: false,
        reason: "youtube_channel_not_found"
      };
    }

    const channels = await this.repository.listYouTubeChannels(actor.domainUserId);

    return {
      ok: true,
      channels,
      selectedChannelId: getSelectedChannelId(channels)
    };
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true; domainUserId: string }
    | Extract<YouTubeChannelDiscoveryServiceResult, { ok: false }>
  > {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "provider_integrations_user_unlinked"
      };
    }

    if (!canManageProviderIntegrations(actor)) {
      return {
        ok: false,
        reason: "provider_integrations_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }

  private async discoverChannelsForActor(domainUserId: string): Promise<YouTubeChannelDiscoveryServiceResult> {
    const credential = await this.repository.getActiveYouTubeCredential(domainUserId);

    if (!credential) {
      return {
        ok: false,
        reason: "youtube_channel_credential_missing"
      };
    }

    if (!credential.scopes.includes(youtubeLiveChatReadOnlyScope)) {
      return {
        ok: false,
        reason: "youtube_channel_scope_missing"
      };
    }

    const config = resolveYouTubeOwnerOAuthConfig(this.options.env ?? process.env, this.getFallbackRedirectUri());

    if (!config.ok) {
      return {
        ok: false,
        reason: config.reason
      };
    }

    return await discoverYouTubeChannels({
      config,
      credential,
      ...(this.options.listChannels ? { listChannels: this.options.listChannels } : {}),
      ...(this.options.now ? { now: this.options.now() } : {})
    });
  }

  private getFallbackRedirectUri(): string {
    const apiBaseUrl = this.options.apiBaseUrl ?? process.env.API_PUBLIC_BASE_URL ?? "https://api-dev.maiks.yt";
    return new URL("/admin/provider-integrations/youtube/callback", apiBaseUrl).toString();
  }
}
