import type {
  ObsBridgeClientHelloMessage,
  ObsBridgeEffectDeliveryMessage,
  ObsBridgeServerMessage,
  OverlayLiveMessage,
  StreamerChatMessage
} from "@maiks-yt/events";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createObsWidgetStateSnapshot,
  ObsWidgetBridgeRuntime,
  type ObsWidgetBridgeSocket
} from "../../src/obs-bridge/index.js";
import { OverlayRuntime } from "../../src/overlay/index.js";

class FakeBridgeSocket implements ObsWidgetBridgeSocket {
  public readonly closed: Array<{ code?: number; reason?: string }> = [];
  public readonly messages: ObsBridgeServerMessage[] = [];
  public failSends = false;

  public close(code?: number, reason?: string): void {
    this.closed.push({
      ...(code === undefined ? {} : { code }),
      ...(reason === undefined ? {} : { reason })
    });
  }

  public send(message: string): void {
    if (this.failSends) {
      throw new Error("socket_send_failed");
    }

    this.messages.push(JSON.parse(message) as ObsBridgeServerMessage);
  }
}

const createHello = (
  supportedWidgets: ObsBridgeClientHelloMessage["payload"]["supportedWidgets"]
): ObsBridgeClientHelloMessage["payload"] => ({
  protocolVersion: 1,
  installationId: "obs-installation-test",
  clientVersion: "0.1.0",
  supportedWidgets,
  readyWidgets: supportedWidgets
});

const createChatMessage = (): StreamerChatMessage => ({
  id: "chat-1",
  authorName: "Viewer",
  authorKind: "human",
  message: "Hello stream",
  source: "twitch",
  visibleOnOverlayByDefault: false,
  createdAt: "2026-08-20T08:00:00.000Z"
});

const createTopAlert = (id = "event-1"): OverlayLiveMessage => ({
  type: "overlay.top-bar-notification.queued",
  payload: {
    id,
    actorName: "Viewer",
    actionLabel: "followed",
    avatarUrl: "https://example.com/avatar.png",
    createdAt: "2026-08-20T08:00:00.000Z",
    kind: "follow",
    platform: "twitch",
    priority: "normal"
  }
});

const createRuntime = (fallbackToMasterOverlay = vi.fn()) => {
  const overlayRuntime = new OverlayRuntime();

  return {
    fallbackToMasterOverlay,
    runtime: new ObsWidgetBridgeRuntime({
      createOverlaySnapshot: () => overlayRuntime.createSnapshotFromRequestedState({
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      }),
      fallbackToMasterOverlay,
      listChatMessages: () => []
    })
  };
};

