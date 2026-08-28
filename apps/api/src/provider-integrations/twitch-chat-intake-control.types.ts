import type { TwitchChatIntakeStatus } from "@maiks-yt/integrations";
import type { ProviderChatControlSuccessDto } from "./provider-integrations-browser-contract.rules.js";

export type TwitchChatIntakeControlActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type TwitchChatIntakeControlResult =
  | ProviderChatControlSuccessDto
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
