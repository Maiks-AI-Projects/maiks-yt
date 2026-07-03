import type {
  OverlayFakeChatMessageHiddenEvent,
  OverlayLiveMessage,
  StreamerChatMessage
} from "@maiks-yt/events";

import type {
  FakeLocalModerationAuditEntry,
  FakeLocalMutedAuthor
} from "../fake-local-moderation/index.js";
import type { StreamerChatRuntime } from "./streamer-chat-runtime.service.js";

export class InMemoryFakeLocalModerationRuntime {
  private readonly auditEntries: FakeLocalModerationAuditEntry[] = [];
  private readonly hiddenMessageIds = new Set<string>();
  private readonly mutedAuthors = new Map<string, FakeLocalMutedAuthor>();

  public constructor(private readonly dependencies: {
    chatRuntime: StreamerChatRuntime;
    publishOverlayMessage: (message: OverlayLiveMessage) => void;
  }) {}

  public appendAudit(entry: FakeLocalModerationAuditEntry): void {
    this.auditEntries.unshift(structuredClone(entry));
    this.auditEntries.splice(100);
  }

  public hideMessage(messageId: string, hiddenAt: string): StreamerChatMessage | null {
    const message = this.dependencies.chatRuntime.removeMessage(messageId);

    if (!message) {
      return null;
    }

    this.hiddenMessageIds.add(messageId);
    this.dependencies.publishOverlayMessage({
      type: "overlay.fake-chat.message.hidden",
      payload: {
        id: messageId,
        source: "fake-local",
        hiddenAt
      }
    } satisfies OverlayFakeChatMessageHiddenEvent);

    return { ...message };
  }

  public muteAuthor(authorName: string, mutedUntil: string): FakeLocalMutedAuthor {
    const mutedAuthor = {
      authorName,
      mutedUntil
    };
    this.mutedAuthors.set(this.normalizeAuthorName(authorName), mutedAuthor);

    return { ...mutedAuthor };
  }

  public isAuthorMuted(authorName: string, now = new Date()): FakeLocalMutedAuthor | null {
    const key = this.normalizeAuthorName(authorName);
    const mutedAuthor = this.mutedAuthors.get(key);

    if (!mutedAuthor) {
      return null;
    }

    if (new Date(mutedAuthor.mutedUntil).getTime() <= now.getTime()) {
      this.mutedAuthors.delete(key);
      return null;
    }

    return { ...mutedAuthor };
  }

  public isMessageVisible(message: StreamerChatMessage): boolean {
    return !this.hiddenMessageIds.has(message.id);
  }

  private normalizeAuthorName(authorName: string): string {
    return authorName.trim().toLowerCase();
  }
}