const findEffectDelivery = (socket: FakeBridgeSocket): ObsBridgeEffectDeliveryMessage => {
  const delivery = socket.messages.find((message) => message.type === "obs.effect.deliver");

  if (!delivery || delivery.type !== "obs.effect.deliver") {
    throw new Error("Expected obs.effect.deliver message");
  }

  return delivery;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("OBS widget bridge", () => {
  it("projects widget state without Maiks scene geometry", () => {
    const overlayRuntime = new OverlayRuntime();
    const snapshot = createObsWidgetStateSnapshot({
      chatMessages: [createChatMessage()],
      overlaySnapshot: overlayRuntime.createSnapshotFromRequestedState({
        scene: "gameplay",
        layout: "camera-left",
        theme: "default",
        mode: "normal"
      }),
      revision: 4,
      sessionId: "server-session-1"
    });

    expect(snapshot.sessionId).toBe("server-session-1");
    expect(snapshot.revision).toBe(4);
    expect(snapshot.widgets.chat.messages).toHaveLength(1);
    expect(snapshot.widgets.chat.messages[0]?.source).toBe("twitch");
    expect(snapshot).not.toHaveProperty("scene");
    expect(snapshot).not.toHaveProperty("layout");
    expect(snapshot).not.toHaveProperty("sceneDefinition");
  });

  it("sends welcome and current widget state on connection", () => {
    const overlayRuntime = new OverlayRuntime();
    const socket = new FakeBridgeSocket();
    const runtime = new ObsWidgetBridgeRuntime({
      createOverlaySnapshot: () => overlayRuntime.createSnapshotFromRequestedState({
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      }),
      listChatMessages: () => [createChatMessage()]
    });

    runtime.openConnection("connection-1", createHello(["chat", "alerts-effects"]), socket);

    expect(socket.messages.map((message) => message.type)).toEqual([
      "obs.bridge.welcome",
      "obs.widget.state.snapshot"
    ]);
    expect(socket.messages[0]).toMatchObject({
      type: "obs.bridge.welcome",
      payload: {
        effectDelivery: "obs-bridge",
        protocolVersion: 1,
        sessionId: expect.any(String)
      }
    });
  });

  it("claims and deduplicates effects only for an alerts-capable bridge", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();
    const event = createTopAlert();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(event)).toBe(true);
    expect(runtime.handleOverlayMessage(event)).toBe(true);

    const deliveries = socket.messages.filter((message) => message.type === "obs.effect.deliver");
    expect(deliveries).toHaveLength(1);
    expect(fallbackToMasterOverlay).not.toHaveBeenCalled();
  });

  it("leaves effects with the master overlay when the bridge cannot render them", () => {
    const overlayRuntime = new OverlayRuntime();
    const socket = new FakeBridgeSocket();
    const runtime = new ObsWidgetBridgeRuntime({
      createOverlaySnapshot: () => overlayRuntime.createSnapshotFromRequestedState({
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      }),
      listChatMessages: () => []
    });

    runtime.openConnection("connection-1", {
      ...createHello(["chat", "alerts-effects"]),
      readyWidgets: ["chat"]
    }, socket);

    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(false);
    expect(runtime.getStatus().effectDelivery).toBe("master-overlay");
  });

  it("claims effects only after the local alerts widget reports ready", () => {
    const overlayRuntime = new OverlayRuntime();
    const socket = new FakeBridgeSocket();
    const runtime = new ObsWidgetBridgeRuntime({
      createOverlaySnapshot: () => overlayRuntime.createSnapshotFromRequestedState({
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      }),
      listChatMessages: () => []
    });
    runtime.openConnection("connection-1", {
      ...createHello(["alerts-effects"]),
      readyWidgets: []
    }, socket);

    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(false);
    expect(runtime.updateCapabilities("connection-1", {
      readyWidgets: ["alerts-effects"]
    })).toBe(true);
    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(true);
  });

  it("falls back to the master overlay when bridge delivery fails", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();
    const event = createTopAlert();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    socket.failSends = true;

    expect(runtime.handleOverlayMessage(event)).toBe(false);
    expect(runtime.getStatus().connected).toBe(false);
    expect(runtime.handleOverlayMessage(event)).toBe(true);
    expect(fallbackToMasterOverlay).not.toHaveBeenCalled();
  });

  it("falls back exactly once when a bridge effect fails before started", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();
    const event = createTopAlert();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(event)).toBe(true);
    const delivery = findEffectDelivery(socket);

    expect(runtime.acknowledgeEffect("connection-1", {
      deliveryId: delivery.payload.deliveryId,
      status: "failed",
      acknowledgedAt: new Date().toISOString()
    })).toBe(true);
    expect(fallbackToMasterOverlay).toHaveBeenCalledOnce();
    expect(fallbackToMasterOverlay).toHaveBeenCalledWith(event);

    expect(runtime.acknowledgeEffect("connection-1", {
      deliveryId: delivery.payload.deliveryId,
      status: "started",
      acknowledgedAt: new Date().toISOString()
    })).toBe(false);
    expect(runtime.handleOverlayMessage(event)).toBe(true);
    expect(socket.messages.filter((message) => message.type === "obs.effect.deliver")).toHaveLength(1);
    expect(fallbackToMasterOverlay).toHaveBeenCalledOnce();
  });

  it("falls back unstarted bridge effects on disconnect, replacement, and expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    const firstSocket = new FakeBridgeSocket();
    const secondSocket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();
    const disconnectedEvent = createTopAlert();
    const replacedEvent = createTopAlert("event-2");
    const expiredEvent = createTopAlert("event-3");

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), firstSocket);
    expect(runtime.handleOverlayMessage(disconnectedEvent)).toBe(true);
    runtime.closeConnection("connection-1");
    expect(fallbackToMasterOverlay).toHaveBeenCalledWith(disconnectedEvent);

    runtime.openConnection("connection-2", createHello(["alerts-effects"]), secondSocket);
    expect(runtime.handleOverlayMessage(replacedEvent)).toBe(true);
    runtime.openConnection("connection-3", createHello(["alerts-effects"]), new FakeBridgeSocket());
    expect(fallbackToMasterOverlay).toHaveBeenCalledWith(replacedEvent);

    expect(runtime.handleOverlayMessage(expiredEvent)).toBe(true);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1_000);
    expect(fallbackToMasterOverlay).toHaveBeenCalledWith(expiredEvent);
    expect(fallbackToMasterOverlay).toHaveBeenCalledTimes(3);
  });

  it("falls back unstarted effects immediately when a later bridge send fails", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();
    const event = createTopAlert();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(event)).toBe(true);
    socket.failSends = true;

    runtime.sendHeartbeat();

    expect(fallbackToMasterOverlay).toHaveBeenCalledOnce();
    expect(fallbackToMasterOverlay).toHaveBeenCalledWith(event);
    expect(runtime.getStatus()).toMatchObject({ connected: false, pendingEffects: 0 });
  });

  it("falls back unstarted effects when alerts readiness is lost", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();
    const event = createTopAlert();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(event)).toBe(true);

    expect(runtime.updateCapabilities("connection-1", { readyWidgets: [] })).toBe(true);
    expect(fallbackToMasterOverlay).toHaveBeenCalledOnce();
    expect(fallbackToMasterOverlay).toHaveBeenCalledWith(event);
    expect(runtime.getStatus()).toMatchObject({ effectDelivery: "master-overlay", pendingEffects: 0 });
  });

  it("keeps started effect ownership when alerts readiness is lost", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(true);
    const delivery = findEffectDelivery(socket);
    expect(runtime.acknowledgeEffect("connection-1", {
      deliveryId: delivery.payload.deliveryId,
      status: "started",
      acknowledgedAt: new Date().toISOString()
    })).toBe(true);

    expect(runtime.updateCapabilities("connection-1", { readyWidgets: [] })).toBe(true);
    expect(fallbackToMasterOverlay).not.toHaveBeenCalled();
    expect(runtime.getStatus().pendingEffects).toBe(0);
  });

  it("contains fallback dependency failures on acknowledgement and expiry paths", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    const fallbackToMasterOverlay = vi.fn(() => {
      throw new Error("master_overlay_failed");
    });
    const { runtime } = createRuntime(fallbackToMasterOverlay);
    const socket = new FakeBridgeSocket();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(true);
    const delivery = findEffectDelivery(socket);
    expect(() => runtime.acknowledgeEffect("connection-1", {
      deliveryId: delivery.payload.deliveryId,
      status: "failed",
      acknowledgedAt: new Date().toISOString()
    })).not.toThrow();

    expect(runtime.handleOverlayMessage(createTopAlert("event-2"))).toBe(true);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1_000);
    expect(fallbackToMasterOverlay).toHaveBeenCalledTimes(2);
    expect(runtime.getStatus().pendingEffects).toBe(0);
  });

  it("keeps bridge ownership after started even when the effect fails or disconnects", () => {
    const socket = new FakeBridgeSocket();
    const { fallbackToMasterOverlay, runtime } = createRuntime();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(true);
    const failedAfterStart = findEffectDelivery(socket);
    expect(runtime.acknowledgeEffect("connection-1", {
      deliveryId: failedAfterStart.payload.deliveryId,
      status: "started",
      acknowledgedAt: new Date().toISOString()
    })).toBe(true);
    expect(runtime.acknowledgeEffect("connection-1", {
      deliveryId: failedAfterStart.payload.deliveryId,
      status: "failed",
      acknowledgedAt: new Date().toISOString()
    })).toBe(true);

    const disconnectAfterStart = createTopAlert("event-2");
    expect(runtime.handleOverlayMessage(disconnectAfterStart)).toBe(true);
    const startedThenDisconnected = socket.messages
      .filter((message): message is ObsBridgeEffectDeliveryMessage => message.type === "obs.effect.deliver")
      .at(-1)!;
    expect(runtime.acknowledgeEffect("connection-1", {
      deliveryId: startedThenDisconnected.payload.deliveryId,
      status: "started",
      acknowledgedAt: new Date().toISOString()
    })).toBe(true);
    runtime.closeConnection("connection-1");

    expect(fallbackToMasterOverlay).not.toHaveBeenCalled();
  });

  it("replaces an older bridge connection to preserve exclusive effect ownership", () => {
    const overlayRuntime = new OverlayRuntime();
    const firstSocket = new FakeBridgeSocket();
    const secondSocket = new FakeBridgeSocket();
    const runtime = new ObsWidgetBridgeRuntime({
      createOverlaySnapshot: () => overlayRuntime.createSnapshotFromRequestedState({
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      }),
      listChatMessages: () => []
    });

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), firstSocket);
    runtime.openConnection("connection-2", createHello(["alerts-effects"]), secondSocket);

    expect(firstSocket.closed).toEqual([{
      code: 4001,
      reason: "replaced_by_new_obs_bridge"
    }]);
    expect(runtime.getStatus().connected).toBe(true);
  });
});
