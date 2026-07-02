import type { DiscordChatIntakeStatus } from "@maiks-yt/integrations";

export type DiscordChatIntakeControlActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type DiscordChatIntakeControlResult =
  | {
    ok: true;
    readOnly: true;
    status: DiscordChatIntakeStatus;
  }
  | {
    ok: false;
    reason: "discord_chat_user_unlinked" | "discord_chat_forbidden";
  };

export interface DiscordChatIntakeRuntime {
  getStatus(): DiscordChatIntakeStatus;
  start(): DiscordChatIntakeStatus;
  stop(): DiscordChatIntakeStatus;
}

export interface DiscordChatIntakeControlRepository {
  resolveActor(authUserId: string): Promise<DiscordChatIntakeControlActor | null>;
}
