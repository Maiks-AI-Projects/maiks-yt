import { describe, expect, it } from "vitest";

import { OverlayRuntime, type OverlayLiveSocket } from "../../src/overlay/index.js";

class FakeOverlaySocket implements OverlayLiveSocket {
  public readonly sentMessages: string[] = [];
  private closeListener: (() => void) | null = null;

  public close(): void {
    this.closeListener?.();
  }

  public on(event: "close", listener: () => void): void {
    if (event === "close") {
      this.closeListener = listener;
    }
  }

  public send(message: string): void {
    this.sentMessages.push(message);
  }
}

describe("OverlayRuntime", () => {
  it("creates clean snapshots when emergency clean mode is enabled", () => {
    const runtime = new OverlayRuntime();

    runtime.setEmergencyCleanModeEnabled(true);
    const snapshot = runtime.createSnapshotFromRequestedState({
      scene: "default",
      layout: "standard",
      theme: "default",
      mode: "normal"
    });

    expect(snapshot.layout).toBe("clean");
    expect(snapshot.mode).toBe("clean");
    expect(snapshot.slots.chat.visible).toBe(false);
    expect(snapshot.slots.sponsorPrimary.visible).toBe(false);
  });

  it("tracks live connections and broadcasts snapshots", () => {
    const runtime = new OverlayRuntime();
    const socket = new FakeOverlaySocket();
    const snapshot = runtime.openLiveConnection(
      "connection-1",
      {
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      },
      socket
    );

    expect(snapshot.connectionStatus).toBe("live");
    expect(runtime.getActiveConnectionCount()).toBe(1);

    runtime.setChatVisible(false);
    const lastMessage = JSON.parse(socket.sentMessages.at(-1) ?? "{}") as {
      type?: string;
      payload?: {
        slots?: {
          chat?: {
            visible?: boolean;
          };
        };
      };
    };

    expect(lastMessage.type).toBe("overlay.state.snapshot");
    expect(lastMessage.payload?.slots?.chat?.visible).toBe(false);

    runtime.closeLiveConnection("connection-1");
    expect(runtime.getActiveConnectionCount()).toBe(0);
  });

  it("rejects unknown presentation scenes", () => {
    const runtime = new OverlayRuntime();

    expect(runtime.setPresentationState({
      scene: "missing-scene",
      layout: "standard",
      theme: "default"
    })).toBeNull();
  });

  it("lets an external bridge claim transient effects without sending them to the master", () => {
    const runtime = new OverlayRuntime();
    const socket = new FakeOverlaySocket();
    runtime.openLiveConnection(
      "connection-1",
      {
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      },
      socket
    );
    runtime.setTransientMessageHandler((message) =>
      message.type === "overlay.top-bar-notification.queued"
    );

    runtime.broadcastMessage(runtime.createDemoTopBarNotification(0));

    expect(socket.sentMessages).toHaveLength(0);
  });
});
