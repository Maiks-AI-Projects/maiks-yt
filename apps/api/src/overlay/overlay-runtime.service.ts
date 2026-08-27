import { randomUUID } from "node:crypto";

import type {
  OverlayActiveGoalState,
  OverlayCenterNotificationTiming,
  OverlayLayoutKey,
  OverlayLiveMessage,
  OverlayNotificationDisplay,
  OverlayPresentationState,
  OverlayRoutedNotificationQueuedEvent,
  OverlaySceneDefinition,
  OverlaySceneKey,
  OverlayStateSnapshot,
  OverlayThemeKey,
  OverlayTopBarNotificationQueuedEvent
} from "@maiks-yt/events";
import { allThemeScenes } from "@maiks-yt/themes";

export interface OverlayLiveSocket {
  close: (code?: number, reason?: string) => void;
  send: (message: string) => void;
  on(event: "close", listener: () => void): void;
}

export type OverlayRuntimeStatus = {
  activeOverlayConnections: number;
  overlayActive: boolean;
  presentationState: OverlayPresentationState;
  emergencyCleanModeEnabled: boolean;
  chatVisible: boolean;
  chatNewestOnTop: boolean;
  sponsorVisible: boolean;
  aiMuted: boolean;
  topBarEnabled: boolean;
  centerEnabled: boolean;
  centerDefaultTiming: OverlayCenterNotificationTiming;
  activeGoal: OverlayActiveGoalState | null;
};

type OverlayStateListener = () => void;
type OverlayTransientMessageHandler = (message: OverlayLiveMessage) => boolean;

type OverlayLiveClient = {
  requestedScene: OverlaySceneKey;
  requestedLayout: OverlayLayoutKey;
  requestedTheme: OverlayThemeKey;
  requestedMode: OverlayStateSnapshot["mode"];
  snapshot: OverlayStateSnapshot;
  socket: OverlayLiveSocket;
};

const demoTopBarNotifications: Array<Omit<OverlayNotificationDisplay, "createdAt" | "id">> = [
  {
    actorName: "Yasmin",
    actionLabel: "followed",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "follow",
    platform: "twitch",
    priority: "normal"
  },
  {
    actorName: "Michael",
    actionLabel: "gifted 5 subs",
    avatarUrl: "https://yt3.ggpht.com/yti/ANjgQV8-placeholder=s88-c-k-c0x00ffffff-no-rj",
    kind: "gifted-sub",
    platform: "youtube",
    priority: "important"
  },
  {
    actorName: "MaiksMC Fan",
    actionLabel: "cheered 500 bits",
    avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
    kind: "bits",
    platform: "twitch",
    priority: "normal"
  },
  {
    actorName: "Top Supporter",
    actionLabel: "Donated EUR 20",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "community-highlight",
    platform: "system",
    priority: "normal"
  }
];

const demoRedeemNotifications = {
  hydrate: {
    actorName: "Hydrate",
    actionLabel: "Take a drink",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "redeem",
    platform: "site",
    priority: "important"
  },
  jumpscare: {
    actorName: "Jumpscare",
    actionLabel: "Brace yourself",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "redeem",
    platform: "site",
    priority: "urgent"
  },
  mime: {
    actorName: "Mime",
    actionLabel: "Act it out",
    avatarUrl: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
    kind: "mime",
    platform: "site",
    priority: "important"
  }
} satisfies Record<string, Omit<OverlayNotificationDisplay, "createdAt" | "id">>;

export type DemoRedeemKey = keyof typeof demoRedeemNotifications;

