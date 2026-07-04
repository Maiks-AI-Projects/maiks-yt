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
  YouTubeChannelDiscoveryServiceResult
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

export class YouTubeChannelDiscoveryService {
  public constructor(
    private readonly repository: YouTubeChannelDiscoveryRepository,
    private readonly options: YouTubeChannelDiscoveryServiceOptions = {}
  ) {}

  public async discover(input: { authUserId: string }): Promise<YouTubeChannelDiscoveryServiceResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

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

    const credential = await this.repository.getActiveYouTubeCredential(actor.domainUserId);

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
