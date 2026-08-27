import { randomUUID } from "node:crypto";

import {
  obsWidgetBridgeProtocolVersion,
  type ObsBridgeClientHelloMessage,
  type ObsBridgeCapabilitiesUpdateMessage,
  type ObsBridgeEffectAckMessage,
  type ObsBridgeEffectEvent,
  type ObsBridgeServerMessage,
  type ObsWidgetKind,
  type OverlayLiveMessage,
  type OverlayStateSnapshot,
  type StreamerChatMessage
} from "@maiks-yt/events";

import {
  createObsWidgetStateSnapshot,
  createObsWidgetThemeState,
  obsWidgetDescriptors
} from "./obs-widget-bridge-projection.service.js";

export interface ObsWidgetBridgeSocket {
  close(code?: number, reason?: string): void;
  send(message: string): void;
}

type ActiveObsBridgeClient = {
  connectionId: string;
  hello: ObsBridgeClientHelloMessage["payload"];
  socket: ObsWidgetBridgeSocket;
};

type PendingEffect = {
  connectionId: string;
  event: ObsBridgeEffectEvent;
  eventId: string;
  expiresAt: string;
  expiryTimer: NodeJS.Timeout | null;
  status: "pending" | "started";
};

const effectLifetimeMs = 2 * 60 * 1_000;
const dedupeLifetimeMs = 10 * 60 * 1_000;

const isEffectEvent = (message: OverlayLiveMessage): message is ObsBridgeEffectEvent =>
  message.type === "overlay.routed-notification.queued"
  || message.type === "overlay.top-bar-notification.queued";

export class ObsWidgetBridgeRuntime {
  private readonly sessionId = randomUUID();
  private activeClient: ActiveObsBridgeClient | null = null;
  private revision = 0;
  private readonly pendingEffects = new Map<string, PendingEffect>();
  private readonly deliveredEventIds = new Map<string, number>();

  public constructor(private readonly dependencies: {
    createOverlaySnapshot: () => OverlayStateSnapshot;
    fallbackToMasterOverlay?: (message: ObsBridgeEffectEvent) => void;
    listChatMessages: () => StreamerChatMessage[];
  }) {}

  public openConnection(
    connectionId: string,
    hello: ObsBridgeClientHelloMessage["payload"],
    socket: ObsWidgetBridgeSocket
  ): void {
    if (this.activeClient) {
      this.clearPendingEffectsForConnection(this.activeClient.connectionId);
    }

    this.activeClient?.socket.close(4001, "replaced_by_new_obs_bridge");
    this.activeClient = { connectionId, hello, socket };

    this.send({
      type: "obs.bridge.welcome",
      payload: {
        connectionId,
        sessionId: this.sessionId,
        protocolVersion: obsWidgetBridgeProtocolVersion,
        effectDelivery: this.canDeliverEffects() ? "obs-bridge" : "master-overlay",
        widgets: obsWidgetDescriptors.map((widget) => structuredClone(widget)),
        theme: createObsWidgetThemeState(this.dependencies.createOverlaySnapshot().theme),
        connectedAt: new Date().toISOString()
      }
    });
    this.broadcastStateSnapshot();
  }

  public closeConnection(connectionId: string): void {
    this.clearPendingEffectsForConnection(connectionId);

    if (this.activeClient?.connectionId === connectionId) {
      this.activeClient = null;
    }
  }

  public updateCapabilities(
    connectionId: string,
    capabilities: ObsBridgeCapabilitiesUpdateMessage["payload"]
  ): boolean {
    if (this.activeClient?.connectionId !== connectionId) {
      return false;
    }

    const supportedWidgets = new Set(this.activeClient.hello.supportedWidgets);
    this.activeClient.hello.readyWidgets = capabilities.readyWidgets.filter((widget) =>
      supportedWidgets.has(widget)
    );

    if (!this.activeClient.hello.readyWidgets.includes("alerts-effects")) {
      this.clearPendingEffectsForConnection(connectionId);
    }

    return true;
  }

  public broadcastStateSnapshot(): void {
    if (!this.activeClient) {
      return;
    }

    this.revision += 1;
    this.send({
      type: "obs.widget.state.snapshot",
      payload: createObsWidgetStateSnapshot({
        chatMessages: this.dependencies.listChatMessages(),
        overlaySnapshot: this.dependencies.createOverlaySnapshot(),
        revision: this.revision,
        sessionId: this.sessionId
      })
    });
  }

