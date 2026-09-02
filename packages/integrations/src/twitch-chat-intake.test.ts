import { describe, expect, it, vi, type Mock } from "vitest";

import { projectTwitchChatMessage, resolveTwitchChatChannelName, resolveTwitchChatChannelNames } from "./twitch-chat-intake.rules.js";
import {
  resolveTwitchChatAuthentication,
  TwitchChatReadOnlyIntakeService
} from "./twitch-chat-intake.service.js";

type Listener = unknown;
type MessageHandler = (channel: string, user: string, text: string, msg: {
  date: Date;
  emoteOffsets: Map<string, string[]>;
  id: string;
  userInfo: {
    displayName: string;
  };
}) => void;

class FakeChatClient {
  public isConnected = false;
  public isConnecting = false;
  public currentChannels: string[] = [];
  public readonly connect: Mock<() => void | Promise<void>> = vi.fn(() => {
    this.isConnecting = true;
    this.isConnecting = false;
    this.isConnected = true;
    this.connectHandler?.();
    if (this.autoJoin) {
      this.currentChannels = ["#maiksmc"];
      this.joinHandler?.("maiksmc", "justinfan12345");
    }
  });
  public readonly quit = vi.fn(() => {
    this.isConnected = false;
    this.currentChannels = [];
  });
  public autoJoin = true;
  public readonly removeListener = vi.fn();
  private connectHandler: (() => void) | null = null;
  private disconnectHandler: ((manually: boolean, reason?: Error) => void) | null = null;
  private joinFailureHandler: ((channel: string, reason: string) => void) | null = null;
  private joinHandler: ((channel: string, user: string) => void) | null = null;
  private messageHandler: MessageHandler | null = null;

  public onConnect(handler: () => void): Listener {
    this.connectHandler = handler;
    return Symbol("connect");
  }

  public onDisconnect(handler: (manually: boolean, reason?: Error) => void): Listener {
    this.disconnectHandler = handler;
    return Symbol("disconnect");
  }

  public onJoin(handler: (channel: string, user: string) => void): Listener {
    this.joinHandler = handler;
    return Symbol("join");
  }

  public onJoinFailure(handler: (channel: string, reason: string) => void): Listener {
    this.joinFailureHandler = handler;
    return Symbol("join-failure");
  }

  public onMessage(handler: MessageHandler): Listener {
    this.messageHandler = handler;
    return Symbol("message");
  }

  public emitMessage(): void {
    this.messageHandler?.("MaiksMC", "viewer_login", "  Hello\u0000  Twitch   chat!  ", {
      date: new Date("2026-06-29T14:00:00.000Z"),
      emoteOffsets: new Map(),
      id: "twitch-message-1",
      userInfo: {
        displayName: "  Viewer Name  "
      }
    });
  }

  public emitUnexpectedDisconnect(reason = new Error("network dropped")): void {
    this.isConnected = false;
    this.isConnecting = false;
    this.disconnectHandler?.(false, reason);
  }

  public emitJoinFailure(channel = "maiksmc", reason = "join denied"): void {
    this.joinFailureHandler?.(channel, reason);
  }

