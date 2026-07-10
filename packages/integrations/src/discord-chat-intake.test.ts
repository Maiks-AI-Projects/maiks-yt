import { describe, expect, it, vi, type Mock } from "vitest";

import {
  projectDiscordGatewayEvent,
  projectDiscordChatMessage,
  resolveDiscordChatChannelIds,
  resolveDiscordChatGuildId
} from "./discord-chat-intake.rules.js";
import {
  DiscordChatReadOnlyIntakeService,
  type DiscordRawGatewayPacket,
  type DiscordReadableMessage
} from "./discord-chat-intake.service.js";

type EventHandler = (...args: never[]) => void;
type FakeDiscordEventName = "ready" | "messageCreate" | "raw" | "shardDisconnect" | "error";

class FakeDiscordClient {
  public readonly destroy = vi.fn(() => {
    this.ready = false;
    this.handlers.shardDisconnect?.();
  });
  public readonly login: Mock<(token: string) => Promise<string>> = vi.fn(async () => {
    this.ready = true;
    this.handlers.ready?.();
    return "logged-in";
  });
  private readonly handlers: Partial<Record<FakeDiscordEventName, EventHandler>> = {};
  private ready = false;

  public isReady(): boolean {
    return this.ready;
  }

  public on(event: FakeDiscordEventName, handler: EventHandler): this {
    this.handlers[event] = handler;
    return this;
  }

  public off(event: FakeDiscordEventName, handler: EventHandler): this {
    if (this.handlers[event] === handler) {
      delete this.handlers[event];
    }
    return this;
  }

  public emitMessage(overrides: Partial<DiscordReadableMessage> = {}): void {
    this.handlers.messageCreate?.({
      author: {
        bot: false,
        displayName: "  Discord\u0000 Viewer  ",
        id: "user-1",
        username: "discord_viewer"
      },
      channelId: "channel-1",
      channelName: "live-chat",
      content: "  Hello\u0007   Discord  ",
      createdAt: new Date("2026-07-02T12:00:00.000Z"),
      guildId: "guild-1",
      id: "discord-message-1",
      ...overrides
    } as never);
  }

  public emitRaw(packet: DiscordRawGatewayPacket): void {
    this.handlers.raw?.(packet as never);
  }

  public emitUnexpectedDisconnect(reason = new Error("gateway dropped")): void {
    this.ready = false;
    this.handlers.shardDisconnect?.(reason as never);
  }
}

class FailingDiscordClient extends FakeDiscordClient {
  public override readonly login = vi.fn(async () => {
    throw new Error("async login failed");
  });
}

describe("projectDiscordChatMessage", () => {
  it("trims and sanitizes Discord chat messages for streamer chat", () => {
    const result = projectDiscordChatMessage({
      authorDisplayName: "  Display\u0000 Name  ",
      authorUserId: "user-1",
      authorUsername: "fallback_user",
      channelId: "channel-1",
      channelName: "  live\u0007 chat  ",
      createdAt: new Date("2026-07-02T12:00:00.000Z"),
      guildId: "guild-1",
      messageId: "discord-message-1",
      text: "  Hello\u0000  there  "
    });

    expect(result).toEqual({
      ok: true,
      message: expect.objectContaining({
        authorKind: "human",
        authorName: "Display Name",
        channelId: "channel-1",
        channelName: "live chat",
        createdAt: "2026-07-02T12:00:00.000Z",
        guildId: "guild-1",
        message: "Hello there",
        providerMessageId: "discord-message-1",
        source: "discord",
        userId: "user-1",
        visibleOnOverlayByDefault: false
      })
    });
  });

  it("rejects empty messages and resolves env targets", () => {
    expect(projectDiscordChatMessage({
      authorUsername: "viewer",
      authorUserId: "user-1",
      channelId: "channel-1",
      guildId: "guild-1",
      messageId: "message-1",
      text: "   \u0000  "
    })).toEqual({
      ok: false,
      reason: "empty_message"
    });
    expect(resolveDiscordChatGuildId({ DISCORD_GUILD_ID: " guild-1 " })).toBe("guild-1");
    expect(resolveDiscordChatChannelIds({ DISCORD_CHAT_CHANNEL_IDS: " channel-1, channel-2 " })).toEqual(["channel-1", "channel-2"]);
  });
});