  public handleOverlayMessage(message: OverlayLiveMessage): boolean {
    if (!isEffectEvent(message)) {
      return false;
    }

    this.pruneDeliveryState();
    const eventId = message.payload.id;

    if (this.deliveredEventIds.has(eventId)) {
      return true;
    }

    if (!this.canDeliverEffects()) {
      return false;
    }

    const client = this.activeClient;

    if (!client) {
      return false;
    }

    const deliveryId = randomUUID();
    const expiresAt = new Date(Date.now() + effectLifetimeMs).toISOString();
    this.deliveredEventIds.set(eventId, Date.now() + dedupeLifetimeMs);
    const delivered = this.send({
      type: "obs.effect.deliver",
      payload: {
        deliveryId,
        eventId,
        event: message,
        expiresAt
      }
    });

    if (!delivered) {
      return false;
    }

    this.pendingEffects.set(deliveryId, {
      connectionId: client.connectionId,
      event: structuredClone(message),
      eventId,
      expiresAt,
      expiryTimer: this.scheduleEffectExpiry(deliveryId, expiresAt),
      status: "pending"
    });

    return true;
  }

  public acknowledgeEffect(
    connectionId: string,
    acknowledgement: ObsBridgeEffectAckMessage["payload"]
  ): boolean {
    const pendingEffect = this.pendingEffects.get(acknowledgement.deliveryId);

    if (!pendingEffect || pendingEffect.connectionId !== connectionId) {
      return false;
    }

    if (acknowledgement.status === "started") {
      pendingEffect.status = "started";
      return true;
    }

    if (pendingEffect.status === "started") {
      this.finishPendingEffect(acknowledgement.deliveryId);
      return true;
    }

    this.fallbackPendingEffect(acknowledgement.deliveryId);
    return true;
  }

  public sendHeartbeat(): void {
    this.send({
      type: "obs.bridge.heartbeat",
      payload: {
        sentAt: new Date().toISOString()
      }
    });
  }

  public getStatus(): {
    connected: boolean;
    effectDelivery: "master-overlay" | "obs-bridge";
    installationId: string | null;
    pendingEffects: number;
    readyWidgets: ObsWidgetKind[];
    supportedWidgets: ObsWidgetKind[];
  } {
    return {
      connected: this.activeClient !== null,
      effectDelivery: this.canDeliverEffects() ? "obs-bridge" : "master-overlay",
      installationId: this.activeClient?.hello.installationId ?? null,
      pendingEffects: this.pendingEffects.size,
      readyWidgets: [...(this.activeClient?.hello.readyWidgets ?? [])],
      supportedWidgets: [...(this.activeClient?.hello.supportedWidgets ?? [])]
    };
  }

  private canDeliverEffects(): boolean {
    return this.activeClient?.hello.readyWidgets.includes("alerts-effects") ?? false;
  }

  private pruneDeliveryState(): void {
    const now = Date.now();

    for (const [eventId, expiresAt] of this.deliveredEventIds) {
      if (expiresAt <= now) {
        this.deliveredEventIds.delete(eventId);
      }
    }

    for (const [deliveryId, effect] of this.pendingEffects) {
      if (Date.parse(effect.expiresAt) <= now) {
        this.expirePendingEffect(deliveryId);
      }
    }
  }

  private clearPendingEffectsForConnection(connectionId: string): void {
    for (const [deliveryId, effect] of this.pendingEffects) {
      if (effect.connectionId === connectionId) {
        if (effect.status === "started") {
          this.finishPendingEffect(deliveryId);
        } else {
          this.fallbackPendingEffect(deliveryId);
        }
      }
    }
  }

  private scheduleEffectExpiry(deliveryId: string, expiresAt: string): NodeJS.Timeout | null {
    const expiresAtMs = Date.parse(expiresAt);

    if (!Number.isFinite(expiresAtMs)) {
      return null;
    }

    return setTimeout(() => this.expirePendingEffect(deliveryId), Math.max(0, expiresAtMs - Date.now()));
  }

  private expirePendingEffect(deliveryId: string): void {
    const effect = this.pendingEffects.get(deliveryId);

    if (!effect) {
      return;
    }

    if (effect.status === "started") {
      this.finishPendingEffect(deliveryId);
      return;
    }

    this.fallbackPendingEffect(deliveryId);
  }

  private fallbackPendingEffect(deliveryId: string): void {
    const effect = this.pendingEffects.get(deliveryId);

    if (!effect) {
      return;
    }

    this.finishPendingEffect(deliveryId);
    try {
      this.dependencies.fallbackToMasterOverlay?.(structuredClone(effect.event));
    } catch {
      // A broken master-overlay client must not escape an acknowledgement or timer callback.
    }
  }

  private finishPendingEffect(deliveryId: string): void {
    const effect = this.pendingEffects.get(deliveryId);

    if (!effect) {
      return;
    }

    if (effect.expiryTimer) {
      clearTimeout(effect.expiryTimer);
    }

    this.pendingEffects.delete(deliveryId);
  }

  private send(message: ObsBridgeServerMessage): boolean {
    const client = this.activeClient;

    if (!client) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch {
      this.clearPendingEffectsForConnection(client.connectionId);
      if (this.activeClient?.connectionId === client.connectionId) {
        this.activeClient = null;
      }
      return false;
    }
  }
}