  public emitJoin(channel: string): void {
    const normalized = channel.replace(/^#/, "").toLowerCase();
    if (!this.currentChannels.includes(`#${normalized}`)) {
      this.currentChannels.push(`#${normalized}`);
    }
    this.joinHandler?.(normalized, "justinfan12345");
  }
}

class FailingAsyncChatClient extends FakeChatClient {
  public override readonly connect = vi.fn(() => Promise.reject(new Error("async connect failed")));
}

describe("projectTwitchChatMessage", () => {
  it("trims and sanitizes Twitch chat messages for streamer chat", () => {
    const result = projectTwitchChatMessage({
      channelName: "#MaiksMC",
      createdAt: new Date("2026-06-29T14:00:00.000Z"),
      displayName: "  Viewer\u0007 Name  ",
      messageId: "provider-message-1",
      text: "  Hello\u0000  there  ",
      userName: "viewer_login"
    });

    expect(result).toEqual({
      ok: true,
      message: expect.objectContaining({
        authorKind: "human",
        authorName: "Viewer Name",
        channelName: "maiksmc",
        createdAt: "2026-06-29T14:00:00.000Z",
        message: "Hello there",
        providerMessageId: "provider-message-1",
        source: "twitch",
        userName: "viewer_login",
        visibleOnOverlayByDefault: true
      })
    });
  });

  it("rejects empty messages", () => {
    expect(projectTwitchChatMessage({
      channelName: "maiksmc",
      text: "   \u0000  ",
      userName: "viewer_login"
    })).toEqual({
      ok: false,
      reason: "empty_message"
    });
  });

  it("projects native Twitch emotes with authoritative CDN URLs", () => {
    const result = projectTwitchChatMessage({
      channelName: "maiksmc",
      emoteOffsets: new Map([["25", ["6-10"]]]),
      text: "Hello Kappa!",
      userName: "viewer_login"
    });

    expect(result).toMatchObject({
      ok: true,
      message: {
        parts: [
          { type: "text", text: "Hello " },
          {
            type: "emote",
            id: "25",
            name: "Kappa",
            imageUrl: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0"
          },
          { type: "text", text: "!" }
        ]
      }
    });
  });

  it("uses the known Maiks Twitch channel by default", () => {
    expect(resolveTwitchChatChannelName({})).toBe("maiksmc");
    expect(resolveTwitchChatChannelName({ TWITCH_CHAT_CHANNEL: "#CustomChannel" })).toBe("customchannel");
  });

  it("normalizes and deduplicates a configured Twitch channel set", () => {
    expect(resolveTwitchChatChannelNames({
      TWITCH_CHAT_CHANNELS: "#MaiksMC, MaiksPlays, maiksmc"
    })).toEqual(["maiksmc", "maiksplays"]);
  });

  it("requires a complete authenticated chat credential pair", () => {
    expect(resolveTwitchChatAuthentication({
      TWITCH_CLIENT_ID: " twitch-client ",
      TWITCH_CHAT_BOT_ACCESS_TOKEN: " twitch-user-token "
    })).toEqual({
      accessToken: "twitch-user-token",
      clientId: "twitch-client"
    });
    expect(resolveTwitchChatAuthentication({ TWITCH_CLIENT_ID: "twitch-client" })).toBeNull();
    expect(resolveTwitchChatAuthentication({ TWITCH_CHAT_BOT_ACCESS_TOKEN: "token" })).toBeNull();
  });
});

describe("TwitchChatReadOnlyIntakeService", () => {
  it("starts and stops an injected read-only client without opening a real socket", () => {
    const fakeClient = new FakeChatClient();
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: { TWITCH_CHAT_CHANNEL: "maiksmc" }
    });

    expect(service.getStatus()).toMatchObject({
      channelName: "maiksmc",
      channelNames: ["maiksmc"],
      state: "stopped"
    });
    expect(service.start()).toMatchObject({
      channelName: "maiksmc",
      channelNames: ["maiksmc"],
      state: "connected"
    });
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);
    expect(service.start().state).toBe("connected");
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);

