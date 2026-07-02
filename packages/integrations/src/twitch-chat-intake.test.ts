import { describe, expect, it, vi } from "vitest";

import { projectTwitchChatMessage, resolveTwitchChatChannelName } from "./twitch-chat-intake.rules.js";
import { TwitchChatReadOnlyIntakeService } from "./twitch-chat-intake.service.js";

type Listener = unknown;
type MessageHandler = (channel: string, user: string, text: string, msg: {
  date: Date;
  id: string;
  userInfo: {
    displayName: string;
  };
}) => void;

class FakeChatClient {
  public isConnected = false;
  public isConnecting = false;
  public readonly connect = vi.fn(() => {
    this.isConnecting = true;
    this.connectHandler?.();
    this.isConnecting = false;
    this.isConnected = true;
  });
  public readonly quit = vi.fn(() => {
    this.isConnected = false;
    this.disconnectHandler?.(true);
  });
  public readonly removeListener = vi.fn();
  private connectHandler: (() => void) | null = null;
  private disconnectHandler: ((manually: boolean, reason?: Error) => void) | null = null;
  private messageHandler: MessageHandler | null = null;

  public onConnect(handler: () => void): Listener {
    this.connectHandler = handler;
    return Symbol("connect");
  }

  public onDisconnect(handler: (manually: boolean, reason?: Error) => void): Listener {
    this.disconnectHandler = handler;
    return Symbol("disconnect");
  }

  public onMessage(handler: MessageHandler): Listener {
    this.messageHandler = handler;
    return Symbol("message");
  }

  public emitMessage(): void {
    this.messageHandler?.("MaiksMC", "viewer_login", "  Hello\u0000  Twitch   chat!  ", {
      date: new Date("2026-06-29T14:00:00.000Z"),
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
        visibleOnOverlayByDefault: false
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

  it("uses the known Maiks Twitch channel by default", () => {
    expect(resolveTwitchChatChannelName({})).toBe("maiksmc");
    expect(resolveTwitchChatChannelName({ TWITCH_CHAT_CHANNEL: "#CustomChannel" })).toBe("customchannel");
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
      state: "stopped"
    });
    expect(service.start()).toMatchObject({
      channelName: "maiksmc",
      state: "connected"
    });
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);
    expect(service.start().state).toBe("connected");
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);

    expect(service.stop().state).toBe("stopped");
    expect(fakeClient.quit).toHaveBeenCalledTimes(1);
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
      visibleOnOverlayByDefault: false
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

    const scheduledReconnect = scheduled[0];
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

  it("suppresses auto-reconnect after too many disconnects inside the window", () => {
    let now = new Date("2026-06-29T14:00:00.000Z");
    const clients: FakeChatClient[] = [];
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
    const scheduledReconnect = scheduled[0];
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
    expect(scheduled).toHaveLength(1);
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

    expect(scheduled).toHaveLength(0);
    expect(clearTimeoutFn).not.toHaveBeenCalled();
  });
});
