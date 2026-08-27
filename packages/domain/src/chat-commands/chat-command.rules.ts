import type {
  ChatCommandBotIdentity,
  ChatCommandCooldownInput,
  ChatCommandCooldownResult,
  ChatCommandDefinition,
  ChatCommandExecutionProjection,
  ChatCommandName,
  ChatCommandParseInput,
  ChatCommandParseResult,
  ChatCommandRegistry,
  MutableChatCommandCooldownState
} from "./chat-command.types.js";

const canonicalBaseUrl = "https://maiks.yt";
const commandPrefix = "!";
const commandTokenPattern = /^!([a-z0-9-]+)$/i;
const defaultGlobalCooldownMs = 8_000;
const defaultPerUserCooldownMs = 45_000;

const buildResponse = (text: string): string => text.replace(/\s+/g, " ").trim();

export const builtInChatCommandRegistry = [
  {
    name: "commands",
    aliases: ["commands", "help"],
    description: "Show available Maiks.yt chat commands.",
    response: buildResponse(
      "Commands: !website, !schedule, !projects, !games, !links, !discord, !context, !health, !rules."
    ),
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "website",
    aliases: ["website", "site"],
    description: "Share the Maiks.yt home page.",
    response: `Maiks.yt: ${canonicalBaseUrl}/`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "schedule",
    aliases: ["schedule", "streams"],
    description: "Share the stream schedule.",
    response: `Upcoming streams: ${canonicalBaseUrl}/schedule`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "projects",
    aliases: ["projects", "project"],
    description: "Share the public project list.",
    response: `Michael's current projects: ${canonicalBaseUrl}/projects`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "games",
    aliases: ["games"],
    description: "Share the game library.",
    response: `Games Michael plays or is considering: ${canonicalBaseUrl}/games`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "links",
    aliases: ["links", "socials"],
    description: "Share the Creator Hub links page.",
    response: `Creator links: ${canonicalBaseUrl}/links`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "discord",
    aliases: ["discord"],
    description: "Share the Creator Hub page containing the current Discord destination.",
    response: `Join the community through: ${canonicalBaseUrl}/links`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "context",
    aliases: ["context", "about"],
    description: "Share Michael's public context page.",
    response: `Context for Michael and Maiks.yt: ${canonicalBaseUrl}/context`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "health",
    aliases: ["health", "accountability"],
    description: "Share Michael's public health page.",
    response: `Michael's health story: ${canonicalBaseUrl}/about/health`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  },
  {
    name: "rules",
    aliases: ["rules", "communityrules"],
    description: "Share the community rules.",
    response: `Community rules: ${canonicalBaseUrl}/community-rules`,
    cooldown: {
      globalMs: defaultGlobalCooldownMs,
      perUserMs: defaultPerUserCooldownMs
    }
  }
] as const satisfies ChatCommandRegistry;

const normalizeToken = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

const normalizeIdentityValues = (values: readonly string[] | undefined): Set<string> =>
  new Set((values ?? []).map(normalizeToken).filter((value) => value.length > 0));

const isSelfOrBotMessage = (
  input: Pick<ChatCommandParseInput, "actorKind" | "authorName" | "botIdentity" | "providerUserId" | "providerUserLogin">
): boolean => {
  if (input.actorKind !== "human") {
    return true;
  }

  const botIdentity: ChatCommandBotIdentity = input.botIdentity ?? {};
  const displayNames = normalizeIdentityValues(botIdentity.displayNames);
  const providerUserIds = normalizeIdentityValues(botIdentity.providerUserIds);
  const providerUserLogins = normalizeIdentityValues(botIdentity.providerUserLogins);
  const authorName = normalizeToken(input.authorName);
  const providerUserId = normalizeToken(input.providerUserId);
  const providerUserLogin = normalizeToken(input.providerUserLogin);

  return (authorName.length > 0 && displayNames.has(authorName))
    || (providerUserId.length > 0 && providerUserIds.has(providerUserId))
    || (providerUserLogin.length > 0 && providerUserLogins.has(providerUserLogin));
};

export const parseChatCommand = (
  input: ChatCommandParseInput,
  registry: ChatCommandRegistry = builtInChatCommandRegistry
): ChatCommandParseResult => {
  const normalizedInput = input.message.trim();

  if (isSelfOrBotMessage(input)) {
    return {
      ok: false,
      reason: "self_or_bot_message"
    };
  }

  if (!normalizedInput.startsWith(commandPrefix)) {
    return {
      ok: false,
      reason: "ordinary_chat"
    };
  }

  const match = commandTokenPattern.exec(normalizedInput);

  if (!match?.[1]) {
    return {
      ok: false,
      reason: "malformed_command"
    };
  }

  const commandToken = match[1].toLowerCase();
  const command = registry.find((candidate) =>
    candidate.aliases.some((alias) => alias.toLowerCase() === commandToken)
  );

  if (!command) {
    return {
      ok: false,
      reason: "unsupported_command"
    };
  }

  return {
    ok: true,
    canonicalName: command.name,
    command,
    matchedAlias: commandToken,
    normalizedInput
  };
};

const createUserCommandKey = (
  input: Pick<ChatCommandCooldownInput, "command" | "provider" | "userKey">
): string => `${input.provider}:${input.userKey.toLowerCase()}:${input.command.name}`;

export const createInMemoryChatCommandCooldownState = (): MutableChatCommandCooldownState => ({
  globalCommandLastUsedAt: new Map<ChatCommandName, number>(),
  userCommandLastUsedAt: new Map<string, number>()
});

export const evaluateChatCommandCooldown = (
  input: ChatCommandCooldownInput,
  state: MutableChatCommandCooldownState
): ChatCommandCooldownResult => {
  const globalLastUsedAt = state.globalCommandLastUsedAt.get(input.command.name);
  const globalElapsedMs = typeof globalLastUsedAt === "number"
    ? input.nowMs - globalLastUsedAt
    : Number.POSITIVE_INFINITY;

  if (globalElapsedMs < input.command.cooldown.globalMs) {
    return {
      ok: false,
      reason: "global_cooldown",
      retryAfterMs: input.command.cooldown.globalMs - globalElapsedMs
    };
  }

  const userCommandKey = createUserCommandKey(input);
  const userLastUsedAt = state.userCommandLastUsedAt.get(userCommandKey);
  const userElapsedMs = typeof userLastUsedAt === "number"
    ? input.nowMs - userLastUsedAt
    : Number.POSITIVE_INFINITY;

  if (userElapsedMs < input.command.cooldown.perUserMs) {
    return {
      ok: false,
      reason: "per_user_command_cooldown",
      retryAfterMs: input.command.cooldown.perUserMs - userElapsedMs
    };
  }

  return { ok: true };
};

export const markChatCommandCooldownUsed = (
  input: ChatCommandCooldownInput,
  state: MutableChatCommandCooldownState
): void => {
  state.globalCommandLastUsedAt.set(input.command.name, input.nowMs);
  state.userCommandLastUsedAt.set(createUserCommandKey(input), input.nowMs);
};

export const createChatCommandExecutionProjection = (
  command: ChatCommandDefinition
): ChatCommandExecutionProjection => ({
  authorKind: "bot",
  message: command.response,
  overlay: {
    visibleOnOverlayByDefault: false
  }
});
