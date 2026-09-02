import { describe, expect, it, vi } from "vitest";

import { connectStreamerChatLiveFeed } from "./streamer-chat-live-connection.service.js";

class FakeSocket {
  public close = vi.fn();
  public onclose: WebSocket["onclose"] = null;
  public onerror: WebSocket["onerror"] = null;
  public onmessage: WebSocket["onmessage"] = null;
  public onopen: WebSocket["onopen"] = null;
}

const closeSocket = (socket: FakeSocket | undefined, code: number): void => {
  socket?.onclose?.call(socket as unknown as WebSocket, { code } as CloseEvent);
};

const openSocket = (socket: FakeSocket | undefined): void => {
  socket?.onopen?.call(socket as unknown as WebSocket, {} as Event);
};

const sendSocketMessage = (socket: FakeSocket | undefined, data: unknown): void => {
  socket?.onmessage?.call(socket as unknown as WebSocket, { data } as MessageEvent);
};

const createHarness = () => {
  const sockets: FakeSocket[] = [];
  const reconnects: Array<{ callback: () => void; delayMs: number; id: number }> = [];
  const callbacks = {
    onAccessDenied: vi.fn(),
    onConnected: vi.fn(),
    onConnecting: vi.fn(),
    onDisconnected: vi.fn(),
    onError: vi.fn(),
    onMessage: vi.fn()
  };
  const cancelReconnect = vi.fn();
  const disconnect = connectStreamerChatLiveFeed({
    ...callbacks,
    cancelReconnect,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    scheduleReconnect: (callback, delayMs) => {
      const id = reconnects.length + 1;
      reconnects.push({ callback, delayMs, id });
      return id;
    },
    url: "wss://api.maiks.yt/streamer-chat/live"
  });

  return { callbacks, cancelReconnect, disconnect, reconnects, sockets };
};

describe("streamer chat live connection", () => {
  it("reconnects one socket at a time with capped backoff", () => {
    const harness = createHarness();

    expect(harness.sockets).toHaveLength(1);
    closeSocket(harness.sockets[0], 1006);
    expect(harness.reconnects[0]?.delayMs).toBe(1_000);
    harness.reconnects[0]?.callback();
    closeSocket(harness.sockets[1], 1006);
    harness.reconnects[1]?.callback();
    closeSocket(harness.sockets[2], 1006);
    harness.reconnects[2]?.callback();
    closeSocket(harness.sockets[3], 1006);
    harness.reconnects[3]?.callback();
    closeSocket(harness.sockets[4], 1006);
    harness.reconnects[4]?.callback();
    closeSocket(harness.sockets[5], 1006);

    expect(harness.reconnects.map(({ delayMs }) => delayMs)).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      15_000,
      15_000
    ]);
    expect(harness.sockets).toHaveLength(6);
  });

  it("resets backoff after a successful connection", () => {
    const harness = createHarness();

    closeSocket(harness.sockets[0], 1006);
    harness.reconnects[0]?.callback();
    openSocket(harness.sockets[1]);
    closeSocket(harness.sockets[1], 1006);

    expect(harness.reconnects.map(({ delayMs }) => delayMs)).toEqual([1_000, 1_000]);
    expect(harness.callbacks.onConnected).toHaveBeenCalledOnce();
  });

  it("rechecks access with capped backoff after an access-policy close", () => {
    const harness = createHarness();

    closeSocket(harness.sockets[0], 1008);
    harness.reconnects[0]?.callback();
    closeSocket(harness.sockets[1], 1008);
    harness.reconnects[1]?.callback();
    closeSocket(harness.sockets[2], 1008);
    harness.reconnects[2]?.callback();
    closeSocket(harness.sockets[3], 1008);
    harness.reconnects[3]?.callback();
    closeSocket(harness.sockets[4], 1008);
    harness.reconnects[4]?.callback();
    closeSocket(harness.sockets[5], 1008);

    expect(harness.callbacks.onAccessDenied).toHaveBeenCalledTimes(6);
    expect(harness.callbacks.onDisconnected).not.toHaveBeenCalled();
    expect(harness.reconnects.map(({ delayMs }) => delayMs)).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      15_000,
      15_000
    ]);
  });

  it("resets access-policy backoff after a successful reconnect", () => {
    const harness = createHarness();

    closeSocket(harness.sockets[0], 1008);
    harness.reconnects[0]?.callback();
    openSocket(harness.sockets[1]);
    closeSocket(harness.sockets[1], 1008);

    expect(harness.reconnects.map(({ delayMs }) => delayMs)).toEqual([1_000, 1_000]);
  });

  it("cancels pending work and ignores stale socket events after disposal", () => {
    const harness = createHarness();
    const socket = harness.sockets[0];

    closeSocket(socket, 1006);
    harness.disconnect();
    harness.reconnects[0]?.callback();
    sendSocketMessage(socket, "late");

    expect(harness.cancelReconnect).toHaveBeenCalledWith(1);
    expect(harness.sockets).toHaveLength(1);
    expect(harness.callbacks.onMessage).not.toHaveBeenCalled();
  });
});
