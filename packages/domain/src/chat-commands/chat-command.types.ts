export type ChatCommandProvider = "twitch" | "youtube" | "discord";

export type ChatCommandName =
  | "commands"
  | "website"
  | "schedule"
  | "projects"
  | "games"
  | "links"
  | "discord"
  | "context"
  | "health"
  | "rules";

export type ChatCommandDefinition = {
  name: ChatCommandName;
  aliases: readonly string[];
  description: string;
  response: string;
  cooldown: {
    globalMs: number;
    perUserMs: number;
  };
};

export type ChatCommandRegistry = readonly ChatCommandDefinition[];

export type ChatCommandActorKind = "human" | "bot" | "system";

export type ChatCommandBotIdentity = {
  displayNames?: readonly string[];
  providerUserIds?: readonly string[];
  providerUserLogins?: readonly string[];
};

export type ChatCommandParseInput = {
  actorKind: ChatCommandActorKind;
  authorName: string;
  botIdentity?: ChatCommandBotIdentity;
  message: string;
  provider: ChatCommandProvider;
  providerUserId?: string | null;
  providerUserLogin?: string | null;
};

export type ChatCommandParseResult =
  | {
    ok: true;
    command: ChatCommandDefinition;
    canonicalName: ChatCommandName;
    matchedAlias: string;
    normalizedInput: string;
  }
  | {
    ok: false;
    reason:
      | "ordinary_chat"
      | "malformed_command"
      | "unsupported_command"
      | "self_or_bot_message";
  };

export type ChatCommandCooldownState = {
  globalCommandLastUsedAt: ReadonlyMap<ChatCommandName, number>;
  userCommandLastUsedAt: ReadonlyMap<string, number>;
};

export type MutableChatCommandCooldownState = {
  globalCommandLastUsedAt: Map<ChatCommandName, number>;
  userCommandLastUsedAt: Map<string, number>;
};

export type ChatCommandCooldownInput = {
  command: ChatCommandDefinition;
  nowMs: number;
  provider: ChatCommandProvider;
  userKey: string;
};

export type ChatCommandCooldownResult =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason: "global_cooldown" | "per_user_command_cooldown";
    retryAfterMs: number;
  };

export type ChatCommandExecutionProjection = {
  authorKind: "bot";
  message: string;
  overlay: {
    visibleOnOverlayByDefault: false;
  };
};