describe("projectDiscordGatewayEvent", () => {
  it("projects non-chat Discord Gateway events for provider intake", () => {
    const result = projectDiscordGatewayEvent({
      data: {
        channel_id: "channel-1",
        guild_id: "guild-1",
        id: "message-1",
        user: {
          global_name: "  Viewer  ",
          id: "user-1",
          username: "viewer"
        }
      },
      guildId: "guild-1",
      providerEventName: "MESSAGE_UPDATE",
      receivedAt: new Date("2026-07-04T18:00:00.000Z"),
      sequence: 42
    });

    expect(result).toEqual({
      ok: true,
      event: expect.objectContaining({
        actorDisplayName: "Viewer",
        actorExternalId: "user-1",
        channelId: "channel-1",
        guildId: "guild-1",
        messageId: "message-1",
        occurredAt: "2026-07-04T18:00:00.000Z",
        providerEventName: "MESSAGE_UPDATE",
        source: "discord",
        sourceEventId: "discord-gateway:MESSAGE_UPDATE:message-1"
      })
    });
  });

  it("rejects wrong-guild events and chat create events handled by chat intake", () => {
    expect(projectDiscordGatewayEvent({
      data: {
        guild_id: "other-guild",
        id: "message-1"
      },
      guildId: "guild-1",
      providerEventName: "MESSAGE_UPDATE"
    })).toEqual({
      ok: false,
      reason: "wrong_guild"
    });

    expect(projectDiscordGatewayEvent({
      data: {
        guild_id: "guild-1",
        id: "message-1"
      },
      guildId: "guild-1",
      providerEventName: "MESSAGE_CREATE"
    })).toEqual({
      ok: false,
      reason: "chat_message_create"
    });
  });
});

