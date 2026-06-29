import type { TwitchChatIntakeStatus } from "@maiks-yt/integrations";

export type TwitchChatIntakeControlActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type TwitchChatIntakeControlResult =
  | {
    ok: true;
    readOnly: true;
    status: TwitchChatIntakeStatus;
  }
  | {
    ok: false;
    reason: "twitch_chat_user_unlinked" | "twitch_chat_forbidden";
  };

export interface TwitchChatIntakeRuntime {
  getStatus(): TwitchChatIntakeStatus;
  start(): TwitchChatIntakeStatus;
  stop(): TwitchChatIntakeStatus;
}

export interface TwitchChatIntakeControlRepository {
  resolveActor(authUserId: string): Promise<TwitchChatIntakeControlActor | null>;
}
