import type { DiscordChatIntakeStatus } from "@maiks-yt/integrations";

import { projectDiscordChatControlStatus } from "./provider-integrations-browser-contract.rules.js";
import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  DiscordChatIntakeControlActor,
  DiscordChatIntakeControlRepository,
  DiscordChatIntakeControlResult,
  DiscordChatIntakeRuntime
} from "./discord-chat-intake-control.types.js";

const canManageDiscordChatIntake = (actor: DiscordChatIntakeControlActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

export class DiscordChatIntakeControlService {
  public constructor(
    private readonly repository: DiscordChatIntakeControlRepository,
    private readonly runtime: DiscordChatIntakeRuntime
  ) {}

  public async getStatus(input: { authUserId: string }): Promise<DiscordChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.getStatus());
  }

  public async start(input: { authUserId: string }): Promise<DiscordChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.start());
  }

  public async stop(input: { authUserId: string }): Promise<DiscordChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.stop());
  }

  private async withActor(
    authUserId: string,
    readStatus: () => DiscordChatIntakeStatus
  ): Promise<DiscordChatIntakeControlResult> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "discord_chat_user_unlinked"
      };
    }

    if (!canManageDiscordChatIntake(actor)) {
      return {
        ok: false,
        reason: "discord_chat_forbidden"
      };
    }

    return {
      ...projectDiscordChatControlStatus(readStatus())
    };
  }
}
