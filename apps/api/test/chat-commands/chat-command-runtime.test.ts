import { describe, expect, it, vi } from "vitest";

import { ChatCommandRuntime, type ChatCommandRuntimeMessage } from "../../src/chat-commands/index.js";
import { StreamerChatRuntime } from "../../src/streamer-chat/index.js";

const createTwitchMessage = (overrides: Partial<ChatCommandRuntimeMessage> = {}): ChatCommandRuntimeMessage => ({
  id: "message-1",
  authorKind: "human",
  authorName: "Viewer",
  channelName: "maiksmc",
  createdAt: "2026-08-20T10:00:00.000Z",
  message: "!website",
  providerMessageId: "provider-message-1",
  source: "twitch",
  userId: "viewer-id",
  userName: "viewer_login",
  visibleOnOverlayByDefault: false,
  ...overrides
});

describe("ChatCommandRuntime", () => {
  it("delivers a Twitch command reply and lets the caller exclude command input from chat history", async () => {
    const send = vi.fn(async () => ({
      ok: true as const,
      authorKind: "bot" as const,
      providerAction: true as const,
      providerMessage: "Maiks.yt: https://maiks.yt/",
      providerMessageId: "twitch-bot-command-1",
      providerMessageSent: true as const,
      visibleOnOverlayByDefault: false as const
    }));
    const runtime = new ChatCommandRuntime({
      delivery: { send },
      nowMs: () => 1_000
    });
    const chatRuntime = new StreamerChatRuntime({ maxHistory: 10 });
    const message = createTwitchMessage();

    expect(runtime.classifyProviderMessage(message)).toEqual({
      consume: true,
      reason: "command_or_bot_message"
    });
    await expect(runtime.processProviderMessage(message)).resolves.toMatchObject({
      handled: true,
      reason: "delivered"
    });

    expect(send).toHaveBeenCalledWith({
      channelName: "maiksmc",
      message: "Maiks.yt: https://maiks.yt/",
      provider: "twitch"
    });
    expect(chatRuntime.listAllMessages()).toEqual([]);
  });

  it("keeps ordinary chat available for the existing streamer chat path", () => {
    const runtime = new ChatCommandRuntime({
      delivery: {
        send: vi.fn()
      }
    });

    expect(runtime.classifyProviderMessage(createTwitchMessage({
      message: "hello chat"
    }))).toEqual({
      consume: false,
      reason: "ordinary_chat"
    });
  });

  it("applies cooldowns without sending repeated provider replies", async () => {
    let nowMs = 1_000;
    const send = vi.fn(async () => ({
      ok: true as const,
      authorKind: "bot" as const,
      providerAction: true as const,
      providerMessage: "Maiks.yt: https://maiks.yt/",
      providerMessageId: "twitch-bot-command-1",
      providerMessageSent: true as const,
      visibleOnOverlayByDefault: false as const
    }));
    const runtime = new ChatCommandRuntime({
      delivery: { send },
      nowMs: () => nowMs
    });

    await expect(runtime.processProviderMessage(createTwitchMessage())).resolves.toMatchObject({
      handled: true,
      reason: "delivered"
    });

    nowMs = 2_000;
    await expect(runtime.processProviderMessage(createTwitchMessage({
      id: "message-2",
      providerMessageId: "provider-message-2"
    }))).resolves.toMatchObject({
      handled: true,
      reason: "cooldown"
    });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("consumes bot/self messages so echoed bot replies cannot loop into chat surfaces", async () => {
    const send = vi.fn();
    const runtime = new ChatCommandRuntime({
      botIdentity: {
        displayNames: ["MaiksBot"],
        providerUserLogins: ["maiksbot"]
      },
      delivery: { send }
    });
    const message = createTwitchMessage({
      authorName: "MaiksBot",
      message: "!website",
      userName: "maiksbot"
    });

    expect(runtime.classifyProviderMessage(message)).toEqual({
      consume: true,
      reason: "command_or_bot_message"
    });
    await expect(runtime.processProviderMessage(message)).resolves.toMatchObject({
      handled: true,
      reason: "self_or_bot_message"
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("suppresses an echoed provider reply even without configured bot identity", async () => {
    const send = vi.fn(async () => ({
      ok: true as const,
      authorKind: "bot" as const,
      providerAction: true as const,
      providerMessage: "Maiks.yt: https://maiks.yt/",
      providerMessageId: "twitch-bot-command-1",
      providerMessageSent: true as const,
      visibleOnOverlayByDefault: false as const
    }));
    const runtime = new ChatCommandRuntime({
      delivery: { send },
      nowMs: () => 1_000
    });

    await runtime.processProviderMessage(createTwitchMessage());
    const echoedReply = createTwitchMessage({
      authorName: "MaiksBot",
      id: "bot-reply-1",
      message: "Maiks.yt: https://maiks.yt/",
      providerMessageId: "provider-bot-reply-1",
      userId: "unknown-bot-id",
      userName: "unknown_bot_login"
    });

    expect(runtime.classifyProviderMessage(echoedReply)).toEqual({
      consume: true,
      reason: "command_or_bot_message"
    });
    await expect(runtime.processProviderMessage(echoedReply)).resolves.toMatchObject({
      handled: true,
      reason: "self_or_bot_message"
    });
  });
});