    expect(service.stop().state).toBe("stopped");
    expect(fakeClient.quit).toHaveBeenCalledTimes(1);
  });

  it("does not report connected until every configured channel is joined", () => {
    const fakeClient = new FakeChatClient();
    fakeClient.autoJoin = false;
    const scheduled: Array<() => void> = [];
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: { TWITCH_CHAT_CHANNELS: "maiksmc,maiksplays" },
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      }
    });

    expect(service.start()).toMatchObject({
      joinedChannelNames: [],
      state: "connecting"
    });

    fakeClient.emitJoin("maiksmc");
    expect(service.getStatus()).toMatchObject({
      joinedChannelNames: ["maiksmc"],
      state: "connecting"
    });

    fakeClient.emitJoin("maiksplays");
    expect(service.getStatus()).toMatchObject({
      joinedChannelNames: ["maiksmc", "maiksplays"],
      state: "connected"
    });
  });

  it("reconnects instead of staying falsely connected when channel joins time out", () => {
    const fakeClient = new FakeChatClient();
    fakeClient.autoJoin = false;
    const scheduled: Array<() => void> = [];
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: { TWITCH_CHAT_CHANNELS: "maiksmc,maiksplays" },
      joinTimeoutMs: 1_000,
      now: () => new Date("2026-09-02T18:00:00.000Z"),
      reconnectDelayMs: 5_000,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      }
    });

    expect(service.start().state).toBe("connecting");
    expect(scheduled).toHaveLength(1);
    scheduled[0]?.();

    expect(fakeClient.quit).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toMatchObject({
      joinedChannelNames: [],
      lastError: "Twitch chat did not join #maiksmc, #maiksplays within 1 seconds.",
      nextReconnectAt: "2026-09-02T18:00:05.000Z",
      state: "stopped"
    });
    expect(scheduled).toHaveLength(2);
  });

  it("records recent projected messages and calls the message callback", () => {
    const fakeClient = new FakeChatClient();
    const onMessage = vi.fn();
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: { TWITCH_CHAT_CHANNEL: "maiksmc" },
      onMessage
    });

    service.start();
    fakeClient.emitMessage();

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      authorName: "Viewer Name",
      message: "Hello Twitch chat!",
      source: "twitch",
      userName: "viewer_login",
      visibleOnOverlayByDefault: true
    }));
    expect(service.getStatus().recentMessages).toEqual([
      expect.objectContaining({
        providerMessageId: "twitch-message-1",
        source: "twitch"
      })
    ]);
  });

  it("auto-reconnects after an unexpected disconnect", () => {
    const clients: FakeChatClient[] = [];
    const scheduled: Array<() => void> = [];
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => {
        const client = new FakeChatClient();
        clients.push(client);
        return client as never;
      },
      env: { TWITCH_CHAT_CHANNEL: "maiksmc" },
      now: () => new Date("2026-06-29T14:00:00.000Z"),
      reconnectDelayMs: 1_000,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeoutFn: vi.fn()
    });

    expect(service.start().state).toBe("connected");
    const firstClient = clients[0];
    expect(firstClient).toBeDefined();
    firstClient?.emitUnexpectedDisconnect();

    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 1,
      reconnectSuppressed: false,
      state: "stopped"
    });
    expect(service.getStatus().nextReconnectAt).toBe("2026-06-29T14:00:01.000Z");

    const scheduledReconnect = scheduled.at(-1);
    expect(scheduledReconnect).toBeDefined();
    scheduledReconnect?.();

    expect(clients).toHaveLength(2);
    const secondClient = clients[1];
    expect(secondClient).toBeDefined();
    expect(secondClient?.connect).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 1,
      state: "connected"
    });
  });

  it("schedules reconnect when the async Twitch connect attempt fails", async () => {
    const clients: FailingAsyncChatClient[] = [];
    const scheduled: Array<() => void> = [];
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => {
        const client = new FailingAsyncChatClient();
        clients.push(client);
        return client as never;
      },
      env: { TWITCH_CHAT_CHANNEL: "maiksmc" },
      now: () => new Date("2026-06-29T14:00:00.000Z"),
      reconnectDelayMs: 1_000,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeoutFn: vi.fn()
    });

    expect(service.start().state).toBe("stopped");
    await Promise.resolve();

    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 1,
      lastError: "async connect failed",
      reconnectSuppressed: false,
      state: "stopped"
    });
    expect(service.getStatus().nextReconnectAt).toBe("2026-06-29T14:00:01.000Z");
    expect(scheduled).toHaveLength(1);
  });

  it("suppresses auto-reconnect after too many disconnects inside the window", () => {
    let now = new Date("2026-06-29T14:00:00.000Z");
    const clients: FakeChatClient[] = [];
    const onReconnectSuppressed = vi.fn();
    const scheduled: Array<() => void> = [];
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => {
        const client = new FakeChatClient();
        clients.push(client);
        return client as never;
      },
      env: { TWITCH_CHAT_CHANNEL: "maiksmc" },
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
    const firstClient = clients[0];
    expect(firstClient).toBeDefined();
    firstClient?.emitUnexpectedDisconnect(new Error("first"));
    now = new Date("2026-06-29T14:00:01.000Z");
    const scheduledReconnect = scheduled.at(-1);
    expect(scheduledReconnect).toBeDefined();
    scheduledReconnect?.();
    const secondClient = clients[1];
    expect(secondClient).toBeDefined();
    secondClient?.emitUnexpectedDisconnect(new Error("second"));

    expect(service.getStatus()).toMatchObject({
      disconnectsInWindow: 2,
      lastError: "Twitch chat disconnected too often; manual reconnect required.",
      nextReconnectAt: null,
      reconnectSuppressed: true,
      state: "stopped"
    });
    expect(scheduled).toHaveLength(3);
    expect(onReconnectSuppressed).toHaveBeenCalledWith(expect.objectContaining({
      reconnectSuppressed: true,
      state: "stopped"
    }));
  });

  it("does not auto-reconnect after a manual stop", () => {
    const fakeClient = new FakeChatClient();
    const scheduled: Array<() => void> = [];
    const clearTimeoutFn = vi.fn();
    const service = new TwitchChatReadOnlyIntakeService({
      createClient: () => fakeClient as never,
      env: { TWITCH_CHAT_CHANNEL: "maiksmc" },
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeoutFn
    });

    service.start();
    expect(service.stop()).toMatchObject({
      nextReconnectAt: null,
      reconnectSuppressed: false,
      state: "stopped"
    });

    expect(scheduled).toHaveLength(1);
    expect(clearTimeoutFn).toHaveBeenCalledTimes(1);
  });
});
