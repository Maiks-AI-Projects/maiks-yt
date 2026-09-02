import type { YouTubeLiveChatIntakeStatus } from "@maiks-yt/integrations";

import { projectYouTubeLiveChatControlStatus } from "./provider-integrations-browser-contract.rules.js";
import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  YouTubeLiveChatIntakeControlActor,
  YouTubeLiveChatIntakeControlRepository,
  YouTubeLiveChatIntakeControlResult,
  YouTubeLiveChatIntakeRuntime
} from "./youtube-live-chat-intake-control.types.js";

const canManageYouTubeLiveChatIntake = (actor: YouTubeLiveChatIntakeControlActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

export class YouTubeLiveChatIntakeControlService {
  public constructor(
    private readonly repository: YouTubeLiveChatIntakeControlRepository,
    private readonly runtime: YouTubeLiveChatIntakeRuntime
  ) {}

  public async getStatus(input: { authUserId: string }): Promise<YouTubeLiveChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.getStatus());
  }

  public async start(input: { authUserId: string }): Promise<YouTubeLiveChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.start({ resetQuotaBlock: true }));
  }

  public async stop(input: { authUserId: string }): Promise<YouTubeLiveChatIntakeControlResult> {
    return await this.withActor(input.authUserId, () => this.runtime.stop());
  }

  private async withActor(
    authUserId: string,
    readStatus: () => YouTubeLiveChatIntakeStatus
  ): Promise<YouTubeLiveChatIntakeControlResult> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "youtube_live_chat_user_unlinked"
      };
    }

    if (!canManageYouTubeLiveChatIntake(actor)) {
      return {
        ok: false,
        reason: "youtube_live_chat_forbidden"
      };
    }

    return {
      ...projectYouTubeLiveChatControlStatus(readStatus())
    };
  }
}
