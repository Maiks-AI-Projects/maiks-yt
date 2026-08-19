import type {
  ObsBridgeClientHelloMessage,
  ObsBridgeServerMessage,
  OverlayLiveMessage,
  StreamerChatMessage
} from "@maiks-yt/events";
import { describe, expect, it } from "vitest";

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

const createTopAlert = (): OverlayLiveMessage => ({
  type: "overlay.top-bar-notification.queued",
  payload: {
    id: "event-1",
    actorName: "Viewer",
    actionLabel: "followed",
    avatarUrl: "https://example.com/avatar.png",
    createdAt: "2026-08-20T08:00:00.000Z",
    kind: "follow",
    platform: "twitch",
    priority: "normal"
  }
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
    const event = createTopAlert();

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    expect(runtime.handleOverlayMessage(event)).toBe(true);
    expect(runtime.handleOverlayMessage(event)).toBe(true);

    const deliveries = socket.messages.filter((message) => message.type === "obs.effect.deliver");
    expect(deliveries).toHaveLength(1);
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

    runtime.openConnection("connection-1", createHello(["alerts-effects"]), socket);
    socket.failSends = true;

    expect(runtime.handleOverlayMessage(createTopAlert())).toBe(false);
    expect(runtime.getStatus().connected).toBe(false);
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
