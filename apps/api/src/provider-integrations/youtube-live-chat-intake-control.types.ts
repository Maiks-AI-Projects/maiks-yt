import type {
  YouTubeLiveChatContext,
  YouTubeLiveChatIntakeStatus
} from "@maiks-yt/integrations";

export type YouTubeLiveChatIntakeControlActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type YouTubeLiveChatIntakeControlResult =
  | {
    ok: true;
    readOnly: true;
    status: YouTubeLiveChatIntakeStatus;
  }
  | {
    ok: false;
    reason: "youtube_live_chat_user_unlinked" | "youtube_live_chat_forbidden";
  };

export interface YouTubeLiveChatIntakeRuntime {
  getStatus(): YouTubeLiveChatIntakeStatus;
  start(): YouTubeLiveChatIntakeStatus;
  stop(): YouTubeLiveChatIntakeStatus;
}

export interface YouTubeLiveChatIntakeControlRepository {
  resolveActor(authUserId: string): Promise<YouTubeLiveChatIntakeControlActor | null>;
}

export type YouTubeLiveChatContextRepository = {
  resolveSelectedLiveChatContext(): Promise<YouTubeLiveChatContext | null>;
};