describe("DiscordChatReadOnlyIntakeService", () => {
  it("starts and stops an injected read-only client without provider writes", async () => {
    const fakeClient = new FakeDiscordClient();
    const service = new DiscordChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: {
        DISCORD_BOT_TOKEN: "bot-token",
        DISCORD_GUILD_ID: "guild-1"
      }
    });

    expect(service.getStatus()).toMatchObject({
      guildId: "guild-1",
      state: "stopped"
    });
    expect(service.start()).toMatchObject({
      guildId: "guild-1",
      state: "connected"
    });
    await Promise.resolve();
    expect(service.getStatus().state).toBe("connected");
    expect(fakeClient.login).toHaveBeenCalledWith("bot-token");
    expect(service.start().state).toBe("connected");
    expect(fakeClient.login).toHaveBeenCalledTimes(1);

    expect(service.stop().state).toBe("stopped");
    expect(fakeClient.destroy).toHaveBeenCalledTimes(1);
  });

  it("records recent projected messages and calls the message callback", async () => {
    const fakeClient = new FakeDiscordClient();
    const onMessage = vi.fn();
    const service = new DiscordChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: {
        DISCORD_BOT_TOKEN: "bot-token",
        DISCORD_CHAT_CHANNEL_ID: "channel-1",
        DISCORD_GUILD_ID: "guild-1"
      },
      onMessage
    });

    service.start();
    await Promise.resolve();
    fakeClient.emitMessage();
    fakeClient.emitMessage({ channelId: "other-channel" });
    fakeClient.emitMessage({ author: { bot: true, id: "bot-user-1", username: "bot" } });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      authorName: "Discord Viewer",
      message: "Hello Discord",
      source: "discord",
      visibleOnOverlayByDefault: false
    }));
    expect(service.getStatus().recentMessages).toEqual([
      expect.objectContaining({
        providerMessageId: "discord-message-1",
        source: "discord"
      })
    ]);
  });

  it("projects raw non-chat Gateway packets to the provider intake callback", async () => {
    const fakeClient = new FakeDiscordClient();
    const onGatewayEvent = vi.fn();
    const service = new DiscordChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: {
        DISCORD_BOT_TOKEN: "bot-token",
        DISCORD_GUILD_ID: "guild-1"
      },
      now: () => new Date("2026-07-04T18:00:00.000Z"),
      onGatewayEvent
    });

    service.start();
    await Promise.resolve();
    fakeClient.emitRaw({
      d: {
        channel_id: "channel-1",
        guild_id: "guild-1",
        id: "message-1",
        user: {
          id: "user-1",
          username: "viewer"
        }
      },
      s: 42,
      t: "MESSAGE_UPDATE"
    });
    fakeClient.emitRaw({
      d: {
        guild_id: "guild-1",
        id: "message-2"
      },
      s: 43,
      t: "MESSAGE_CREATE"
    });

    expect(onGatewayEvent).toHaveBeenCalledTimes(1);
    expect(onGatewayEvent).toHaveBeenCalledWith(expect.objectContaining({
      channelId: "channel-1",
      guildId: "guild-1",
      providerEventName: "MESSAGE_UPDATE",
      source: "discord"
    }));
  });

  it("auto-reconnects after an unexpected disconnect", async () => {
    const clients: FakeDiscordClient[] = [];
    const scheduled: Array<() => void> = [];
    const service = new DiscordChatReadOnlyIntakeService({
      createClient: () => {
        const client = new FakeDiscordClient();
        clients.push(client);
        return client as never;
      },
      env: {
        DISCORD_BOT_TOKEN: "bot-token",
        DISCORD_GUILD_ID: "guild-1"
      },
      now: () => new Date("2026-07-02T12:00:00.000Z"),
      reconnectDelayMs: 1_000,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeoutFn: vi.fn()
    });

    service.start();
    await Promise.resolve();
    const firstClient = clients[0];
    expect(firstClient).toBeDefined();
    firstClient?.emitUnexpectedDisconnect();

    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 1,
      reconnectSuppressed: false,
      state: "stopped"
    });
    expect(service.getStatus().nextReconnectAt).toBe("2026-07-02T12:00:01.000Z");

    const scheduledReconnect = scheduled[0];
    expect(scheduledReconnect).toBeDefined();
    scheduledReconnect?.();
    await Promise.resolve();

    expect(clients).toHaveLength(2);
    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 1,
      state: "connected"
    });
  });

  it("schedules reconnect when Discord login fails", async () => {
    const scheduled: Array<() => void> = [];
    const service = new DiscordChatReadOnlyIntakeService({
      createClient: () => new FailingDiscordClient() as never,
      env: {
        DISCORD_BOT_TOKEN: "bot-token",
        DISCORD_GUILD_ID: "guild-1"
      },
      now: () => new Date("2026-07-02T12:00:00.000Z"),
      reconnectDelayMs: 1_000,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeoutFn: vi.fn()
    });

    expect(service.start().state).toBe("connecting");
    await Promise.resolve();

    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 1,
      lastError: "async login failed",
      reconnectSuppressed: false,
      state: "stopped"
    });
    expect(service.getStatus().nextReconnectAt).toBe("2026-07-02T12:00:01.000Z");
    expect(scheduled).toHaveLength(1);
  });

  it("suppresses auto-reconnect after too many Discord disconnects inside the window", async () => {
    let now = new Date("2026-07-02T12:00:00.000Z");
    const clients: FakeDiscordClient[] = [];
    const onReconnectSuppressed = vi.fn();
    const scheduled: Array<() => void> = [];
    const service = new DiscordChatReadOnlyIntakeService({
      createClient: () => {
        const client = new FakeDiscordClient();
        clients.push(client);
        return client as never;
      },
      env: {
        DISCORD_BOT_TOKEN: "bot-token",
        DISCORD_GUILD_ID: "guild-1"
      },
      maxUnexpectedDisconnectsInWindow: 2,
      now: () => now,
      onReconnectSuppressed,
      reconnectDelayMs: 1_000,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeoutFn: vi.fn()
    });

    service.start();
    await Promise.resolve();
    const firstClient = clients[0];
    expect(firstClient).toBeDefined();
    firstClient?.emitUnexpectedDisconnect(new Error("first"));
    now = new Date("2026-07-02T12:00:01.000Z");
    const scheduledReconnect = scheduled[0];
    expect(scheduledReconnect).toBeDefined();
    scheduledReconnect?.();
    await Promise.resolve();
    const secondClient = clients[1];
    expect(secondClient).toBeDefined();
    secondClient?.emitUnexpectedDisconnect(new Error("second"));

    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 2,
      lastError: "Discord chat disconnected too often; manual reconnect required.",
      nextReconnectAt: null,
      reconnectSuppressed: true,
      state: "stopped"
    });
    expect(scheduled).toHaveLength(1);
    expect(onReconnectSuppressed).toHaveBeenCalledWith(expect.objectContaining({
      reconnectSuppressed: true,
      state: "stopped"
    }));
  });
});
