import type { StreamerChatLiveMessage, StreamerChatMessage } from "@maiks-yt/events";

export interface StreamerChatLiveSocket {
  close(code?: number, reason?: string): void;
  on(event: "close", listener: () => void): void;
  send(data: string): void;
}

export type StreamerChatVisibilityFilter = (message: StreamerChatMessage) => boolean;

export class StreamerChatRuntime {
  private readonly liveClients = new Map<string, StreamerChatLiveSocket>();
  private readonly messages: StreamerChatMessage[] = [];
  private visibilityFilter: StreamerChatVisibilityFilter = () => true;

  public constructor(private readonly options: {
    maxHistory: number;
  }) {}

  public setVisibilityFilter(filter: StreamerChatVisibilityFilter): void {
    this.visibilityFilter = filter;
  }

  public appendMessage(message: StreamerChatMessage): StreamerChatMessage {
    this.messages.unshift(message);
    this.messages.splice(this.options.maxHistory);

    if (this.isVisible(message)) {
      this.broadcastMessage(message);
    }

    return message;
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
    this.broadcastSnapshot();

    return { ...message };
  }

  public createSnapshot(): StreamerChatLiveMessage {
    return {
      type: "streamer-chat.snapshot",
      payload: {
        messages: this.listVisibleMessages(),
        sentAt: new Date().toISOString()
      }
    };
  }

  public broadcastSnapshot(): void {
    const serializedMessage = JSON.stringify(this.createSnapshot());

    for (const client of this.liveClients.values()) {
      client.send(serializedMessage);
    }
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
      payload: message
    } satisfies StreamerChatLiveMessage);

    for (const client of this.liveClients.values()) {
      client.send(serializedMessage);
    }
  }

  private isVisible(message: StreamerChatMessage): boolean {
    return this.visibilityFilter(message);
  }
}
