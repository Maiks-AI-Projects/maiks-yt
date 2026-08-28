import { YouTubePubSubSubscriptionService } from "@maiks-yt/integrations";

import {
  projectYouTubePubSubRequest,
  projectYouTubePubSubStatus
} from "./provider-integrations-browser-contract.rules.js";
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
    const channel = await this.resolveSelectedChannel(input.authUserId);

    if (!channel.ok) {
      return channel;
    }

    const result = this.subscriptionService.getStatus({ channelId: channel.channelId });

    return result.ok ? projectYouTubePubSubStatus(result) : result;
  }

  public async subscribe(input: { authUserId: string }): Promise<YouTubePubSubSubscriptionControlResult> {
    const channel = await this.resolveSelectedChannel(input.authUserId);

    if (!channel.ok) {
      return channel;
    }

    const result = await this.subscriptionService.request({
      channelId: channel.channelId,
      mode: "subscribe"
    });

    return result.ok ? projectYouTubePubSubRequest(result) : result;
  }

  public async unsubscribe(input: { authUserId: string }): Promise<YouTubePubSubSubscriptionControlResult> {
    const channel = await this.resolveSelectedChannel(input.authUserId);

    if (!channel.ok) {
      return channel;
    }

    const result = await this.subscriptionService.request({
      channelId: channel.channelId,
      mode: "unsubscribe"
    });

    return result.ok ? projectYouTubePubSubRequest(result) : result;
  }

  private async resolveSelectedChannel(authUserId: string): Promise<
    | { ok: true; channelId: string | null }
    | Extract<YouTubePubSubSubscriptionControlResult, { ok: false }>
  > {
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

    return {
      channelId: channel?.id ?? null,
      ok: true
    };
  }
}
