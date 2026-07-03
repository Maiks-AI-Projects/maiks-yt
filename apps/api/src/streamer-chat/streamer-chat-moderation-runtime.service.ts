import type {
  OverlayFakeChatMessageHiddenEvent,
  OverlayLiveMessage,
  StreamerChatMessage
} from "@maiks-yt/events";

import type { StreamerChatRuntime } from "./streamer-chat-runtime.service.js";

export type StreamerChatModerationRuleKind = "message_hidden" | "author_banned" | "author_warned";

export type StreamerChatModerationRule = {
  appliedAt: string;
  authorName: string;
  count?: number;
  id: string;
  kind: StreamerChatModerationRuleKind;
  messageId: string | null;
  source: StreamerChatMessage["source"];
};

export class InMemoryStreamerChatModerationRuntime {
  private readonly warningThreshold = 3;
  private readonly hiddenMessageRules = new Map<string, {
    appliedAt: string;
    authorName: string;
    id: string;
    messageId: string;
    source: StreamerChatMessage["source"];
  }>();
  private readonly bannedActorRules = new Map<string, {
    appliedAt: string;
    authorName: string;
    id: string;
    source: StreamerChatMessage["source"];
  }>();
  private readonly warningRules = new Map<string, {
    appliedAt: string;
    authorName: string;
    count: number;
    id: string;
    lastMessageId: string;
    source: StreamerChatMessage["source"];
  }>();

  public constructor(private readonly dependencies: {
    chatRuntime: StreamerChatRuntime;
    publishOverlayMessage: (message: OverlayLiveMessage) => void;
  }) {}

  public hideMessage(messageId: string): StreamerChatMessage | null {
    const message = this.dependencies.chatRuntime.findMessage(messageId);

    if (!message) {
      return null;
    }

    this.hiddenMessageRules.set(messageId, {
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      id: this.createHiddenMessageRuleId(messageId),
      messageId,
      source: message.source
    });
    this.broadcastOverlayHideIfNeeded(message);
    this.dependencies.chatRuntime.broadcastSnapshot();

    return { ...message };
  }

  public banActorFromMessage(messageId: string): { affectedMessages: StreamerChatMessage[]; bannedMessage: StreamerChatMessage } | null {
    const message = this.dependencies.chatRuntime.findMessage(messageId);

    if (!message) {
      return null;
    }

    const actorKey = this.createActorKey(message);
    this.bannedActorRules.set(actorKey, {
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      id: this.createBannedActorRuleId(actorKey),
      source: message.source
    });
    const affectedMessages = this.dependencies.chatRuntime.listAllMessages()
      .filter((candidate) => this.createActorKey(candidate) === actorKey)
      .map((candidate) => ({ ...candidate }));

    for (const affectedMessage of affectedMessages) {
      this.broadcastOverlayHideIfNeeded(affectedMessage);
    }

    this.dependencies.chatRuntime.broadcastSnapshot();

    return {
      affectedMessages,
      bannedMessage: { ...message }
    };
  }

  public warnActorFromMessage(messageId: string, previousWarningCount = 0): {
    autoBanned: boolean;
    affectedMessages: StreamerChatMessage[];
    message: StreamerChatMessage;
    warningCount: number;
    warningThreshold: number;
  } | null {
    const message = this.dependencies.chatRuntime.findMessage(messageId);

    if (!message) {
      return null;
    }

    const actorKey = this.createActorKey(message);
    const currentRule = this.warningRules.get(actorKey);
    const warningCount = Math.max(currentRule?.count ?? 0, previousWarningCount) + 1;

    this.warningRules.set(actorKey, {
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      count: warningCount,
      id: this.createWarningRuleId(actorKey),
      lastMessageId: message.id,
      source: message.source
    });

    if (warningCount >= this.warningThreshold) {
      const banResult = this.banActorFromMessage(message.id);

      return {
        autoBanned: true,
        affectedMessages: banResult?.affectedMessages ?? [],
        message: { ...message },
        warningCount,
        warningThreshold: this.warningThreshold
      };
    }

    this.dependencies.chatRuntime.broadcastSnapshot();

    return {
      autoBanned: false,
      affectedMessages: [],
      message: { ...message },
      warningCount,
      warningThreshold: this.warningThreshold
    };
  }

