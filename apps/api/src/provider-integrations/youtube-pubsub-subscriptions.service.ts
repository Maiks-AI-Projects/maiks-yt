import { YouTubePubSubSubscriptionService } from "@maiks-yt/integrations";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  YouTubePubSubSubscriptionActor,
  YouTubePubSubSubscriptionControlResult,
  YouTubePubSubSubscriptionRepository
} from "./youtube-pubsub-subscriptions.types.js";

const canManageYouTubePubSub = (actor: YouTubePubSubSubscriptionActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

export class YouTubePubSubSubscriptionControlService {
  public constructor(
    private readonly repository: YouTubePubSubSubscriptionRepository,
    private readonly subscriptionService: Pick<YouTubePubSubSubscriptionService, "getStatus" | "request"> = new YouTubePubSubSubscriptionService()
  ) {}

  public async getStatus(input: { authUserId: string }): Promise<YouTubePubSubSubscriptionControlResult> {
    return await this.withSelectedChannel(input.authUserId, (channelId) => this.subscriptionService.getStatus({ channelId }));
  }

  public async subscribe(input: { authUserId: string }): Promise<YouTubePubSubSubscriptionControlResult> {
    return await this.withSelectedChannel(input.authUserId, (channelId) => this.subscriptionService.request({
      channelId,
      mode: "subscribe"
    }));
  }

  public async unsubscribe(input: { authUserId: string }): Promise<YouTubePubSubSubscriptionControlResult> {
    return await this.withSelectedChannel(input.authUserId, (channelId) => this.subscriptionService.request({
      channelId,
      mode: "unsubscribe"
    }));
  }

  private async withSelectedChannel(
    authUserId: string,
    run: (channelId: string | null) => YouTubePubSubSubscriptionControlResult | Promise<YouTubePubSubSubscriptionControlResult>
  ): Promise<YouTubePubSubSubscriptionControlResult> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "youtube_pubsub_user_unlinked"
      };
    }

    if (!canManageYouTubePubSub(actor)) {
      return {
        ok: false,
        reason: "youtube_pubsub_forbidden"
      };
    }

    const channel = await this.repository.getSelectedYouTubeChannel(actor.domainUserId);

    return await run(channel?.id ?? null);
  }
}
