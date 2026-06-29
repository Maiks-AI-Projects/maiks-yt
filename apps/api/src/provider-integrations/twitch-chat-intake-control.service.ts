import type { TwitchChatIntakeStatus } from "@maiks-yt/integrations";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  TwitchChatIntakeControlActor,
  TwitchChatIntakeControlRepository,
  TwitchChatIntakeControlResult,
  TwitchChatIntakeRuntime
} from "./twitch-chat-intake-control.types.js";

const canManageTwitchChatIntake = (actor: TwitchChatIntakeControlActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

export class TwitchChatIntakeControlService {
  public constructor(
    private readonly repository: TwitchChatIntakeControlRepository,
    private readonly runtime: TwitchChatIntakeRuntime
  ) {}

  public async getStatus(input: { authUserId: string }): Promise<TwitchChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.getStatus());
  }

  public async start(input: { authUserId: string }): Promise<TwitchChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.start());
  }

  public async stop(input: { authUserId: string }): Promise<TwitchChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.stop());
  }

  private async withActor(
    authUserId: string,
    readStatus: () => TwitchChatIntakeStatus
  ): Promise<TwitchChatIntakeControlResult> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "twitch_chat_user_unlinked"
      };
    }

    if (!canManageTwitchChatIntake(actor)) {
      return {
        ok: false,
        reason: "twitch_chat_forbidden"
      };
    }

    return {
      ok: true,
      readOnly: true,
      status: readStatus()
    };
  }
}
