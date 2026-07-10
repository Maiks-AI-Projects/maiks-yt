import type {
  OverlayFakeChatMessageHiddenEvent,
  OverlayLiveMessage,
  StreamerChatMessage
} from "@maiks-yt/events";

import type { StreamerChatRuntime } from "./streamer-chat-runtime.service.js";

export type StreamerChatModerationRuleKind =
  | "message_allowed"
  | "author_allowed"
  | "message_hidden"
  | "author_banned"
  | "author_warned";

export type StreamerChatModerationRule = {
  activeUntil?: string | null;
  appliedAt: string;
  authorName: string;
  count?: number;
  id: string;
  kind: StreamerChatModerationRuleKind;
  messageId: string | null;
  source: StreamerChatMessage["source"];
};

export type StreamerChatModerationAuditEntry = {
  action: "warn_author" | "allow_message" | "allow_author" | "hide_message" | "ban_author" | "unban_author" | "delete_message" | "temporary_mute_author";
  actorDisplayName: string | null;
  at: string;
  id: string;
  messageId: string | null;
  note: string | null;
  outcome: "applied" | "denied" | "invalid" | "not_found" | "no_op" | "provider_queued" | "provider_failed" | "reverted";
  providerAction: boolean;
  reason: string | null;
  source: StreamerChatMessage["source"];
  targetAuthorName: string | null;
  targetExternalId: string | null;
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
  private readonly allowedMessageRules = new Map<string, {
    activeUntil: string | null;
    appliedAt: string;
    authorName: string;
    id: string;
    messageId: string;
    source: StreamerChatMessage["source"];
  }>();
  private readonly allowedActorRules = new Map<string, {
    activeUntil: string | null;
    appliedAt: string;
    authorName: string;
    id: string;
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

  public allowMessage(messageId: string, activeUntil: string | null): StreamerChatMessage | null {
    const message = this.dependencies.chatRuntime.findMessage(messageId);

    if (!message) {
      return null;
    }

    this.allowedMessageRules.set(messageId, {
      activeUntil,
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      id: this.createAllowedMessageRuleId(messageId),
      messageId,
      source: message.source
    });
    this.dependencies.chatRuntime.broadcastSnapshot();

    return { ...message };
  }

  public allowActorFromMessage(messageId: string, activeUntil: string | null): StreamerChatMessage | null {
    const message = this.dependencies.chatRuntime.findMessage(messageId);

    if (!message) {
      return null;
    }

    const actorKey = this.createActorKey(message);
    this.allowedActorRules.set(actorKey, {
      activeUntil,
      appliedAt: new Date().toISOString(),
      authorName: message.authorName,
      id: this.createAllowedActorRuleId(actorKey),
      source: message.source
    });
    this.dependencies.chatRuntime.broadcastSnapshot();

    return { ...message };
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
    if (this.isAllowedMessageActive(message.id) || this.isAllowedActorActive(this.createActorKey(message))) {
      return true;
    }

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

  public hydrateAllowedMessage(
    messageId: string,
    authorName: string,
    source: StreamerChatMessage["source"],
    appliedAt: string,
    activeUntil: string | null
  ): void {
    this.allowedMessageRules.set(messageId, {
      activeUntil,
      appliedAt,
      authorName,
      id: this.createAllowedMessageRuleId(messageId),
      messageId,
      source
    });
  }

  public hydrateAllowedActor(
    authorName: string,
    source: StreamerChatMessage["source"],
    appliedAt: string,
    activeUntil: string | null
  ): void {
    const actorKey = this.createActorKey({ authorName, source });

    this.allowedActorRules.set(actorKey, {
      activeUntil,
      appliedAt,
      authorName,
      id: this.createAllowedActorRuleId(actorKey),
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
    const allowedMessageRules = Array.from(this.allowedMessageRules.values())
      .filter((rule) => this.isActiveUntilVisible(rule.activeUntil))
      .map((rule) => ({
        ...rule,
        kind: "message_allowed" as const
      }));
    const allowedActorRules = Array.from(this.allowedActorRules.values())
      .filter((rule) => this.isActiveUntilVisible(rule.activeUntil))
      .map((rule) => ({
        ...rule,
        kind: "author_allowed" as const,
        messageId: null
      }));
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

    return [...allowedMessageRules, ...allowedActorRules, ...hiddenRules, ...bannedRules, ...warningRules]
      .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
  }

  public retractRule(ruleId: string): StreamerChatModerationRule | null {
    for (const [messageId, rule] of this.allowedMessageRules.entries()) {
      if (rule.id === ruleId) {
        this.allowedMessageRules.delete(messageId);
        this.dependencies.chatRuntime.broadcastSnapshot();

        return {
          ...rule,
          kind: "message_allowed",
          messageId
        };
      }
    }

    for (const [actorKey, rule] of this.allowedActorRules.entries()) {
      if (rule.id === ruleId) {
        this.allowedActorRules.delete(actorKey);
        this.dependencies.chatRuntime.broadcastSnapshot();

        return {
          ...rule,
          kind: "author_allowed",
          messageId: null
        };
      }
    }

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

  private createAllowedMessageRuleId(messageId: string): string {
    return `message_allowed:${messageId}`;
  }

  private createBannedActorRuleId(actorKey: string): string {
    return `author_banned:${actorKey}`;
  }

  private createAllowedActorRuleId(actorKey: string): string {
    return `author_allowed:${actorKey}`;
  }

  private createWarningRuleId(actorKey: string): string {
    return `author_warned:${actorKey}`;
  }

  private isAllowedMessageActive(messageId: string): boolean {
    const rule = this.allowedMessageRules.get(messageId);

    if (!rule || !this.isActiveUntilVisible(rule.activeUntil)) {
      if (rule) {
        this.allowedMessageRules.delete(messageId);
      }

      return false;
    }

    return true;
  }

  private isAllowedActorActive(actorKey: string): boolean {
    const rule = this.allowedActorRules.get(actorKey);

    if (!rule || !this.isActiveUntilVisible(rule.activeUntil)) {
      if (rule) {
        this.allowedActorRules.delete(actorKey);
      }

      return false;
    }

    return true;
  }

  private isActiveUntilVisible(activeUntil: string | null): boolean {
    return activeUntil === null || new Date(activeUntil).getTime() > Date.now();
  }
}