  public isMessageVisible(message: StreamerChatMessage): boolean {
    return !this.hiddenMessageRules.has(message.id) && !this.bannedActorRules.has(this.createActorKey(message));
  }

  public isActorBanned(source: StreamerChatMessage["source"], authorName: string): boolean {
    return this.bannedActorRules.has(this.createActorKey({ source, authorName }));
  }

  public hydrateHiddenMessage(
    messageId: string,
    authorName: string,
    source: StreamerChatMessage["source"],
    appliedAt: string
  ): void {
    this.hiddenMessageRules.set(messageId, {
      appliedAt,
      authorName,
      id: this.createHiddenMessageRuleId(messageId),
      messageId,
      source
    });
  }

  public hydrateBannedActor(
    authorName: string,
    source: StreamerChatMessage["source"],
    appliedAt: string
  ): void {
    const actorKey = this.createActorKey({ authorName, source });

    this.bannedActorRules.set(actorKey, {
      appliedAt,
      authorName,
      id: this.createBannedActorRuleId(actorKey),
      source
    });
  }

  public hydrateWarningCount(
    authorName: string,
    source: StreamerChatMessage["source"],
    count: number,
    lastMessageId: string | null,
    appliedAt: string
  ): void {
    const actorKey = this.createActorKey({ authorName, source });

    this.warningRules.set(actorKey, {
      appliedAt,
      authorName,
      count,
      id: this.createWarningRuleId(actorKey),
      lastMessageId: lastMessageId ?? "",
      source
    });
  }

  public listRules(): StreamerChatModerationRule[] {
    const hiddenRules = Array.from(this.hiddenMessageRules.values()).map((rule) => ({
      ...rule,
      kind: "message_hidden" as const
    }));
    const bannedRules = Array.from(this.bannedActorRules.values()).map((rule) => ({
      ...rule,
      kind: "author_banned" as const,
      messageId: null
    }));
    const warningRules = Array.from(this.warningRules.values()).map((rule) => ({
      appliedAt: rule.appliedAt,
      authorName: rule.authorName,
      count: rule.count,
      id: rule.id,
      kind: "author_warned" as const,
      messageId: rule.lastMessageId,
      source: rule.source
    }));

    return [...hiddenRules, ...bannedRules, ...warningRules]
      .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
  }

  public retractRule(ruleId: string): StreamerChatModerationRule | null {
    for (const [messageId, rule] of this.hiddenMessageRules.entries()) {
      if (rule.id === ruleId) {
        this.hiddenMessageRules.delete(messageId);
        this.dependencies.chatRuntime.broadcastSnapshot();

        return {
          ...rule,
          kind: "message_hidden",
          messageId
        };
      }
    }

    for (const [actorKey, rule] of this.bannedActorRules.entries()) {
      if (rule.id === ruleId) {
        this.bannedActorRules.delete(actorKey);
        this.dependencies.chatRuntime.broadcastSnapshot();

        return {
          ...rule,
          kind: "author_banned",
          messageId: null
        };
      }
    }

    for (const [actorKey, rule] of this.warningRules.entries()) {
      if (rule.id === ruleId) {
        this.warningRules.delete(actorKey);
        this.dependencies.chatRuntime.broadcastSnapshot();

        return {
          appliedAt: rule.appliedAt,
          authorName: rule.authorName,
          count: rule.count,
          id: rule.id,
          kind: "author_warned",
          messageId: rule.lastMessageId,
          source: rule.source
        };
      }
    }

    return null;
  }

  private broadcastOverlayHideIfNeeded(message: StreamerChatMessage): void {
    if (message.source !== "fake-local") {
      return;
    }

    this.dependencies.publishOverlayMessage({
      type: "overlay.fake-chat.message.hidden",
      payload: {
        id: message.id,
        source: "fake-local",
        hiddenAt: new Date().toISOString()
      }
    } satisfies OverlayFakeChatMessageHiddenEvent);
  }

  private createActorKey(actor: Pick<StreamerChatMessage, "source" | "authorName">): string {
    return `${actor.source}:${actor.authorName.trim().toLowerCase()}`;
  }

  private createHiddenMessageRuleId(messageId: string): string {
    return `message_hidden:${messageId}`;
  }

  private createBannedActorRuleId(actorKey: string): string {
    return `author_banned:${actorKey}`;
  }

  private createWarningRuleId(actorKey: string): string {
    return `author_warned:${actorKey}`;
  }
}
