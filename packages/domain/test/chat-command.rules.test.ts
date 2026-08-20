import { describe, expect, it } from "vitest";

import {
  builtInChatCommandRegistry,
  createChatCommandExecutionProjection,
  createInMemoryChatCommandCooldownState,
  evaluateChatCommandCooldown,
  markChatCommandCooldownUsed,
  parseChatCommand
} from "../src/chat-commands/index.js";

const parseTwitch = (message: string, overrides: Partial<Parameters<typeof parseChatCommand>[0]> = {}) =>
  parseChatCommand({
    actorKind: "human",
    authorName: "Viewer",
    message,
    provider: "twitch",
    providerUserId: "viewer-id",
    providerUserLogin: "viewer_login",
    ...overrides
  });

describe("chat command parser", () => {
  it("parses exact built-in commands and aliases case-insensitively", () => {
    expect(parseTwitch("!Website")).toMatchObject({
      ok: true,
      canonicalName: "website",
      matchedAlias: "website"
    });
    expect(parseTwitch("!project")).toMatchObject({
      ok: true,
      canonicalName: "projects",
      matchedAlias: "project"
    });
    expect(parseTwitch("!help")).toMatchObject({
      ok: true,
      canonicalName: "commands",
      matchedAlias: "help"
    });
    expect(parseTwitch("!discord")).toMatchObject({
      ok: true,
      canonicalName: "discord",
      matchedAlias: "discord"
    });
  });

  it("ignores ordinary chat and rejects malformed or unsupported command-shaped input", () => {
    expect(parseTwitch("hello !website")).toEqual({
      ok: false,
      reason: "ordinary_chat"
    });
    expect(parseTwitch("!website please")).toEqual({
      ok: false,
      reason: "malformed_command"
    });
    expect(parseTwitch("!donate")).toEqual({
      ok: false,
      reason: "unsupported_command"
    });
  });

  it("prevents bot and self loops before command execution", () => {
    expect(parseTwitch("!website", {
      actorKind: "bot"
    })).toEqual({
      ok: false,
      reason: "self_or_bot_message"
    });
    expect(parseTwitch("!website", {
      authorName: "MaiksBot",
      botIdentity: {
        displayNames: ["maiksbot"],
        providerUserIds: ["bot-id"],
        providerUserLogins: ["maiksbot"]
      },
      providerUserId: "bot-id",
      providerUserLogin: "maiksbot"
    })).toEqual({
      ok: false,
      reason: "self_or_bot_message"
    });
  });

  it("projects bot replies as non-overlay output with canonical URLs", () => {
    const parsed = parseTwitch("!rules");

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(createChatCommandExecutionProjection(parsed.command)).toEqual({
      authorKind: "bot",
      message: "Community rules: https://maiks.yt/community-rules",
      overlay: {
        visibleOnOverlayByDefault: false
      }
    });
  });

  it("returns the complete first-stream command list in chat", () => {
    const parsed = parseTwitch("!commands");

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.command.response).toBe(
      "Commands: !website, !schedule, !projects, !games, !links, !discord, !context, !health, !rules."
    );
  });

  it("keeps health and Discord replies on their approved public pages", () => {
    const health = parseTwitch("!health");
    const discord = parseTwitch("!discord");

    expect(health.ok && health.command.response).toBe("Michael's health story: https://maiks.yt/about/health");
    expect(discord.ok && discord.command.response).toBe("Join the community through: https://maiks.yt/links");
  });
});

describe("chat command cooldowns", () => {
  it("applies global and per-user per-command cooldowns", () => {
    const state = createInMemoryChatCommandCooldownState();
    const command = builtInChatCommandRegistry.find((candidate) => candidate.name === "website");

    expect(command).toBeDefined();
    if (!command) {
      return;
    }

    expect(evaluateChatCommandCooldown({
      command,
      nowMs: 1_000,
      provider: "twitch",
      userKey: "viewer-1"
    }, state)).toEqual({ ok: true });

    markChatCommandCooldownUsed({
      command,
      nowMs: 1_000,
      provider: "twitch",
      userKey: "viewer-1"
    }, state);

    expect(evaluateChatCommandCooldown({
      command,
      nowMs: 2_000,
      provider: "twitch",
      userKey: "viewer-2"
    }, state)).toMatchObject({
      ok: false,
      reason: "global_cooldown"
    });

    expect(evaluateChatCommandCooldown({
      command,
      nowMs: 10_000,
      provider: "twitch",
      userKey: "viewer-1"
    }, state)).toMatchObject({
      ok: false,
      reason: "per_user_command_cooldown"
    });
  });
});
