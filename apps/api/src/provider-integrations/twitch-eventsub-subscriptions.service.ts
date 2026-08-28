import { TwitchEventSubSubscriptionService } from "@maiks-yt/integrations";

import {
  projectTwitchEventSubDefaults,
  projectTwitchEventSubEnsureDefaults
} from "./provider-integrations-browser-contract.rules.js";
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

  public async listDefaults(input: {
    authUserId: string;
    broadcasterLogin?: string;
  }): Promise<TwitchEventSubSubscriptionControlResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const result = await this.subscriptionService.listDefaults({
      ...(input.broadcasterLogin ? { broadcasterLogin: input.broadcasterLogin } : {})
    });

    return result.ok ? projectTwitchEventSubDefaults(result) : result;
  }

  public async ensureDefaults(input: {
    authUserId: string;
    broadcasterLogin?: string;
  }): Promise<TwitchEventSubSubscriptionControlResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const result = await this.subscriptionService.ensureDefaults({
      ...(input.broadcasterLogin ? { broadcasterLogin: input.broadcasterLogin } : {})
    });

    return result.ok ? projectTwitchEventSubEnsureDefaults(result) : result;
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true }
    | Extract<TwitchEventSubSubscriptionControlResult, { ok: false }>
  > {
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

    return { ok: true };
  }
}
