import {
  discoverYouTubeChannels,
  resolveYouTubeOwnerOAuthConfig,
  youtubeLiveChatReadOnlyScope,
  type YouTubeChannelDiscoveryResult,
  type YouTubeChannelsList
} from "@maiks-yt/integrations";

import {
  getYouTubeChannelSelectionRefSecret,
  projectDiscoveredYouTubeChannels,
  projectYouTubeChannels,
  resolveYouTubeChannelSelectionRef
} from "./provider-integrations-browser-contract.rules.js";
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
  channelSelectionRefSecret?: string | null;
  listChannels?: YouTubeChannelsList;
  now?: () => Date;
};

const canManageProviderIntegrations = (actor: YouTubeChannelDiscoveryActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
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

    const discovered = await this.discoverChannelsForActor(actor.domainUserId);

    return discovered.ok ? projectDiscoveredYouTubeChannels(discovered) : discovered;
  }

  public async listSelection(input: { authUserId: string }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const channels = await this.repository.listYouTubeChannels(actor.domainUserId);

    return this.projectStoredChannels({
      authUserId: input.authUserId,
      domainUserId: actor.domainUserId,
      channels
    });
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

    return this.projectStoredChannels({
      authUserId: input.authUserId,
      domainUserId: actor.domainUserId,
      channels
    });
  }

  public async selectLiveChatChannel(input: {
    authUserId: string;
    channelRef: string | null;
  }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const channelRef = input.channelRef?.trim() || null;
    const channels = await this.repository.listYouTubeChannels(actor.domainUserId);
    let channelId: string | null = null;

    if (channelRef) {
      const secret = this.getSelectionRefSecret();

      if (!secret) {
        return {
          ok: false,
          reason: "youtube_channel_ref_unavailable"
        };
      }

      channelId = resolveYouTubeChannelSelectionRef({
        authUserId: input.authUserId,
        channelRef,
        channels,
        domainUserId: actor.domainUserId,
        secret
      });

      if (!channelId) {
        return {
          ok: false,
          reason: "youtube_channel_not_found"
        };
      }
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

    return this.projectStoredChannels({
      authUserId: input.authUserId,
      domainUserId: actor.domainUserId,
      channels: await this.repository.listYouTubeChannels(actor.domainUserId)
    });
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

  private async discoverChannelsForActor(domainUserId: string): Promise<YouTubeChannelDiscoveryResult | Extract<YouTubeChannelDiscoveryServiceResult, { ok: false }>> {
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
    const apiBaseUrl = this.options.apiBaseUrl ?? process.env.API_PUBLIC_BASE_URL ?? "https://api.maiks.yt";
    return new URL("/admin/provider-integrations/youtube/callback", apiBaseUrl).toString();
  }

  private getSelectionRefSecret(): string | null {
    return this.options.channelSelectionRefSecret
      ?? getYouTubeChannelSelectionRefSecret(this.options.env ?? process.env);
  }

  private projectStoredChannels(input: {
    authUserId: string;
    channels: readonly YouTubePersistedChannel[];
    domainUserId: string;
  }): YouTubeChannelDiscoveryServiceResult {
    const secret = this.getSelectionRefSecret();

    if (!secret) {
      return {
        ok: false,
        reason: "youtube_channel_ref_unavailable"
      };
    }

    return projectYouTubeChannels({
      authUserId: input.authUserId,
      channels: input.channels,
      domainUserId: input.domainUserId,
      secret
    });
  }
}
