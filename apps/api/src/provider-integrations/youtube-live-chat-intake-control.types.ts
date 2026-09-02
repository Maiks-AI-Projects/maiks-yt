import type {
  YouTubeLiveChatContext,
  YouTubeLiveChatIntakeStatus
} from "@maiks-yt/integrations";
import type { ProviderChatControlSuccessDto } from "./provider-integrations-browser-contract.rules.js";

export type YouTubeLiveChatIntakeControlActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type YouTubeLiveChatIntakeControlResult =
  | ProviderChatControlSuccessDto
  | {
    ok: false;
    reason: "youtube_live_chat_user_unlinked" | "youtube_live_chat_forbidden";
  };

export interface YouTubeLiveChatIntakeRuntime {
  getStatus(): YouTubeLiveChatIntakeStatus;
  start(options?: { resetQuotaBlock?: boolean }): YouTubeLiveChatIntakeStatus;
  stop(): YouTubeLiveChatIntakeStatus;
}

export interface YouTubeLiveChatIntakeControlRepository {
  resolveActor(authUserId: string): Promise<YouTubeLiveChatIntakeControlActor | null>;
}

export type YouTubeLiveChatContextRepository = {
  resolveSelectedLiveChatContext(): Promise<YouTubeLiveChatContext | null>;
};
