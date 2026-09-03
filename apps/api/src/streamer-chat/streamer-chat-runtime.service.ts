import { randomUUID } from "node:crypto";

import type {
  StreamerChatLiveMessage,
  StreamerChatMessage,
  StreamerChatSnapshotEvent
} from "@maiks-yt/events";

export interface StreamerChatLiveSocket {
  close(code?: number, reason?: string): void;
  on(event: "close", listener: () => void): void;
  send(data: string): void;
}

export type StreamerChatVisibilityFilter = (message: StreamerChatMessage) => boolean;
export type StreamerChatStateListener = () => void;

export class StreamerChatRuntime {
  private readonly liveClients = new Map<string, StreamerChatLiveSocket>();
  private readonly messages: StreamerChatMessage[] = [];
  private readonly sessionId = randomUUID();
  private readonly stateListeners = new Set<StreamerChatStateListener>();
  private emergencyClearEnabled = false;
  private revision = 0;
  private visibilityFilter: StreamerChatVisibilityFilter = () => true;

  public constructor(private readonly options: {
    maxHistory: number;
  }) {}

  public setVisibilityFilter(filter: StreamerChatVisibilityFilter): void {
    this.visibilityFilter = filter;
  }

  public subscribeToStateChanges(listener: StreamerChatStateListener): () => void {
    this.stateListeners.add(listener);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public appendMessage(message: StreamerChatMessage): StreamerChatMessage {
    if (this.emergencyClearEnabled) {
      return message;
    }

    this.messages.unshift(message);
    this.messages.splice(this.options.maxHistory);
    this.revision += 1;

    if (this.isVisible(message)) {
      this.broadcastMessage(message);
    }

    this.notifyStateListeners();

    return message;
  }

  public setEmergencyClearEnabled(enabled: boolean): boolean {
    if (this.emergencyClearEnabled === enabled) {
      return this.emergencyClearEnabled;
    }

    this.emergencyClearEnabled = enabled;

    if (enabled) {
      this.messages.splice(0);
    }

    this.broadcastSnapshot();

    return this.emergencyClearEnabled;
  }

  public findMessage(messageId: string): StreamerChatMessage | null {
    const message = this.messages.find((candidate) => candidate.id === messageId) ?? null;

    return message ? { ...message } : null;
  }

  public listAllMessages(): StreamerChatMessage[] {
    return this.messages.map((message) => ({ ...message }));
  }

  public listVisibleMessages(): StreamerChatMessage[] {
    return this.messages
      .filter((message) => this.isVisible(message))
      .map((message) => ({ ...message }));
  }

  public removeMessage(messageId: string): StreamerChatMessage | null {
    const messageIndex = this.messages.findIndex((message) => message.id === messageId);
    const message = messageIndex >= 0 ? this.messages[messageIndex] : null;

    if (!message) {
      return null;
    }

    this.messages.splice(messageIndex, 1);
    this.revision += 1;
    this.broadcastSnapshot(false);

    return { ...message };
  }

  public createSnapshot(): StreamerChatSnapshotEvent {
    return {
      type: "streamer-chat.snapshot",
      revision: this.revision,
      sessionId: this.sessionId,
      payload: {
        messages: this.listVisibleMessages(),
        sentAt: new Date().toISOString()
      }
    };
  }

  public broadcastSnapshot(advanceRevision = true): void {
    if (advanceRevision) {
      this.revision += 1;
    }
    const serializedMessage = JSON.stringify(this.createSnapshot());

    for (const client of this.liveClients.values()) {
      client.send(serializedMessage);
    }

    this.notifyStateListeners();
  }

  public registerLiveClient(connectionId: string, socket: StreamerChatLiveSocket): void {
    this.liveClients.set(connectionId, socket);
    socket.send(JSON.stringify(this.createSnapshot()));
    socket.on("close", () => {
      this.liveClients.delete(connectionId);
    });
  }

  private broadcastMessage(message: StreamerChatMessage): void {
    const serializedMessage = JSON.stringify({
      type: "streamer-chat.message.received",
      revision: this.revision,
      sessionId: this.sessionId,
      payload: message
    } satisfies StreamerChatLiveMessage);

    for (const client of this.liveClients.values()) {
      client.send(serializedMessage);
    }
  }

  private isVisible(message: StreamerChatMessage): boolean {
    return this.visibilityFilter(message);
  }

  private notifyStateListeners(): void {
    for (const listener of this.stateListeners) {
      listener();
    }
  }
}
