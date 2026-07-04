import { TwitchEventSubSubscriptionService } from "@maiks-yt/integrations";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  TwitchEventSubSubscriptionControlResult,
  TwitchEventSubSubscriptionRepository
} from "./twitch-eventsub-subscriptions.types.js";

const canManageTwitchEventSub = (rolePermissionValues: readonly unknown[]): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

export class TwitchEventSubSubscriptionControlService {
  public constructor(
    private readonly repository: TwitchEventSubSubscriptionRepository,
    private readonly subscriptionService: Pick<TwitchEventSubSubscriptionService, "ensureDefaults" | "listDefaults"> = new TwitchEventSubSubscriptionService()
  ) {}

  public async listDefaults(input: { authUserId: string }): Promise<TwitchEventSubSubscriptionControlResult> {
    return await this.withActor(input.authUserId, () => this.subscriptionService.listDefaults());
  }

  public async ensureDefaults(input: { authUserId: string }): Promise<TwitchEventSubSubscriptionControlResult> {
    return await this.withActor(input.authUserId, () => this.subscriptionService.ensureDefaults());
  }

  private async withActor(
    authUserId: string,
    run: () => Promise<TwitchEventSubSubscriptionControlResult>
  ): Promise<TwitchEventSubSubscriptionControlResult> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "twitch_eventsub_user_unlinked"
      };
    }

    if (!canManageTwitchEventSub(actor.rolePermissionValues)) {
      return {
        ok: false,
        reason: "twitch_eventsub_forbidden"
      };
    }

    return await run();
  }
}