export class OverlayRuntime {
  private emergencyCleanModeEnabled = false;
  private chatVisible = true;
  private chatNewestOnTop = false;
  private sponsorVisible = true;
  private aiMuted = false;
  private topBarEnabled = true;
  private centerEnabled = true;
  private centerDefaultTiming: OverlayCenterNotificationTiming = {
    onscreenMs: 4_000,
    fadeOutMs: 700,
    restMs: 1_500
  };
  private activeGoal: OverlayActiveGoalState | null = null;
  private readonly activeConnections = new Set<string>();
  private readonly liveClients = new Map<string, OverlayLiveClient>();
  private readonly sceneDefinitions = new Map<string, OverlaySceneDefinition>(
    allThemeScenes.map((scene) => [`${scene.themeKey}:${scene.sceneKey}`, structuredClone(scene)])
  );
  private readonly stateListeners = new Set<OverlayStateListener>();
  private transientMessageHandler: OverlayTransientMessageHandler | null = null;
  private globalPresentationState: OverlayPresentationState | null = null;

  public subscribeToStateChanges(listener: OverlayStateListener): () => void {
    this.stateListeners.add(listener);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public setTransientMessageHandler(handler: OverlayTransientMessageHandler | null): void {
    this.transientMessageHandler = handler;
  }

  public getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  public getStatus(): OverlayRuntimeStatus {
    return {
      activeOverlayConnections: this.activeConnections.size,
      overlayActive: this.activeConnections.size > 0,
      presentationState: this.globalPresentationState ?? {
        scene: "default",
        layout: "standard",
        theme: "default"
      },
      emergencyCleanModeEnabled: this.emergencyCleanModeEnabled,
      chatVisible: this.chatVisible,
      chatNewestOnTop: this.chatNewestOnTop,
      sponsorVisible: this.sponsorVisible,
      aiMuted: this.aiMuted,
      topBarEnabled: this.topBarEnabled,
      centerEnabled: this.centerEnabled,
      centerDefaultTiming: this.centerDefaultTiming,
      activeGoal: this.activeGoal ? { ...this.activeGoal } : null
    };
  }

  public isTopBarEnabled(): boolean {
    return this.topBarEnabled;
  }

  public isCenterEnabled(): boolean {
    return this.centerEnabled;
  }

  public getChatVisible(): boolean {
    return this.chatVisible;
  }

  public getAiMuted(): boolean {
    return this.aiMuted;
  }

  public setActiveGoal(activeGoal: OverlayActiveGoalState): OverlayActiveGoalState {
    this.activeGoal = { ...activeGoal };
    this.broadcastSnapshots();

    return { ...this.activeGoal };
  }

  public setPresentationState(presentationState: OverlayPresentationState): OverlayPresentationState | null {
    if (!this.sceneDefinitions.has(`${presentationState.theme}:${presentationState.scene}`)) {
      return null;
    }

    this.globalPresentationState = { ...presentationState };
    this.broadcastSnapshots();

    return { ...this.globalPresentationState };
  }

  public listScenes(): OverlaySceneDefinition[] {
    return Array.from(this.sceneDefinitions.values()).map((scene) => structuredClone(scene));
  }

  public saveScene(scene: OverlaySceneDefinition): OverlaySceneDefinition {
    this.sceneDefinitions.set(`${scene.themeKey}:${scene.sceneKey}`, structuredClone(scene));
    this.broadcastSnapshots();

    return structuredClone(scene);
  }

  public setCenterSettings({
    enabled,
    timing
  }: {
    enabled: boolean;
    timing: OverlayCenterNotificationTiming;
  }): {
    centerEnabled: boolean;
    centerDefaultTiming: OverlayCenterNotificationTiming;
  } {
    this.centerEnabled = enabled;
    this.centerDefaultTiming = { ...timing };
    this.broadcastSnapshots();

    return {
      centerEnabled: this.centerEnabled,
      centerDefaultTiming: this.centerDefaultTiming
    };
  }

  public setTopBarEnabled(enabled: boolean): boolean {
    this.topBarEnabled = enabled;
    this.broadcastSnapshots();

    return this.topBarEnabled;
  }

  public setEmergencyCleanModeEnabled(enabled: boolean): boolean {
    this.emergencyCleanModeEnabled = enabled;
    this.broadcastSnapshots();

    return this.emergencyCleanModeEnabled;
  }

  public setChatVisible(visible: boolean): boolean {
    this.chatVisible = visible;
    this.broadcastSnapshots();

    return this.chatVisible;
  }

  public setChatNewestOnTop(newestOnTop: boolean): boolean {
    this.chatNewestOnTop = newestOnTop;
    this.broadcastSnapshots();

    return this.chatNewestOnTop;
  }

  public setSponsorVisible(visible: boolean): boolean {
    this.sponsorVisible = visible;
    this.broadcastSnapshots();

    return this.sponsorVisible;
  }

  public setAiMuted(muted: boolean): boolean {
    this.aiMuted = muted;

    return this.aiMuted;
  }

  public createSnapshotFromRequestedState({
    layout,
    mode,
    scene,
    theme
  }: {
    layout: OverlayLayoutKey;
    mode: OverlayStateSnapshot["mode"];
    scene: OverlaySceneKey;
    theme: OverlayThemeKey;
  }): OverlayStateSnapshot {
    const presentationState = this.resolvePresentationState({
      scene,
      layout,
      theme
    });

    return this.createStateSnapshot({
      scene: presentationState.scene,
      layout: presentationState.layout,
      theme: presentationState.theme,
      mode
    });
  }

  public broadcastMessage(message: OverlayLiveMessage): void {
    if (this.transientMessageHandler?.(message)) {
      return;
    }

    this.broadcastMessageToMasterOverlay(message);
  }

  public broadcastMessageToMasterOverlay(message: OverlayLiveMessage): void {
    const serializedMessage = JSON.stringify(message);

    for (const client of this.liveClients.values()) {
      try {
        client.socket.send(serializedMessage);
      } catch {
        // A stale overlay connection must not prevent delivery to healthy clients.
      }
    }
  }

  public broadcastSnapshots(): void {
    for (const client of this.liveClients.values()) {
      client.snapshot = {
        ...this.createSnapshotFromRequestedState({
          scene: client.requestedScene,
          layout: client.requestedLayout,
          theme: client.requestedTheme,
          mode: client.requestedMode
        }),
        connectionStatus: client.snapshot.connectionStatus
      };
      client.socket.send(JSON.stringify({
        type: "overlay.state.snapshot",
        payload: client.snapshot
      } satisfies OverlayLiveMessage));
    }

    for (const listener of this.stateListeners) {
      listener();
    }
  }

  public openLiveConnection(
    connectionId: string,
    requestState: {
      scene: OverlaySceneKey;
      layout: OverlayLayoutKey;
      theme: OverlayThemeKey;
      mode: OverlayStateSnapshot["mode"];
    },
    socket: OverlayLiveSocket
  ): OverlayStateSnapshot {
    this.activeConnections.add(connectionId);
    const snapshot = {
      ...this.createSnapshotFromRequestedState(requestState),
      connectionStatus: "live" as const,
      updatedAt: new Date().toISOString()
    };

    this.liveClients.set(connectionId, {
      requestedScene: requestState.scene,
      requestedLayout: requestState.layout,
      requestedTheme: requestState.theme,
      requestedMode: requestState.mode,
      snapshot,
      socket
    });

    return snapshot;
  }

  public closeLiveConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId);
    this.liveClients.delete(connectionId);
  }

  public createRedeemNotification(redeem: DemoRedeemKey): OverlayRoutedNotificationQueuedEvent {
    const display: OverlayNotificationDisplay = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...demoRedeemNotifications[redeem]
    };

    return {
      type: "overlay.routed-notification.queued",
      payload: {
        ...display,
        route: "center",
        afterCenter: "none",
        center: {
          title: display.actorName,
          message: display.actionLabel,
          imageUrl: display.avatarUrl,
          timing: this.centerDefaultTiming
        }
      }
    };
  }

  public createDemoTopBarNotification(index: number): OverlayTopBarNotificationQueuedEvent {
    return {
      type: "overlay.top-bar-notification.queued",
      payload: {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...demoTopBarNotifications[index % demoTopBarNotifications.length]!
      }
    };
  }

  public createDemoRoutedNotification(
    index: number,
    route: OverlayRoutedNotificationQueuedEvent["payload"]["route"],
    afterCenter: OverlayRoutedNotificationQueuedEvent["payload"]["afterCenter"]
  ): OverlayRoutedNotificationQueuedEvent {
    const display: OverlayNotificationDisplay = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...(route === "center" && afterCenter === "none"
        ? demoRedeemNotifications.hydrate
        : demoTopBarNotifications[index % demoTopBarNotifications.length]!)
    };

    return {
      type: "overlay.routed-notification.queued",
      payload: {
        ...display,
        route,
        afterCenter,
        ...(route === "center"
          ? {
            center: {
              title: display.actorName,
              message: display.actionLabel,
              imageUrl: display.avatarUrl,
              timing: this.centerDefaultTiming
            }
          }
          : {})
      }
    };
  }

  private getSceneDefinition(
    theme: OverlayThemeKey,
    scene: OverlaySceneKey
  ): OverlaySceneDefinition {
    const sceneDefinition = this.sceneDefinitions.get(`${theme}:${scene}`)
      ?? this.sceneDefinitions.get("default:default");

    if (!sceneDefinition) {
      throw new Error("Default overlay scene is missing.");
    }

    return structuredClone(sceneDefinition);
  }

  private createStateSnapshot({
    layout,
    mode,
    scene,
    theme
  }: {
    layout: OverlayLayoutKey;
    mode: OverlayStateSnapshot["mode"];
    scene: OverlaySceneKey;
    theme: OverlayThemeKey;
  }): OverlayStateSnapshot {
    const effectiveLayout = this.emergencyCleanModeEnabled ? "clean" : layout;
    const effectiveMode = this.emergencyCleanModeEnabled ? "clean" : mode;

    return {
      id: randomUUID(),
      scene,
      layout: effectiveLayout,
      theme,
      mode: effectiveMode,
      connectionStatus: "snapshot",
      sceneDefinition: this.getSceneDefinition(theme, scene),
      topBar: {
        enabled: this.topBarEnabled,
        quietHighlightIntervalMs: 18_000
      },
      center: {
        enabled: this.centerEnabled,
        defaultTiming: this.centerDefaultTiming
      },
      chat: {
        newestOnTop: this.chatNewestOnTop
      },
      activeGoal: this.activeGoal ? { ...this.activeGoal } : null,
      topNotification: null,
      centerNotification: null,
      slots: {
        camera: {
          id: "camera",
          visible: effectiveLayout !== "clean",
          label: "Camera"
        },
        chat: {
          id: "chat",
          visible: this.chatVisible && effectiveLayout !== "clean" && scene !== "just-camera",
          label: "Chat"
        },
        sponsorPrimary: {
          id: "sponsor-primary",
          visible: this.sponsorVisible && effectiveMode !== "clean" && effectiveLayout !== "clean",
          label: "Sponsor"
        },
        sponsorSecondary: {
          id: "sponsor-secondary",
          visible: false,
          label: "Sponsor"
        },
        streamGoal: {
          id: "stream-goal",
          visible: effectiveMode !== "clean",
          label: "Stream goal"
        }
      },
      updatedAt: new Date().toISOString()
    };
  }

  private resolvePresentationState(
    requestedState: OverlayPresentationState
  ): OverlayPresentationState {
    return {
      scene: this.globalPresentationState?.scene ?? requestedState.scene,
      layout: this.globalPresentationState?.layout ?? requestedState.layout,
      theme: this.globalPresentationState?.theme ?? requestedState.theme
    };
  }
}
